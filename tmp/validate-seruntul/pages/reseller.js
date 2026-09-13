import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Reseller", subtitle: "Mitra penjual & harga khusus", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Reseller" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Omzet Reseller" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-success", children: formatRupiah(stat.omzet) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Transaksi Reseller" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.trx })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Rata-rata / Transaksi" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: formatRupiah(stat.rata) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3F7}\uFE0F" }),
        " Harga Khusus Reseller"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Diskon Otomatis (%)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: diskonPersen, onChange: (e) => setDiskonPersen(e.target.value) }),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted mt-1", children: [
            "Diterapkan otomatis di POS saat channel ",
            /* @__PURE__ */ jsx("b", { children: "Reseller" }),
            " dipilih. Contoh: harga ",
            formatRupiah(1e5),
            " \u2192",
            " ",
            /* @__PURE__ */ jsx("b", { children: formatRupiah(1e5 - Math.round(1e5 * (Number(diskonPersen) || 0) / 100)) })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "form-group", style: { justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanDiskon, disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan Diskon" }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4E6}" }),
        " Tambah Reseller"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama *" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama toko / orang" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP / WA" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tier" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.tier, onChange: (e) => setForm({ ...form, tier: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "reguler", children: "Reguler" }),
            /* @__PURE__ */ jsx("option", { value: "grosir", children: "Grosir" }),
            /* @__PURE__ */ jsx("option", { value: "agen", children: "Agen" }),
            /* @__PURE__ */ jsx("option", { value: "distributor", children: "Distributor" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Alamat" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.alamat, onChange: (e) => setForm({ ...form, alamat: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal Gabung" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tgl_gabung, onChange: (e) => setForm({ ...form, tgl_gabung: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Catatan" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", value: form.catatan, onChange: (e) => setForm({ ...form, catatan: e.target.value }), placeholder: "mis. ambil tiap minggu" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\uFF0B Tambah Reseller" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F91D}" }),
          " Daftar Reseller"
        ] }),
        /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4E6}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada reseller" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Daftarkan mitra penjual untuk mendapat harga khusus." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          /* @__PURE__ */ jsx("th", { children: "Kontak" }),
          /* @__PURE__ */ jsx("th", { children: "Tier" }),
          /* @__PURE__ */ jsx("th", { children: "Gabung" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Trx" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total Belanja" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsxs("td", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold", children: r.nama }),
            r.catatan && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: r.catatan })
          ] }),
          /* @__PURE__ */ jsx("td", { children: r.kontak || "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-info", children: r.tier || "reguler" }) }),
          /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(r.tgl_gabung) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: r.total_transaksi || 0 }),
          /* @__PURE__ */ jsx("td", { className: "text-right font-bold text-primary", children: formatRupiah(r.total_belanja) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(r), children: "\u2715" }) })
        ] }, r.id)) })
      ] }) })
    ] })
  ] });
}
