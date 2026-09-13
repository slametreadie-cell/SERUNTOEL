import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Forecast & DOH", subtitle: "Days on Hand & rekomendasi produksi", children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 16 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { marginBottom: 0, maxWidth: 200 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Periode Analisis" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: hariAnalisis, onChange: (e) => setHariAnalisis(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "7", children: "7 hari" }),
            /* @__PURE__ */ jsx("option", { value: "14", children: "14 hari" }),
            /* @__PURE__ */ jsx("option", { value: "30", children: "30 hari" }),
            /* @__PURE__ */ jsx("option", { value: "60", children: "60 hari" }),
            /* @__PURE__ */ jsx("option", { value: "90", children: "90 hari" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { marginBottom: 0, maxWidth: 200 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Target Stok (hari)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: targetHari, onChange: (e) => setTargetHari(e.target.value) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex-1" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => exportCSV(barisCSV, kolom, `forecast-doh_${toISO(/* @__PURE__ */ new Date())}.csv`), children: "\u{1F4CA} Excel/CSV" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted mt-2", children: [
        /* @__PURE__ */ jsx("b", { children: "DOH (Days on Hand)" }),
        " = berapa hari stok sekarang akan bertahan berdasarkan rata-rata penjualan. DOH kecil = segera habis (perlu produksi), DOH besar = stok menumpuk (modal menganggur)."
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Menghitung forecast..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Produk Dianalisis" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: analisis.rows.length })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Perlu Produksi" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-warning", children: analisis.perluProduksi.length })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Saran Produksi" }),
          /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
            analisis.totalSaran,
            " ",
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: "pcs" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Nilai Stok Tersimpan" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: rp(analisis.totalNilaiStok) })
        ] })
      ] }),
      analisis.perluProduksi.length > 0 && /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3ED}" }),
          " Rencana Produksi"
        ] }) }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted mb-2", children: [
          "Produk berikut perlu diproduksi agar stok mencapai target ",
          targetHari,
          " hari:"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Produk" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Stok" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Rata/hari" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "DOH" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Produksi" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: analisis.perluProduksi.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: r.nama }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: r.stok }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-muted", children: r.perHari.toFixed(1) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: r.doh === Infinity ? "\u221E" : r.doh.toFixed(1) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("b", { className: "text-primary", children: [
              "+",
              r.saranProduksi
            ] }) })
          ] }, r.id)) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C8}" }),
            " Analisis DOH per Produk"
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-sm text-muted", children: "diurutkan dari paling mendesak" })
        ] }),
        analisis.rows.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4C8}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada produk" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan produk untuk melihat forecast." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Produk" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Stok" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Terjual" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Rata/hari" }),
            /* @__PURE__ */ jsx("th", { children: "DOH" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Saran" }),
            /* @__PURE__ */ jsx("th", { children: "Status" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: analisis.rows.map((r) => {
            const pctBar = r.doh === Infinity ? 100 : Math.min(100, r.doh / (Number(targetHari) * 3) * 100);
            return /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "font-bold", children: r.nama }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: r.stok }),
              /* @__PURE__ */ jsx("td", { className: "text-right text-muted", children: r.terjual }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: r.perHari.toFixed(1) }),
              /* @__PURE__ */ jsxs("td", { style: { minWidth: 130 }, children: [
                /* @__PURE__ */ jsx("div", { className: "doh-bar", children: /* @__PURE__ */ jsx("div", { className: "doh-fill", style: {
                  width: `${pctBar}%`,
                  background: ["habis", "kritis"].includes(r.status) ? "var(--danger,#dc3545)" : r.status === "menipis" ? "var(--warning,#d97706)" : r.status === "aman" ? "var(--success,#16a34a)" : "var(--primary,#2563eb)"
                } }) }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: r.doh === Infinity ? "\u221E (tidak terjual)" : `${r.doh.toFixed(1)} hari` })
              ] }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: r.saranProduksi > 0 ? /* @__PURE__ */ jsxs("b", { className: "text-primary", children: [
                "+",
                r.saranProduksi
              ] }) : "\u2014" }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${BADGE[r.status]}`, children: LABEL[r.status] }) })
            ] }, r.id);
          }) })
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .doh-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 3px; }
        .doh-fill { height: 100%; border-radius: 3px; }
      ` })
  ] });
}
