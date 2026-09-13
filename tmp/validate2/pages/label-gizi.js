import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const NUTRISI = [
  { k: "kalori", l: "Kalori", u: "kkal" },
  { k: "protein", l: "Protein", u: "g" },
  { k: "lemak", l: "Lemak", u: "g" },
  { k: "karbohidrat", l: "Karbohidrat", u: "g" },
  { k: "gula", l: "Gula", u: "g" },
  { k: "natrium", l: "Natrium", u: "mg" },
  { k: "serat", l: "Serat", u: "g" }
];
const KOSONG = { produk_id: "", takaran_saji: "100 g", kalori: "", protein: "", lemak: "", karbohidrat: "", gula: "", natrium: "", serat: "", keterangan: "" };
export default function LabelGizi() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(KOSONG);
  const [editId, setEditId] = useState(null);
  const [cetak, setCetak] = useState(null);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [nRes, pRes] = await Promise.all([
      supabase.from("nutrition_labels").select("*").order("tanggal", { ascending: false }),
      supabase.from("products").select("id, nama_produk").order("nama_produk")
    ]);
    if (nRes.error) setError(nRes.error.message);
    setData(nRes.data || []);
    setProduk(pRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const pilihProduk = (id) => {
    const p = produk.find((x) => x.id === id);
    setForm((f) => ({ ...f, produk_id: id }));
  };
  const simpan = async (e) => {
    e.preventDefault();
    const p = produk.find((x) => x.id === form.produk_id);
    if (!p) {
      setError("Pilih produk dulu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        produk_id: p.id,
        nama_produk: p.nama_produk,
        takaran_saji: form.takaran_saji || null,
        kalori: Number(form.kalori) || 0,
        protein: Number(form.protein) || 0,
        lemak: Number(form.lemak) || 0,
        karbohidrat: Number(form.karbohidrat) || 0,
        gula: Number(form.gula) || 0,
        natrium: Number(form.natrium) || 0,
        serat: Number(form.serat) || 0,
        keterangan: form.keterangan || null,
        tanggal: hariIni()
      };
      if (editId) {
        const { error: error2 } = await supabase.from("nutrition_labels").update(payload).eq("id", editId);
        if (error2) throw error2;
      } else {
        const { error: error2 } = await supabase.from("nutrition_labels").insert(payload);
        if (error2) throw error2;
      }
      logAudit({
        aksi: editId ? "ubah_label_gizi" : "tambah_label_gizi",
        user,
        sheetTarget: "nutrition_labels",
        detail: { produk: p.nama_produk, kalori: payload.kalori }
      });
      setMsg(editId ? "\u2705 Label diperbarui" : "\u2705 Label gizi disimpan");
      setForm(KOSONG);
      setEditId(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const edit = (row) => {
    setEditId(row.id);
    setForm({
      produk_id: row.produk_id || "",
      takaran_saji: row.takaran_saji || "",
      kalori: String(row.kalori ?? ""),
      protein: String(row.protein ?? ""),
      lemak: String(row.lemak ?? ""),
      karbohidrat: String(row.karbohidrat ?? ""),
      gula: String(row.gula ?? ""),
      natrium: String(row.natrium ?? ""),
      serat: String(row.serat ?? ""),
      keterangan: row.keterangan || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hapus = async (row) => {
    if (!confirm(`Hapus label ${row.nama_produk}?`)) return;
    await supabase.from("nutrition_labels").delete().eq("id", row.id);
    fetchData();
  };
  const filtered = data.filter((d) => !search || (d.nama_produk || "").toLowerCase().includes(search.toLowerCase()));
  const stat = useMemo(() => ({
    total: data.length,
    rataKalori: data.length ? Math.round(data.reduce((s, d) => s + Number(d.kalori || 0), 0) / data.length) : 0,
    tertinggi: data.length ? Math.max(...data.map((d) => Number(d.kalori || 0))) : 0
  }), [data]);
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Label Gizi", subtitle: "Informasi nilai gizi produk" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Produk Berlabel"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Rata-rata Kalori"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.rataKalori, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-muted" }, "kkal"))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Kalori Tertinggi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, stat.tertinggi, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-muted" }, "kkal")))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon" }, "\u{1F957}"), " ", editId ? "Ubah Label Gizi" : "Buat Label Gizi"), editId && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => {
    setEditId(null);
    setForm(KOSONG);
  } }, "Batal Edit")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Produk *"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.produk_id, onChange: (e) => pilihProduk(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih produk \u2014"), produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.nama_produk)))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Takaran Saji"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.takaran_saji, onChange: (e) => setForm({ ...form, takaran_saji: e.target.value }), placeholder: "mis. 100 g / 1 porsi" }))), /* @__PURE__ */ React.createElement("div", { className: "nutri-grid" }, NUTRISI.map((n) => /* @__PURE__ */ React.createElement("div", { className: "form-group", key: n.k }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, n.l, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-muted" }, "(", n.u, ")")), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      step: "0.1",
      value: form[n.k],
      onChange: (e) => setForm({ ...form, [n.k]: e.target.value }),
      placeholder: "0"
    }
  )))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.keterangan,
      onChange: (e) => setForm({ ...form, keterangan: e.target.value }),
      placeholder: "mis. mengandung ikan, kacang"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : editId ? "\u{1F4BE} Perbarui" : "\uFF0B Simpan Label")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Daftar Label"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 220 },
      placeholder: "\u{1F50D} Cari produk...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F957}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada label gizi"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Buat label untuk mencantumkan informasi gizi pada kemasan.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", null, "Takaran"), NUTRISI.map((n) => /* @__PURE__ */ React.createElement("th", { key: n.k, className: "text-right" }, n.l)), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, d.nama_produk), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, d.takaran_saji || "\u2014"), NUTRISI.map((n) => /* @__PURE__ */ React.createElement("td", { key: n.k, className: "text-right" }, Number(d[n.k] || 0).toLocaleString("id-ID"))), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setCetak(d) }, "\u{1F3F7}\uFE0F"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => edit(d) }, "\u270F\uFE0F"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d) }, "\u2715"))))))))), cetak && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3F7}\uFE0F"), " Preview Label \u2014 ", cetak.nama_produk), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-primary", onClick: () => window.print() }, "\u{1F5A8}\uFE0F Cetak"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setCetak(null) }, "\u2715"))), /* @__PURE__ */ React.createElement("div", { className: "label-preview" }, /* @__PURE__ */ React.createElement("div", { className: "lp-title" }, "INFORMASI NILAI GIZI"), /* @__PURE__ */ React.createElement("div", { className: "lp-sub" }, cetak.nama_produk), /* @__PURE__ */ React.createElement("div", { className: "lp-saji" }, "Takaran saji: ", cetak.takaran_saji || "100 g"), /* @__PURE__ */ React.createElement("table", { className: "lp-table" }, /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", { className: "lp-head" }, /* @__PURE__ */ React.createElement("td", null, "Zat Gizi"), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, "Jumlah")), NUTRISI.map((n) => /* @__PURE__ */ React.createElement("tr", { key: n.k }, /* @__PURE__ */ React.createElement("td", null, n.l), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("b", null, Number(cetak[n.k] || 0).toLocaleString("id-ID")), " ", n.u))))), cetak.keterangan && /* @__PURE__ */ React.createElement("div", { className: "lp-note" }, cetak.keterangan), /* @__PURE__ */ React.createElement("div", { className: "lp-foot" }, "Diproduksi: ", tglID(cetak.tanggal)))), /* @__PURE__ */ React.createElement("style", { jsx: true, global: true }, `
        @media print {
          .sidebar, .topbar, .no-print { display: none !important; }
        }
      `), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .nutri-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 12px; }
        @media (min-width: 700px) { .nutri-grid { grid-template-columns: repeat(4, 1fr); } }
        .label-preview { max-width: 340px; margin: 0 auto; border: 2px solid #000; border-radius: 6px; padding: 12px; background: #fff; color: #000; }
        .lp-title { font-weight: 800; font-size: 16px; text-align: center; border-bottom: 6px solid #000; padding-bottom: 6px; }
        .lp-sub { font-weight: 700; text-align: center; padding: 6px 0; }
        .lp-saji { font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
        .lp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .lp-table td { padding: 3px 0; border-bottom: 1px solid #ddd; }
        .lp-head td { font-weight: 800; border-bottom: 2px solid #000; }
        .lp-note { font-size: 11px; margin-top: 6px; font-style: italic; }
        .lp-foot { font-size: 11px; margin-top: 8px; text-align: right; }
      `));
}
