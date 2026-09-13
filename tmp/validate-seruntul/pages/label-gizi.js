import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Label Gizi", subtitle: "Informasi nilai gizi produk", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Produk Berlabel" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Rata-rata Kalori" }),
        /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
          stat.rataKalori,
          " ",
          /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: "kkal" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Kalori Tertinggi" }),
        /* @__PURE__ */ jsxs("div", { className: "metric-value text-warning", children: [
          stat.tertinggi,
          " ",
          /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: "kkal" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", children: "\u{1F957}" }),
          " ",
          editId ? "Ubah Label Gizi" : "Buat Label Gizi"
        ] }),
        editId && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => {
          setEditId(null);
          setForm(KOSONG);
        }, children: "Batal Edit" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Produk *" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.produk_id, onChange: (e) => pilihProduk(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih produk \u2014" }),
            produk.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.nama_produk }, p.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Takaran Saji" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.takaran_saji, onChange: (e) => setForm({ ...form, takaran_saji: e.target.value }), placeholder: "mis. 100 g / 1 porsi" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "nutri-grid", children: NUTRISI.map((n) => /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsxs("label", { className: "form-label", children: [
          n.l,
          " ",
          /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted", children: [
            "(",
            n.u,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            type: "number",
            step: "0.1",
            value: form[n.k],
            onChange: (e) => setForm({ ...form, [n.k]: e.target.value }),
            placeholder: "0"
          }
        )
      ] }, n.k)) }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            value: form.keterangan,
            onChange: (e) => setForm({ ...form, keterangan: e.target.value }),
            placeholder: "mis. mengandung ikan, kacang"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : editId ? "\u{1F4BE} Perbarui" : "\uFF0B Simpan Label" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
          " Daftar Label"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 220 },
            placeholder: "\u{1F50D} Cari produk...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        )
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F957}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada label gizi" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Buat label untuk mencantumkan informasi gizi pada kemasan." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Produk" }),
          /* @__PURE__ */ jsx("th", { children: "Takaran" }),
          NUTRISI.map((n) => /* @__PURE__ */ jsx("th", { className: "text-right", children: n.l }, n.k)),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: d.nama_produk }),
          /* @__PURE__ */ jsx("td", { className: "text-sm text-muted", children: d.takaran_saji || "\u2014" }),
          NUTRISI.map((n) => /* @__PURE__ */ jsx("td", { className: "text-right", children: Number(d[n.k] || 0).toLocaleString("id-ID") }, n.k)),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setCetak(d), children: "\u{1F3F7}\uFE0F" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => edit(d), children: "\u270F\uFE0F" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d), children: "\u2715" })
          ] }) })
        ] }, d.id)) })
      ] }) })
    ] }),
    cetak && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3F7}\uFE0F" }),
          " Preview Label \u2014 ",
          cetak.nama_produk
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-primary", onClick: () => window.print(), children: "\u{1F5A8}\uFE0F Cetak" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setCetak(null), children: "\u2715" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "label-preview", children: [
        /* @__PURE__ */ jsx("div", { className: "lp-title", children: "INFORMASI NILAI GIZI" }),
        /* @__PURE__ */ jsx("div", { className: "lp-sub", children: cetak.nama_produk }),
        /* @__PURE__ */ jsxs("div", { className: "lp-saji", children: [
          "Takaran saji: ",
          cetak.takaran_saji || "100 g"
        ] }),
        /* @__PURE__ */ jsx("table", { className: "lp-table", children: /* @__PURE__ */ jsxs("tbody", { children: [
          /* @__PURE__ */ jsxs("tr", { className: "lp-head", children: [
            /* @__PURE__ */ jsx("td", { children: "Zat Gizi" }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: "Jumlah" })
          ] }),
          NUTRISI.map((n) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: n.l }),
            /* @__PURE__ */ jsxs("td", { className: "text-right", children: [
              /* @__PURE__ */ jsx("b", { children: Number(cetak[n.k] || 0).toLocaleString("id-ID") }),
              " ",
              n.u
            ] })
          ] }, n.k))
        ] }) }),
        cetak.keterangan && /* @__PURE__ */ jsx("div", { className: "lp-note", children: cetak.keterangan }),
        /* @__PURE__ */ jsxs("div", { className: "lp-foot", children: [
          "Diproduksi: ",
          tglID(cetak.tanggal)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, global: true, children: `
        @media print {
          .sidebar, .topbar, .no-print { display: none !important; }
        }
      ` }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
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
      ` })
  ] });
}
