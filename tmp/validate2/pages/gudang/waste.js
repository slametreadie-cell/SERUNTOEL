import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const ALASAN = ["Rusak / basi", "Tumpah", "Salah masak", "Kadaluarsa", "Susut penyimpanan", "Retur pelanggan", "Lainnya"];
export default function Waste() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [dari, setDari] = useState(() => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [sampai, setSampai] = useState(hariIni());
  const [form, setForm] = useState({ tanggal: hariIni(), produk_id: "", qty_waste: "", alasan: ALASAN[0], petugas: "" });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [wRes, pRes] = await Promise.all([
      supabase.from("waste_logs").select("*").gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: false }),
      supabase.from("products").select("id, nama_produk, hpp_per_unit").order("nama_produk")
    ]);
    if (wRes.error) setError(wRes.error.message);
    setData(wRes.data || []);
    setProduk(pRes.data || []);
    setLoading(false);
  }, [dari, sampai]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const simpan = async (e) => {
    e.preventDefault();
    const p = produk.find((x) => x.id === form.produk_id);
    if (!p) {
      setError("Pilih produk dulu");
      return;
    }
    const qty = Number(form.qty_waste);
    if (!qty || qty <= 0) {
      setError("Qty waste harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const hpp = (Number(p.hpp_per_unit) || 0) * qty;
      const { error: error2 } = await supabase.from("waste_logs").insert({
        tanggal: form.tanggal || hariIni(),
        produk_id: p.id,
        nama_produk: p.nama_produk,
        qty_waste: qty,
        alasan: form.alasan || null,
        biaya_hpp: hpp,
        petugas: form.petugas || user?.email || null
      });
      if (error2) throw error2;
      const { data: fresh } = await supabase.from("products").select("stok_produk").eq("id", p.id).single();
      const stokBaru = Math.max(0, (fresh?.stok_produk || 0) - qty);
      await supabase.from("products").update({ stok_produk: stokBaru }).eq("id", p.id);
      logAudit({
        aksi: "waste",
        user,
        sheetTarget: "waste_logs",
        detail: { produk: p.nama_produk, qty, alasan: form.alasan, biaya: hpp }
      });
      setMsg(`\u2705 Waste dicatat \u2014 kerugian ${formatRupiah(hpp)}`);
      setForm({ ...form, produk_id: "", qty_waste: "", petugas: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  const hapus = async (w) => {
    if (!confirm(`Hapus catatan waste ${w.nama_produk}? Stok tidak dikembalikan.`)) return;
    await supabase.from("waste_logs").delete().eq("id", w.id);
    fetchData();
  };
  const filtered = data.filter(
    (w) => !search || (w.nama_produk || "").toLowerCase().includes(search.toLowerCase()) || (w.alasan || "").toLowerCase().includes(search.toLowerCase())
  );
  const stat = useMemo(() => {
    const biaya = filtered.reduce((s, w) => s + Number(w.biaya_hpp || 0), 0);
    const qty = filtered.reduce((s, w) => s + (w.qty_waste || 0), 0);
    const perAlasan = {};
    filtered.forEach((w) => {
      perAlasan[w.alasan || "Lainnya"] = (perAlasan[w.alasan || "Lainnya"] || 0) + 1;
    });
    const teratas = Object.entries(perAlasan).sort((a, b) => b[1] - a[1])[0];
    return { biaya, qty, n: filtered.length, teratas: teratas ? teratas[0] : "\u2014" };
  }, [filtered]);
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Waste Log", subtitle: "Catat produk rusak & kerugian" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Kerugian"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(stat.biaya))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Qty Waste"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.qty)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Jumlah Catatan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.n)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Alasan Terbanyak"), /* @__PURE__ */ React.createElement("div", { className: "metric-value", style: { fontSize: 15 } }, stat.teratas))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F5D1}\uFE0F"), " Catat Waste Baru")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Produk *"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.produk_id, onChange: (e) => setForm({ ...form, produk_id: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih produk \u2014"), produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.nama_produk, " (HPP ", formatRupiah(p.hpp_per_unit), ")")))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Qty *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: form.qty_waste,
      onChange: (e) => setForm({ ...form, qty_waste: e.target.value }),
      placeholder: "0"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tanggal, onChange: (e) => setForm({ ...form, tanggal: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Alasan"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.alasan, onChange: (e) => setForm({ ...form, alasan: e.target.value }) }, ALASAN.map((a) => /* @__PURE__ */ React.createElement("option", { key: a, value: a }, a)))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Petugas"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.petugas, onChange: (e) => setForm({ ...form, petugas: e.target.value }), placeholder: user?.email || "Nama petugas" }))), form.produk_id && form.qty_waste && /* @__PURE__ */ React.createElement("div", { className: "alert alert-warning" }, "Perkiraan kerugian:", " ", /* @__PURE__ */ React.createElement("b", null, formatRupiah((Number(produk.find((x) => x.id === form.produk_id)?.hpp_per_unit) || 0) * (Number(form.qty_waste) || 0))), " ", "\xB7 stok produk akan berkurang ", form.qty_waste), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-danger", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F5D1}\uFE0F Catat Waste")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Riwayat Waste")), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 16px 12px" }, className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }), /* @__PURE__ */ React.createElement("span", { className: "text-muted text-sm" }, "s/d"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) }), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 200 },
      placeholder: "\u{1F50D} Cari produk/alasan...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F5D1}\uFE0F"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada waste"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Bagus! Tidak ada produk terbuang pada periode ini.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Qty"), /* @__PURE__ */ React.createElement("th", null, "Alasan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Kerugian"), /* @__PURE__ */ React.createElement("th", null, "Petugas"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((w) => /* @__PURE__ */ React.createElement("tr", { key: w.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(w.tanggal)), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, w.nama_produk), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, w.qty_waste), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-warning" }, w.alasan || "\u2014")), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger font-bold" }, formatRupiah(w.biaya_hpp)), /* @__PURE__ */ React.createElement("td", { className: "text-muted text-xs" }, w.petugas || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(w) }, "\u2715")))), /* @__PURE__ */ React.createElement("tr", { style: { background: "var(--bg)" } }, /* @__PURE__ */ React.createElement("td", { colSpan: 2, className: "font-extrabold" }, "TOTAL"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold" }, stat.qty), /* @__PURE__ */ React.createElement("td", null), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold text-danger" }, formatRupiah(stat.biaya)), /* @__PURE__ */ React.createElement("td", { colSpan: 2 })))))));
}
