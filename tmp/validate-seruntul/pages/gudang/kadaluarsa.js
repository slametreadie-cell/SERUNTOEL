import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Produk Kadaluarsa", subtitle: "Pantau masa simpan & batch produksi", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Batch" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Segera Kadaluarsa (\u22642 hari)" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-warning", children: stat.kritis })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Sudah Kadaluarsa" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: stat.kadaluarsa })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Sisa Qty" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.sisa })
      ] })
    ] }),
    stat.kritis + stat.kadaluarsa > 0 && /* @__PURE__ */ jsxs("div", { className: "alert alert-warning", children: [
      "\u26A0\uFE0F Ada ",
      /* @__PURE__ */ jsxs("b", { children: [
        stat.kritis + stat.kadaluarsa,
        " batch"
      ] }),
      " perlu tindakan segera. Prioritaskan menjual/mengolah batch terdekat kadaluarsa."
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u23F3" }),
        " Catat Batch Produksi"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Produk *" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.produk_id, onChange: (e) => setForm({ ...form, produk_id: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih produk \u2014" }),
            produk.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.nama_produk }, p.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kode Batch (opsional)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.batch_id, onChange: (e) => setForm({ ...form, batch_id: e.target.value }), placeholder: "otomatis" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Qty *" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.qty, onChange: (e) => setForm({ ...form, qty: e.target.value }), placeholder: "0" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal Produksi" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tgl_produksi, onChange: (e) => setForm({ ...form, tgl_produksi: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Masa Simpan (hari)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.masa_simpan, onChange: (e) => setForm({ ...form, masa_simpan: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal Kadaluarsa" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tgl_kadaluarsa, onChange: (e) => setForm({ ...form, tgl_kadaluarsa: e.target.value }) }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-muted mt-1", children: "Terisi otomatis dari produksi + masa simpan" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\uFF0B Catat Batch" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4E6}" }),
          " Daftar Batch"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: [
          { k: "perlu", l: "\u26A0\uFE0F Perlu Tindakan" },
          { k: "semua", l: "Semua" },
          { k: "aman", l: "Aman" },
          { k: "kadaluarsa", l: "Kadaluarsa" }
        ].map((f) => /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${filter === f.k ? "btn-primary" : "btn-outline"}`, onClick: () => setFilter(f.k), children: f.l }, f.k)) })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u23F3" }),
        /* @__PURE__ */ jsx("h3", { children: "Tidak ada batch" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Catat batch produksi untuk memantau masa simpan." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Produk" }),
          /* @__PURE__ */ jsx("th", { children: "Batch" }),
          /* @__PURE__ */ jsx("th", { children: "Produksi" }),
          /* @__PURE__ */ jsx("th", { children: "Kadaluarsa" }),
          /* @__PURE__ */ jsx("th", { children: "Sisa Hari" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Qty" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Sisa" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: d.nama_produk }),
          /* @__PURE__ */ jsx("td", { className: "text-xs text-muted", children: d.batch_id || "\u2014" }),
          /* @__PURE__ */ jsx("td", { className: "text-sm text-muted", children: tglID(d.tgl_produksi) }),
          /* @__PURE__ */ jsx("td", { className: "text-sm", children: tglID(d.tgl_kadaluarsa) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("b", { className: d.sisaHari === null ? "" : d.sisaHari < 0 ? "text-danger" : d.sisaHari <= 2 ? "text-warning" : "text-success", children: d.sisaHari === null ? "\u2014" : d.sisaHari < 0 ? `lewat ${Math.abs(d.sisaHari)}h` : `${d.sisaHari} hari` }) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: d.qty }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              style: { maxWidth: 80, padding: "4px 8px", textAlign: "right" },
              defaultValue: d.sisa_qty || 0,
              onBlur: (e) => ubahSisa(d, e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${BADGE[d.kondisi]}`, children: LABEL[d.kondisi] }) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d), children: "\u2715" }) })
        ] }, d.id)) })
      ] }) })
    ] })
  ] });
}
