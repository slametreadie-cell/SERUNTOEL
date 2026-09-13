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
  const Baris = ({ label, nilai, persen, bold, negatif, border }) => /* @__PURE__ */ React.createElement("div", { className: `pl-row ${bold ? "pl-bold" : ""} ${border ? "pl-border" : ""}` }, /* @__PURE__ */ React.createElement("span", null, label), /* @__PURE__ */ React.createElement("span", { className: nilai < 0 ? "text-danger" : negatif ? "text-danger" : "" }, rp(nilai)), /* @__PURE__ */ React.createElement("span", { className: "text-muted text-sm" }, persen));
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Laporan Laba Rugi", subtitle: "Pendapatan, biaya, dan laba bersih" }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, [
    { k: "bulan", l: "Bulan Ini" },
    { k: "lalu", l: "Bulan Lalu" },
    { k: "30", l: "30 Hari" },
    { k: "90", l: "90 Hari" },
    { k: "tahun", l: "Tahun Ini" },
    { k: "custom", l: "Custom" }
  ].map((p) => /* @__PURE__ */ React.createElement("button", { key: p.k, className: `btn btn-sm ${preset === p.k ? "btn-primary" : "btn-outline"}`, onClick: () => setPreset(p.k) }, p.l)), preset === "custom" && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2", style: { width: "100%", marginTop: 8 } }, /* @__PURE__ */ React.createElement("input", { type: "date", className: "form-control", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }), /* @__PURE__ */ React.createElement("span", { className: "text-muted text-sm" }, "s/d"), /* @__PURE__ */ React.createElement("input", { type: "date", className: "form-control", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2 mt-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, "Periode ", dari, " s/d ", sampai), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => exportCSV(barisCSV, kolomCSV, `laba-rugi_${dari}_${sampai}.csv`) }, "\u{1F4CA} Excel/CSV"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => exportPDF("Laporan Laba Rugi", kolomCSV, barisCSV, {
    subjudul: `${toko.nama_toko || "Seruntul"} \xB7 ${dari} s/d ${sampai}`,
    ringkasan: [
      { label: "Pendapatan", value: rp(pl.pendapatan) },
      { label: "Laba Kotor", value: rp(pl.labaKotor) },
      { label: "Laba Bersih", value: rp(pl.labaBersih) },
      { label: "Margin Bersih", value: pct(pl.marginBersih) }
    ]
  }) }, "\u{1F4C4} PDF")))), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Menghitung laporan...") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Pendapatan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, rp(pl.pendapatan))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Laba Kotor"), /* @__PURE__ */ React.createElement("div", { className: `metric-value ${pl.labaKotor >= 0 ? "text-success" : "text-danger"}` }, rp(pl.labaKotor))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Biaya Operasional"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, rp(pl.biayaOp))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Laba Bersih"), /* @__PURE__ */ React.createElement("div", { className: `metric-value ${pl.labaBersih >= 0 ? "text-success" : "text-danger"}` }, rp(pl.labaBersih))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Margin Kotor"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, pct(pl.marginKotor))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Margin Bersih"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, pct(pl.marginBersih)))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4D1}"), " Laporan Laba Rugi")), /* @__PURE__ */ React.createElement(Row, { label: "PENDAPATAN PENJUALAN", nilai: pl.pendapatan, persen: "100%", bold: true }), /* @__PURE__ */ React.createElement(Baris, { label: "Harga Pokok Penjualan (HPP)", nilai: -pl.hpp, persen: pct(-(pl.hpp / (pl.pendapatan || 1)) * 100) }), /* @__PURE__ */ React.createElement(Baris, { label: "LABA KOTOR", nilai: pl.labaKotor, persen: pct(pl.marginKotor), bold: true, border: true }), /* @__PURE__ */ React.createElement("div", { className: "pl-section" }, "BIAYA OPERASIONAL"), Object.keys(pl.perKategori).filter((k) => !["Pembelian Bahan", "Hutang"].includes(k)).length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm" }, "Belum ada biaya operasional tercatat pada periode ini.") : Object.entries(pl.perKategori).filter(([k]) => !["Pembelian Bahan", "Hutang"].includes(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => /* @__PURE__ */ React.createElement(Baris, { key: k, label: `  ${k}`, nilai: -v, persen: pct(-(v / (pl.pendapatan || 1)) * 100) })), /* @__PURE__ */ React.createElement(Baris, { label: "TOTAL BIAYA OPERASIONAL", nilai: -pl.biayaOp, persen: pct(-(pl.biayaOp / (pl.pendapatan || 1)) * 100), bold: true, border: true }), pl.masukLain > 0 && /* @__PURE__ */ React.createElement(Baris, { label: "Pendapatan Lain-lain", nilai: pl.masukLain, persen: pct(pl.masukLain / (pl.pendapatan || 1) * 100) }), /* @__PURE__ */ React.createElement(Baris, { label: "LABA BERSIH", nilai: pl.labaBersih, persen: pct(pl.marginBersih), bold: true, border: true }), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-muted mt-3" }, "Catatan: HPP dihitung dari harga pokok per item yang tersimpan saat transaksi POS. Biaya operasional diambil dari Cashflow (kategori keluar kecuali Pembelian Bahan & Hutang, karena pembelian bahan sudah masuk HPP).")), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CA}"), " Ringkasan Penjualan")), /* @__PURE__ */ React.createElement("div", { className: "pl-row" }, /* @__PURE__ */ React.createElement("span", null, "Jumlah Transaksi"), /* @__PURE__ */ React.createElement("span", null, pl.jumlahTrx), /* @__PURE__ */ React.createElement("span", null)), /* @__PURE__ */ React.createElement("div", { className: "pl-row" }, /* @__PURE__ */ React.createElement("span", null, "Rata-rata per Transaksi"), /* @__PURE__ */ React.createElement("span", null, rp(pl.rataTrx)), /* @__PURE__ */ React.createElement("span", null)), /* @__PURE__ */ React.createElement("div", { className: "pl-row" }, /* @__PURE__ */ React.createElement("span", null, "Total Item Terjual"), /* @__PURE__ */ React.createElement("span", null, items.reduce((s, i) => s + Number(i.qty || 0), 0)), /* @__PURE__ */ React.createElement("span", null)))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .pl-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
          padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
        .pl-row > span:nth-child(2) { font-weight: 600; min-width: 110px; text-align: right; }
        .pl-row > span:nth-child(3) { min-width: 60px; text-align: right; }
        .pl-bold { font-weight: 600; }
        .pl-border { border-top: 2px solid var(--border); border-bottom: none; margin-top: 4px; padding-top: 10px; }
        .pl-section { font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: .5px;
          margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border); }
      `));
}
