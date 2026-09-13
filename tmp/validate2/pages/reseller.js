import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
export default function Reseller() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [diskonPersen, setDiskonPersen] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nama: "", kontak: "", alamat: "", tier: "reguler", catatan: "", tgl_gabung: hariIni() });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [rRes, tRes, cRes] = await Promise.all([
      supabase.from("resellers").select("*").order("total_belanja", { ascending: false }),
      supabase.from("transactions").select("customer, total_bayar, tanggal").eq("channel", "reseller").order("tanggal", { ascending: false }).limit(300),
      supabase.from("configuration").select("key, value").eq("key", "diskon_reseller")
    ]);
    if (rRes.error) setError(rRes.error.message);
    setData(rRes.data || []);
    setTransaksi(tRes.data || []);
    const dp = Number(cRes.data?.[0]?.value);
    if (Number.isFinite(dp) && dp > 0) setDiskonPersen(dp);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const simpanDiskon = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("configuration").select("id").eq("key", "diskon_reseller").maybeSingle();
      if (existing) await supabase.from("configuration").update({ value: String(diskonPersen) }).eq("id", existing.id);
      else await supabase.from("configuration").insert({ key: "diskon_reseller", value: String(diskonPersen), keterangan: "Diskon harga untuk channel reseller (%)" });
      logAudit({ aksi: "ubah_diskon_reseller", user, sheetTarget: "configuration", detail: { diskon_reseller: diskonPersen } });
      setMsg(`\u2705 Diskon reseller diset ${diskonPersen}%`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const simpan = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      setError("Nama reseller wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("resellers").insert({
        nama: form.nama.trim(),
        kontak: form.kontak || null,
        alamat: form.alamat || null,
        tier: form.tier || "reguler",
        catatan: form.catatan || null,
        tgl_gabung: form.tgl_gabung || hariIni(),
        total_transaksi: 0,
        total_belanja: 0
      });
      if (error2) throw error2;
      logAudit({ aksi: "tambah_reseller", user, sheetTarget: "resellers", detail: { nama: form.nama, tier: form.tier } });
      setMsg("\u2705 Reseller ditambahkan");
      setForm({ nama: "", kontak: "", alamat: "", tier: "reguler", catatan: "", tgl_gabung: hariIni() });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const hapus = async (r) => {
    if (!confirm(`Hapus reseller ${r.nama}?`)) return;
    await supabase.from("resellers").delete().eq("id", r.id);
    logAudit({ aksi: "hapus_reseller", user, sheetTarget: "resellers", detail: { nama: r.nama } });
    fetchData();
  };
  const filtered = data.filter(
    (r) => !search || (r.nama || "").toLowerCase().includes(search.toLowerCase()) || (r.kontak || "").includes(search) || (r.tier || "").toLowerCase().includes(search.toLowerCase())
  );
  const stat = useMemo(() => {
    const omzetReseller = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    return {
      total: data.length,
      omzet: omzetReseller,
      trx: transaksi.length,
      rata: transaksi.length ? omzetReseller / transaksi.length : 0
    };
  }, [data, transaksi]);
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Reseller", subtitle: "Mitra penjual & harga khusus" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Reseller"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Omzet Reseller"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, formatRupiah(stat.omzet))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Transaksi Reseller"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.trx)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Rata-rata / Transaksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, formatRupiah(stat.rata)))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3F7}\uFE0F"), " Harga Khusus Reseller")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Diskon Otomatis (%)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: diskonPersen, onChange: (e) => setDiskonPersen(e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Diterapkan otomatis di POS saat channel ", /* @__PURE__ */ React.createElement("b", null, "Reseller"), " dipilih. Contoh: harga ", formatRupiah(1e5), " \u2192", " ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(1e5 - Math.round(1e5 * (Number(diskonPersen) || 0) / 100))))), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanDiskon, disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Diskon")))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4E6}"), " Tambah Reseller")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama toko / orang" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP / WA" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tier"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.tier, onChange: (e) => setForm({ ...form, tier: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "reguler" }, "Reguler"), /* @__PURE__ */ React.createElement("option", { value: "grosir" }, "Grosir"), /* @__PURE__ */ React.createElement("option", { value: "agen" }, "Agen"), /* @__PURE__ */ React.createElement("option", { value: "distributor" }, "Distributor")))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Alamat"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.alamat, onChange: (e) => setForm({ ...form, alamat: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal Gabung"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tgl_gabung, onChange: (e) => setForm({ ...form, tgl_gabung: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Catatan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.catatan, onChange: (e) => setForm({ ...form, catatan: e.target.value }), placeholder: "mis. ambil tiap minggu" })), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\uFF0B Tambah Reseller")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F91D}"), " Daftar Reseller"), /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) })), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4E6}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada reseller"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Daftarkan mitra penjual untuk mendapat harga khusus.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Kontak"), /* @__PURE__ */ React.createElement("th", null, "Tier"), /* @__PURE__ */ React.createElement("th", null, "Gabung"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Trx"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total Belanja"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, r.nama), r.catatan && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, r.catatan)), /* @__PURE__ */ React.createElement("td", null, r.kontak || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-info" }, r.tier || "reguler")), /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(r.tgl_gabung)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.total_transaksi || 0), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold text-primary" }, formatRupiah(r.total_belanja)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(r) }, "\u2715")))))))));
}
