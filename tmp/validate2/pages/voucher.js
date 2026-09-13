import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
export default function Voucher() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    kode: "",
    tipe: "persen",
    nilai: "",
    kategori: "",
    deskripsi: "",
    tanggal_mulai: hariIni(),
    tanggal_berakhir: "",
    aktif: true
  });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [vRes, uRes] = await Promise.all([
      supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      supabase.from("voucher_usages").select("*").order("tanggal_pakai", { ascending: false }).limit(200)
    ]);
    if (vRes.error) setError(vRes.error.message);
    else setData(vRes.data || []);
    setUsage(uRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const statusVoucher = (v) => {
    if (!v.aktif) return { label: "Nonaktif", cls: "badge-neutral" };
    const t = hariIni();
    if (v.tanggal_mulai && t < v.tanggal_mulai) return { label: "Belum mulai", cls: "badge-info" };
    if (v.tanggal_berakhir && t > v.tanggal_berakhir) return { label: "Kedaluwarsa", cls: "badge-danger" };
    return { label: "Aktif", cls: "badge-success" };
  };
  const simpan = async (e) => {
    e.preventDefault();
    const kode = (form.kode || "").trim().toUpperCase();
    if (!kode) {
      setError("Kode voucher wajib diisi");
      return;
    }
    const nilai = Number(form.nilai) || 0;
    if (nilai <= 0) {
      setError("Nilai diskon harus lebih dari 0");
      return;
    }
    if (form.tipe === "persen" && nilai > 100) {
      setError("Diskon persen maksimal 100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("vouchers").insert({
        kode,
        tipe: form.tipe,
        nilai,
        kategori: form.kategori || null,
        deskripsi: form.deskripsi || null,
        tanggal_mulai: form.tanggal_mulai || null,
        tanggal_berakhir: form.tanggal_berakhir || null,
        aktif: form.aktif,
        total_dipakai: 0
      });
      if (error2) throw error2;
      logAudit({ aksi: "tambah_voucher", user, sheetTarget: "vouchers", detail: { kode, tipe: form.tipe, nilai } });
      setMsg("\u2705 Voucher dibuat");
      setForm({ kode: "", tipe: "persen", nilai: "", kategori: "", deskripsi: "", tanggal_mulai: hariIni(), tanggal_berakhir: "", aktif: true });
      fetchData();
    } catch (err) {
      setError(err.message.includes("duplicate") ? "Kode voucher sudah dipakai" : err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const toggleAktif = async (v) => {
    await supabase.from("vouchers").update({ aktif: !v.aktif }).eq("id", v.id);
    fetchData();
  };
  const hapus = async (v) => {
    if (!confirm(`Hapus voucher ${v.kode}?`)) return;
    await supabase.from("vouchers").delete().eq("id", v.id);
    logAudit({ aksi: "hapus_voucher", user, sheetTarget: "vouchers", detail: { kode: v.kode } });
    fetchData();
  };
  const filtered = data.filter(
    (v) => !search || (v.kode || "").toLowerCase().includes(search.toLowerCase()) || (v.kategori || "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPemakaian = data.reduce((s, v) => s + (v.total_dipakai || 0), 0);
  const totalDiskon = usage.reduce((s, u) => s + Number(u.diskon || 0), 0);
  const aktifCount = data.filter((v) => statusVoucher(v).label === "Aktif").length;
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Voucher & Promo", subtitle: "Kelola kode diskon untuk pelanggan" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Voucher Aktif"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, aktifCount)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Pemakaian"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, totalPemakaian, "\xD7")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Diskon Diberikan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(totalDiskon)))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F39F}\uFE0F"), " Buat Voucher Baru")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kode Voucher *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.kode,
      placeholder: "mis. PROMO10",
      onChange: (e) => setForm({ ...form, kode: e.target.value.toUpperCase() })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tipe Diskon"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.tipe, onChange: (e) => setForm({ ...form, tipe: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "persen" }, "Persen (%)"), /* @__PURE__ */ React.createElement("option", { value: "nominal" }, "Nominal (Rp)"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nilai *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: form.nilai,
      placeholder: form.tipe === "persen" ? "10" : "5000",
      onChange: (e) => setForm({ ...form, nilai: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kategori (opsional)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.kategori,
      placeholder: "mis. Makanan",
      onChange: (e) => setForm({ ...form, kategori: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Mulai"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "date",
      value: form.tanggal_mulai,
      onChange: (e) => setForm({ ...form, tanggal_mulai: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Berakhir (opsional)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "date",
      value: form.tanggal_berakhir,
      onChange: (e) => setForm({ ...form, tanggal_berakhir: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.deskripsi,
      placeholder: "mis. Promo akhir bulan",
      onChange: (e) => setForm({ ...form, deskripsi: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\uFF0B Buat Voucher")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Daftar Voucher"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 220 },
      placeholder: "\u{1F50D} Cari kode...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F39F}\uFE0F"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada voucher"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Buat voucher untuk menarik pelanggan.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Kode"), /* @__PURE__ */ React.createElement("th", null, "Diskon"), /* @__PURE__ */ React.createElement("th", null, "Periode"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Dipakai"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((v) => {
    const st = statusVoucher(v);
    return /* @__PURE__ */ React.createElement("tr", { key: v.id }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold" }, v.kode), v.deskripsi && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, v.deskripsi)), /* @__PURE__ */ React.createElement("td", { className: "font-bold text-danger" }, v.tipe === "persen" ? `${v.nilai}%` : formatRupiah(v.nilai)), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, v.tanggal_mulai || "\u2014", " ", /* @__PURE__ */ React.createElement("br", null), "s/d ", v.tanggal_berakhir || "\u221E"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, v.total_dipakai || 0, "\xD7"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${st.cls}` }, st.label)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => toggleAktif(v) }, v.aktif ? "Nonaktifkan" : "Aktifkan"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(v) }, "\u2715"))));
  }))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DC}"), " Riwayat Pemakaian"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, usage.length, " catatan")), usage.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada voucher yang dipakai.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Kode"), /* @__PURE__ */ React.createElement("th", null, "Pelanggan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Diskon"))), /* @__PURE__ */ React.createElement("tbody", null, usage.map((u) => /* @__PURE__ */ React.createElement("tr", { key: u.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, new Date(u.tanggal_pakai).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, u.kode_voucher), /* @__PURE__ */ React.createElement("td", null, u.customer || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger font-bold" }, "\u2212", formatRupiah(u.diskon)))))))));
}
