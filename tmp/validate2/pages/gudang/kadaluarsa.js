import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const selisihHari = (tgl) => {
  if (!tgl) return null;
  const a = /* @__PURE__ */ new Date(tgl + "T00:00:00");
  const b = /* @__PURE__ */ new Date(hariIni() + "T00:00:00");
  return Math.round((a - b) / 864e5);
};
export default function Kadaluarsa() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("semua");
  const [form, setForm] = useState({
    produk_id: "",
    batch_id: "",
    tgl_produksi: hariIni(),
    masa_simpan: "3",
    tgl_kadaluarsa: "",
    qty: ""
  });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [eRes, pRes] = await Promise.all([
      supabase.from("expired_products").select("*").order("tgl_kadaluarsa"),
      supabase.from("products").select("id, nama_produk").order("nama_produk")
    ]);
    if (eRes.error) setError(eRes.error.message);
    setData(eRes.data || []);
    setProduk(pRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    const hari = hariIni();
    const perlu = data.filter(
      (d) => d.status === "aktif" && d.tgl_kadaluarsa && d.tgl_kadaluarsa < hari || d.status === "aktif" && (d.sisa_qty || 0) <= 0 && (d.qty || 0) > 0
    );
    perlu.forEach((d) => {
      const kadaluarsa = d.tgl_kadaluarsa && d.tgl_kadaluarsa < hari;
      supabase.from("expired_products").update({ status: kadaluarsa ? "kadaluarsa" : "habis" }).eq("id", d.id);
    });
    if (perlu.length) setTimeout(fetchData, 700);
  }, [data]);
  useEffect(() => {
    if (!form.tgl_produksi || !form.masa_simpan) return;
    const d = /* @__PURE__ */ new Date(form.tgl_produksi + "T00:00:00");
    d.setDate(d.getDate() + (Number(form.masa_simpan) || 0));
    setForm((f) => ({ ...f, tgl_kadaluarsa: d.toISOString().slice(0, 10) }));
  }, [form.tgl_produksi, form.masa_simpan]);
  const simpan = async (e) => {
    e.preventDefault();
    const p = produk.find((x) => x.id === form.produk_id);
    if (!p) {
      setError("Pilih produk dulu");
      return;
    }
    const qty = Number(form.qty);
    if (!qty || qty <= 0) {
      setError("Qty harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("expired_products").insert({
        produk_id: p.id,
        nama_produk: p.nama_produk,
        batch_id: form.batch_id || `BATCH-${Date.now().toString().slice(-8)}`,
        tgl_produksi: form.tgl_produksi || hariIni(),
        masa_simpan: Number(form.masa_simpan) || 0,
        tgl_kadaluarsa: form.tgl_kadaluarsa || null,
        qty,
        sisa_qty: qty,
        status: "aktif"
      });
      if (error2) throw error2;
      logAudit({
        aksi: "tambah_batch",
        user,
        sheetTarget: "expired_products",
        detail: { produk: p.nama_produk, qty, tgl_kadaluarsa: form.tgl_kadaluarsa }
      });
      setMsg("\u2705 Batch dicatat");
      setForm({ produk_id: "", batch_id: "", tgl_produksi: hariIni(), masa_simpan: "3", tgl_kadaluarsa: "", qty: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const ubahSisa = async (row, val) => {
    const sisa = Math.max(0, Number(val) || 0);
    await supabase.from("expired_products").update({
      sisa_qty: sisa,
      status: sisa === 0 ? "habis" : row.tgl_kadaluarsa && row.tgl_kadaluarsa < hariIni() ? "kadaluarsa" : "aktif"
    }).eq("id", row.id);
    fetchData();
  };
  const hapus = async (row) => {
    if (!confirm(`Hapus batch ${row.nama_produk}?`)) return;
    await supabase.from("expired_products").delete().eq("id", row.id);
    fetchData();
  };
  const denganStatus = data.map((d) => {
    const sisaHari = selisihHari(d.tgl_kadaluarsa);
    let kondisi = "aman";
    if (d.status === "kadaluarsa" || sisaHari !== null && sisaHari < 0) kondisi = "kadaluarsa";
    else if ((d.sisa_qty || 0) <= 0) kondisi = "habis";
    else if (sisaHari !== null && sisaHari <= 2) kondisi = "kritis";
    else if (sisaHari !== null && sisaHari <= 7) kondisi = "peringatan";
    return { ...d, sisaHari, kondisi };
  });
  const filtered = denganStatus.filter(
    (d) => filter === "semua" ? true : filter === "perlu" ? ["kritis", "kadaluarsa"].includes(d.kondisi) : d.kondisi === filter
  );
  const stat = useMemo(() => {
    const aktif = denganStatus.filter((d) => d.kondisi !== "habis");
    return {
      total: denganStatus.length,
      kritis: denganStatus.filter((d) => d.kondisi === "kritis").length,
      kadaluarsa: denganStatus.filter((d) => d.kondisi === "kadaluarsa").length,
      sisa: aktif.reduce((s, d) => s + (d.sisa_qty || 0), 0)
    };
  }, [denganStatus]);
  const BADGE = { aman: "badge-success", peringatan: "badge-info", kritis: "badge-warning", kadaluarsa: "badge-danger", habis: "badge-neutral" };
  const LABEL = { aman: "Aman", peringatan: "\u22647 hari", kritis: "\u22642 hari", kadaluarsa: "Kadaluarsa", habis: "Habis" };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Produk Kadaluarsa", subtitle: "Pantau masa simpan & batch produksi" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Batch"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Segera Kadaluarsa (\u22642 hari)"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, stat.kritis)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Sudah Kadaluarsa"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, stat.kadaluarsa)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Sisa Qty"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.sisa))), stat.kritis + stat.kadaluarsa > 0 && /* @__PURE__ */ React.createElement("div", { className: "alert alert-warning" }, "\u26A0\uFE0F Ada ", /* @__PURE__ */ React.createElement("b", null, stat.kritis + stat.kadaluarsa, " batch"), " perlu tindakan segera. Prioritaskan menjual/mengolah batch terdekat kadaluarsa."), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u23F3"), " Catat Batch Produksi")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Produk *"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.produk_id, onChange: (e) => setForm({ ...form, produk_id: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih produk \u2014"), produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.nama_produk)))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kode Batch (opsional)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.batch_id, onChange: (e) => setForm({ ...form, batch_id: e.target.value }), placeholder: "otomatis" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Qty *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.qty, onChange: (e) => setForm({ ...form, qty: e.target.value }), placeholder: "0" }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal Produksi"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tgl_produksi, onChange: (e) => setForm({ ...form, tgl_produksi: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Masa Simpan (hari)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.masa_simpan, onChange: (e) => setForm({ ...form, masa_simpan: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal Kadaluarsa"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tgl_kadaluarsa, onChange: (e) => setForm({ ...form, tgl_kadaluarsa: e.target.value }) }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Terisi otomatis dari produksi + masa simpan"))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\uFF0B Catat Batch")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4E6}"), " Daftar Batch"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, [
    { k: "perlu", l: "\u26A0\uFE0F Perlu Tindakan" },
    { k: "semua", l: "Semua" },
    { k: "aman", l: "Aman" },
    { k: "kadaluarsa", l: "Kadaluarsa" }
  ].map((f) => /* @__PURE__ */ React.createElement("button", { key: f.k, className: `btn btn-sm ${filter === f.k ? "btn-primary" : "btn-outline"}`, onClick: () => setFilter(f.k) }, f.l)))), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u23F3"), /* @__PURE__ */ React.createElement("h3", null, "Tidak ada batch"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catat batch produksi untuk memantau masa simpan.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", null, "Batch"), /* @__PURE__ */ React.createElement("th", null, "Produksi"), /* @__PURE__ */ React.createElement("th", null, "Kadaluarsa"), /* @__PURE__ */ React.createElement("th", null, "Sisa Hari"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Qty"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Sisa"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, d.nama_produk), /* @__PURE__ */ React.createElement("td", { className: "text-xs text-muted" }, d.batch_id || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, tglID(d.tgl_produksi)), /* @__PURE__ */ React.createElement("td", { className: "text-sm" }, tglID(d.tgl_kadaluarsa)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("b", { className: d.sisaHari === null ? "" : d.sisaHari < 0 ? "text-danger" : d.sisaHari <= 2 ? "text-warning" : "text-success" }, d.sisaHari === null ? "\u2014" : d.sisaHari < 0 ? `lewat ${Math.abs(d.sisaHari)}h` : `${d.sisaHari} hari`)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, d.qty), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      style: { maxWidth: 80, padding: "4px 8px", textAlign: "right" },
      defaultValue: d.sisa_qty || 0,
      onBlur: (e) => ubahSisa(d, e.target.value)
    }
  )), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${BADGE[d.kondisi]}` }, LABEL[d.kondisi])), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d) }, "\u2715")))))))));
}
