import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { exportCSV, exportPDF } from "../utils/export";
const rp = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const pct = (v) => `${(Number(v) || 0).toFixed(1)}%`;
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const BIAYA_KATEGORI = ["Operasional", "Gaji", "Sewa", "Utilitas", "Marketing", "Lainnya"];
export default function LabaRugi() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transaksi, setTransaksi] = useState([]);
  const [items, setItems] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [toko, setToko] = useState({});
  const now = /* @__PURE__ */ new Date();
  const [preset, setPreset] = useState("bulan");
  const [dari, setDari] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [sampai, setSampai] = useState(toISO(now));
  useEffect(() => {
    const n = /* @__PURE__ */ new Date();
    if (preset === "bulan") {
      setDari(toISO(new Date(n.getFullYear(), n.getMonth(), 1)));
      setSampai(toISO(n));
    } else if (preset === "lalu") {
      const f = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      setDari(toISO(f));
      setSampai(toISO(new Date(n.getFullYear(), n.getMonth(), 0)));
    } else if (preset === "30") {
      setDari(toISO(new Date(n.getTime() - 29 * 864e5)));
      setSampai(toISO(n));
    } else if (preset === "90") {
      setDari(toISO(new Date(n.getTime() - 89 * 864e5)));
      setSampai(toISO(n));
    } else if (preset === "tahun") {
      setDari(toISO(new Date(n.getFullYear(), 0, 1)));
      setSampai(toISO(n));
    }
  }, [preset]);
  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return;
    setLoading(true);
    setError("");
    try {
      const [tRes, cRes, cfgRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("tanggal", `${dari}T00:00:00`).lte("tanggal", `${sampai}T23:59:59`).order("tanggal"),
        supabase.from("cashflow").select("*").gte("tanggal", dari).lte("tanggal", sampai),
        supabase.from("configuration").select("key, value")
      ]);
      if (tRes.error) throw tRes.error;
      const trx = tRes.data || [];
      const ids = trx.map((t) => t.id);
      let it = [];
      if (ids.length) {
        const { data } = await supabase.from("transaction_items").select("*").in("transaksi_id", ids);
        it = data || [];
      }
      setTransaksi(trx);
      setItems(it);
      setCashflow(cRes.data || []);
      const cm = {};
      (cfgRes.data || []).forEach((c) => {
        cm[c.key] = c.value;
      });
      setToko(cm);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [dari, sampai]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const pl = useMemo(() => {
    const pendapatan = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const hpp = items.reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0);
    const labaKotor = pendapatan - hpp;
    const keluar = cashflow.filter((c) => c.jenis === "keluar");
    const perKategori = {};
    keluar.forEach((c) => {
      const k = c.kategori || "Lainnya";
      perKategori[k] = (perKategori[k] || 0) + Number(c.jumlah || 0);
    });
    const TIDAK_DIHITUNG = ["Pembelian Bahan", "Hutang"];
    const biayaOp = Object.entries(perKategori).filter(([k]) => !TIDAK_DIHITUNG.includes(k)).reduce((s, [, v]) => s + v, 0);
    const masukLain = cashflow.filter((c) => c.jenis === "masuk" && !["Penjualan", "Piutang"].includes(c.kategori)).reduce((s, c) => s + Number(c.jumlah || 0), 0);
    const labaBersih = labaKotor - biayaOp + masukLain;
    return {
      pendapatan,
      hpp,
      labaKotor,
      biayaOp,
      masukLain,
      labaBersih,
      perKategori,
      marginKotor: pendapatan > 0 ? labaKotor / pendapatan * 100 : 0,
      marginBersih: pendapatan > 0 ? labaBersih / pendapatan * 100 : 0,
      jumlahTrx: transaksi.length,
      rataTrx: transaksi.length ? pendapatan / transaksi.length : 0
    };
  }, [transaksi, items, cashflow]);
  const kolomCSV = [
    { key: "label", label: "Keterangan" },
    { key: "nilai", label: "Nilai" },
    { key: "persen", label: "% dari Pendapatan" }
  ];
  const barisCSV = [
    { label: "Pendapatan Penjualan", nilai: pl.pendapatan, persen: "100%" },
    { label: "HPP", nilai: -pl.hpp, persen: pct(-(pl.hpp / (pl.pendapatan || 1)) * 100) },
    { label: "LABA KOTOR", nilai: pl.labaKotor, persen: pct(pl.marginKotor) },
    ...Object.entries(pl.perKategori).filter(([k]) => !["Pembelian Bahan", "Hutang"].includes(k)).map(([k, v]) => ({ label: `Biaya ${k}`, nilai: -v, persen: pct(-(v / (pl.pendapatan || 1)) * 100) })),
    { label: "Total Biaya Operasional", nilai: -pl.biayaOp, persen: pct(-(pl.biayaOp / (pl.pendapatan || 1)) * 100) },
    ...pl.masukLain ? [{ label: "Pendapatan Lain", nilai: pl.masukLain, persen: pct(pl.masukLain / (pl.pendapatan || 1) * 100) }] : [],
    { label: "LABA BERSIH", nilai: pl.labaBersih, persen: pct(pl.marginBersih) }
  ];
  const Baris = ({ label, nilai, persen, bold, negatif, border }) => /* @__PURE__ */ jsxs("div", { className: `pl-row ${bold ? "pl-bold" : ""} ${border ? "pl-border" : ""}`, children: [
    /* @__PURE__ */ jsx("span", { children: label }),
    /* @__PURE__ */ jsx("span", { className: nilai < 0 ? "text-danger" : negatif ? "text-danger" : "", children: rp(nilai) }),
    /* @__PURE__ */ jsx("span", { className: "text-muted text-sm", children: persen })
  ] });
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Laporan Laba Rugi", subtitle: "Pendapatan, biaya, dan laba bersih", children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 16 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        [
          { k: "bulan", l: "Bulan Ini" },
          { k: "lalu", l: "Bulan Lalu" },
          { k: "30", l: "30 Hari" },
          { k: "90", l: "90 Hari" },
          { k: "tahun", l: "Tahun Ini" },
          { k: "custom", l: "Custom" }
        ].map((p) => /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${preset === p.k ? "btn-primary" : "btn-outline"}`, onClick: () => setPreset(p.k), children: p.l }, p.k)),
        preset === "custom" && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", style: { width: "100%", marginTop: 8 }, children: [
          /* @__PURE__ */ jsx("input", { type: "date", className: "form-control", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }),
          /* @__PURE__ */ jsx("span", { className: "text-muted text-sm", children: "s/d" }),
          /* @__PURE__ */ jsx("input", { type: "date", className: "form-control", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 mt-2", children: [
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          "Periode ",
          dari,
          " s/d ",
          sampai
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => exportCSV(barisCSV, kolomCSV, `laba-rugi_${dari}_${sampai}.csv`), children: "\u{1F4CA} Excel/CSV" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => exportPDF("Laporan Laba Rugi", kolomCSV, barisCSV, {
            subjudul: `${toko.nama_toko || "Seruntul"} \xB7 ${dari} s/d ${sampai}`,
            ringkasan: [
              { label: "Pendapatan", value: rp(pl.pendapatan) },
              { label: "Laba Kotor", value: rp(pl.labaKotor) },
              { label: "Laba Bersih", value: rp(pl.labaBersih) },
              { label: "Margin Bersih", value: pct(pl.marginBersih) }
            ]
          }), children: "\u{1F4C4} PDF" })
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Menghitung laporan..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Pendapatan" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: rp(pl.pendapatan) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Laba Kotor" }),
          /* @__PURE__ */ jsx("div", { className: `metric-value ${pl.labaKotor >= 0 ? "text-success" : "text-danger"}`, children: rp(pl.labaKotor) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Biaya Operasional" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: rp(pl.biayaOp) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Laba Bersih" }),
          /* @__PURE__ */ jsx("div", { className: `metric-value ${pl.labaBersih >= 0 ? "text-success" : "text-danger"}`, children: rp(pl.labaBersih) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Margin Kotor" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value", children: pct(pl.marginKotor) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Margin Bersih" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value", children: pct(pl.marginBersih) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4D1}" }),
          " Laporan Laba Rugi"
        ] }) }),
        /* @__PURE__ */ jsx(Row, { label: "PENDAPATAN PENJUALAN", nilai: pl.pendapatan, persen: "100%", bold: true }),
        /* @__PURE__ */ jsx(Baris, { label: "Harga Pokok Penjualan (HPP)", nilai: -pl.hpp, persen: pct(-(pl.hpp / (pl.pendapatan || 1)) * 100) }),
        /* @__PURE__ */ jsx(Baris, { label: "LABA KOTOR", nilai: pl.labaKotor, persen: pct(pl.marginKotor), bold: true, border: true }),
        /* @__PURE__ */ jsx("div", { className: "pl-section", children: "BIAYA OPERASIONAL" }),
        Object.keys(pl.perKategori).filter((k) => !["Pembelian Bahan", "Hutang"].includes(k)).length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", children: "Belum ada biaya operasional tercatat pada periode ini." }) : Object.entries(pl.perKategori).filter(([k]) => !["Pembelian Bahan", "Hutang"].includes(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => /* @__PURE__ */ jsx(Baris, { label: `  ${k}`, nilai: -v, persen: pct(-(v / (pl.pendapatan || 1)) * 100) }, k)),
        /* @__PURE__ */ jsx(Baris, { label: "TOTAL BIAYA OPERASIONAL", nilai: -pl.biayaOp, persen: pct(-(pl.biayaOp / (pl.pendapatan || 1)) * 100), bold: true, border: true }),
        pl.masukLain > 0 && /* @__PURE__ */ jsx(Baris, { label: "Pendapatan Lain-lain", nilai: pl.masukLain, persen: pct(pl.masukLain / (pl.pendapatan || 1) * 100) }),
        /* @__PURE__ */ jsx(Baris, { label: "LABA BERSIH", nilai: pl.labaBersih, persen: pct(pl.marginBersih), bold: true, border: true }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-muted mt-3", children: "Catatan: HPP dihitung dari harga pokok per item yang tersimpan saat transaksi POS. Biaya operasional diambil dari Cashflow (kategori keluar kecuali Pembelian Bahan & Hutang, karena pembelian bahan sudah masuk HPP)." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CA}" }),
          " Ringkasan Penjualan"
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "pl-row", children: [
          /* @__PURE__ */ jsx("span", { children: "Jumlah Transaksi" }),
          /* @__PURE__ */ jsx("span", { children: pl.jumlahTrx }),
          /* @__PURE__ */ jsx("span", {})
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "pl-row", children: [
          /* @__PURE__ */ jsx("span", { children: "Rata-rata per Transaksi" }),
          /* @__PURE__ */ jsx("span", { children: rp(pl.rataTrx) }),
          /* @__PURE__ */ jsx("span", {})
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "pl-row", children: [
          /* @__PURE__ */ jsx("span", { children: "Total Item Terjual" }),
          /* @__PURE__ */ jsx("span", { children: items.reduce((s, i) => s + Number(i.qty || 0), 0) }),
          /* @__PURE__ */ jsx("span", {})
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .pl-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
          padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
        .pl-row > span:nth-child(2) { font-weight: 600; min-width: 110px; text-align: right; }
        .pl-row > span:nth-child(3) { min-width: 60px; text-align: right; }
        .pl-bold { font-weight: 800; }
        .pl-border { border-top: 2px solid var(--border); border-bottom: none; margin-top: 4px; padding-top: 10px; }
        .pl-section { font-size: 11px; font-weight: 700; color: var(--muted); letter-spacing: .5px;
          margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border); }
      ` })
  ] });
}
