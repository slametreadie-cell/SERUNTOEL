import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { exportCSV } from "../utils/export";
const rp = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export default function ForecastDOH() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [produk, setProduk] = useState([]);
  const [items, setItems] = useState([]);
  const [trx, setTrx] = useState([]);
  const [hariAnalisis, setHariAnalisis] = useState("30");
  const [targetHari, setTargetHari] = useState("7");
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const n = /* @__PURE__ */ new Date();
      const awal = toISO(new Date(n.getTime() - (Number(hariAnalisis) - 1) * 864e5));
      const akhir = toISO(n);
      const [pRes, tRes] = await Promise.all([
        supabase.from("products").select("id, nama_produk, kategori, stok_produk, hpp_per_unit, harga_jual"),
        supabase.from("transactions").select("id, tanggal").gte("tanggal", `${awal}T00:00:00`).lte("tanggal", `${akhir}T23:59:59`)
      ]);
      if (pRes.error) throw pRes.error;
      setProduk(pRes.data || []);
      const t = tRes.data || [];
      setTrx(t);
      const ids = t.map((x) => x.id);
      if (ids.length) {
        const { data } = await supabase.from("transaction_items").select("produk_id, nama_produk, qty").in("transaksi_id", ids);
        setItems(data || []);
      } else setItems([]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [hariAnalisis]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const analisis = useMemo(() => {
    const hari = Number(hariAnalisis) || 30;
    const target = Number(targetHari) || 7;
    const terjual = {};
    items.forEach((i) => {
      const key = i.produk_id || i.nama_produk;
      terjual[key] = (terjual[key] || 0) + Number(i.qty || 0);
    });
    const rows = produk.map((p) => {
      const qty = terjual[p.id] || 0;
      const perHari = qty / hari;
      const stok = Number(p.stok_produk || 0);
      const doh = perHari > 0 ? stok / perHari : stok > 0 ? Infinity : 0;
      const targetStok = Math.ceil(perHari * target);
      const saranProduksi = Math.max(0, targetStok - stok);
      let status = "aman";
      if (qty === 0 && stok > 0) status = "mati";
      else if (stok <= 0) status = "habis";
      else if (doh < target * 0.5) status = "kritis";
      else if (doh < target) status = "menipis";
      else if (doh > target * 3) status = "menumpuk";
      return {
        id: p.id,
        nama: p.nama_produk,
        kategori: p.kategori,
        stok,
        terjual: qty,
        perHari,
        doh,
        targetStok,
        saranProduksi,
        status,
        nilaiStok: stok * Number(p.hpp_per_unit || 0),
        estimasiHariHabis: doh === Infinity ? null : Math.floor(doh)
      };
    });
    return {
      rows: rows.sort((a, b) => a.doh === Infinity ? 1 : b.doh === Infinity ? -1 : a.doh - b.doh),
      totalNilaiStok: rows.reduce((s, r) => s + r.nilaiStok, 0),
      perluProduksi: rows.filter((r) => r.saranProduksi > 0),
      totalSaran: rows.reduce((s, r) => s + r.saranProduksi, 0)
    };
  }, [produk, items, hariAnalisis, targetHari]);
  const BADGE = { habis: "badge-danger", kritis: "badge-danger", menipis: "badge-warning", aman: "badge-success", menumpuk: "badge-info", mati: "badge-neutral" };
  const LABEL = { habis: "Habis", kritis: "Kritis", menipis: "Menipis", aman: "Aman", menumpuk: "Menumpuk", mati: "Tidak Laku" };
  const kolom = [
    { key: "nama", label: "Produk" },
    { key: "stok", label: "Stok" },
    { key: "terjual", label: `Terjual ${hariAnalisis}hr` },
    { key: "perHari", label: "Rata/hari" },
    { key: "doh", label: "DOH (hari)" },
    { key: "targetStok", label: "Stok Ideal" },
    { key: "saranProduksi", label: "Saran Produksi" },
    { key: "statusLabel", label: "Status" }
  ];
  const barisCSV = analisis.rows.map((r) => ({
    ...r,
    perHari: Number(r.perHari.toFixed(2)),
    doh: r.doh === Infinity ? "\u221E" : Number(r.doh.toFixed(1)),
    statusLabel: LABEL[r.status]
  }));
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Forecast & DOH", subtitle: "Days on Hand & rekomendasi produksi" }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { marginBottom: 0, maxWidth: 200 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Periode Analisis"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: hariAnalisis, onChange: (e) => setHariAnalisis(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "7" }, "7 hari"), /* @__PURE__ */ React.createElement("option", { value: "14" }, "14 hari"), /* @__PURE__ */ React.createElement("option", { value: "30" }, "30 hari"), /* @__PURE__ */ React.createElement("option", { value: "60" }, "60 hari"), /* @__PURE__ */ React.createElement("option", { value: "90" }, "90 hari"))), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { marginBottom: 0, maxWidth: 200 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Target Stok (hari)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: targetHari, onChange: (e) => setTargetHari(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => exportCSV(barisCSV, kolom, `forecast-doh_${toISO(/* @__PURE__ */ new Date())}.csv`) }, "\u{1F4CA} Excel/CSV")), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-muted mt-2" }, /* @__PURE__ */ React.createElement("b", null, "DOH (Days on Hand)"), " = berapa hari stok sekarang akan bertahan berdasarkan rata-rata penjualan. DOH kecil = segera habis (perlu produksi), DOH besar = stok menumpuk (modal menganggur).")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Menghitung forecast...") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Produk Dianalisis"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, analisis.rows.length)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Perlu Produksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, analisis.perluProduksi.length)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Saran Produksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, analisis.totalSaran, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-muted" }, "pcs"))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Nilai Stok Tersimpan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, rp(analisis.totalNilaiStok)))), analisis.perluProduksi.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3ED}"), " Rencana Produksi")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mb-2" }, "Produk berikut perlu diproduksi agar stok mencapai target ", targetHari, " hari:"), /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Stok"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Rata/hari"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "DOH"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Produksi"))), /* @__PURE__ */ React.createElement("tbody", null, analisis.perluProduksi.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, r.nama), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.stok), /* @__PURE__ */ React.createElement("td", { className: "text-right text-muted" }, r.perHari.toFixed(1)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.doh === Infinity ? "\u221E" : r.doh.toFixed(1)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("b", { className: "text-primary" }, "+", r.saranProduksi)))))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C8}"), " Analisis DOH per Produk"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, "diurutkan dari paling mendesak")), analisis.rows.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4C8}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada produk"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan produk untuk melihat forecast.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Stok"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Terjual"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Rata/hari"), /* @__PURE__ */ React.createElement("th", null, "DOH"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Saran"), /* @__PURE__ */ React.createElement("th", null, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, analisis.rows.map((r) => {
    const pctBar = r.doh === Infinity ? 100 : Math.min(100, r.doh / (Number(targetHari) * 3) * 100);
    return /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, r.nama), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.stok), /* @__PURE__ */ React.createElement("td", { className: "text-right text-muted" }, r.terjual), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.perHari.toFixed(1)), /* @__PURE__ */ React.createElement("td", { style: { minWidth: 130 } }, /* @__PURE__ */ React.createElement("div", { className: "doh-bar" }, /* @__PURE__ */ React.createElement("div", { className: "doh-fill", style: {
      width: `${pctBar}%`,
      background: ["habis", "kritis"].includes(r.status) ? "var(--danger,#dc3545)" : r.status === "menipis" ? "var(--warning,#d97706)" : r.status === "aman" ? "var(--success,#16a34a)" : "var(--primary,#2563eb)"
    } })), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, r.doh === Infinity ? "\u221E (tidak terjual)" : `${r.doh.toFixed(1)} hari`)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.saranProduksi > 0 ? /* @__PURE__ */ React.createElement("b", { className: "text-primary" }, "+", r.saranProduksi) : "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${BADGE[r.status]}` }, LABEL[r.status])));
  })))))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .doh-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 3px; }
        .doh-fill { height: 100%; border-radius: 3px; }
      `));
}
