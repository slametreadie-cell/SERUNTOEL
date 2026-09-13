import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
const rp = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export default function Diagnosis() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trx, setTrx] = useState([]);
  const [items, setItems] = useState([]);
  const [produk, setProduk] = useState([]);
  const [cash, setCash] = useState([]);
  const [hutang, setHutang] = useState([]);
  const [waste, setWaste] = useState([]);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const n = /* @__PURE__ */ new Date();
      const awal = toISO(new Date(n.getTime() - 29 * 864e5));
      const akhir = toISO(n);
      const awalBulan = toISO(new Date(n.getFullYear(), n.getMonth(), 1));
      const [tRes, pRes, cRes, hRes, wRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("tanggal", `${awal}T00:00:00`).lte("tanggal", `${akhir}T23:59:59`),
        supabase.from("products").select("id, nama_produk, stok_produk, hpp_per_unit, harga_jual"),
        supabase.from("cashflow").select("*").gte("tanggal", awalBulan).lte("tanggal", akhir),
        supabase.from("receivables_payables").select("*").eq("status", "aktif").limit(500).then((r) => r, () => ({ data: [] })),
        supabase.from("waste_logs").select("*").gte("tanggal", awal).lte("tanggal", akhir)
      ]);
      if (tRes.error) throw tRes.error;
      const t = tRes.data || [];
      setTrx(t);
      setProduk(pRes.data || []);
      setCash(cRes.data || []);
      setHutang(hRes.data || []);
      setWaste(wRes.data || []);
      const ids = t.map((x) => x.id);
      if (ids.length) {
        const { data } = await supabase.from("transaction_items").select("*").in("transaksi_id", ids);
        setItems(data || []);
      } else setItems([]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const diag = useMemo(() => {
    const pendapatan = trx.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const hpp = items.reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0);
    const labaKotor = pendapatan - hpp;
    const marginKotor = pendapatan > 0 ? labaKotor / pendapatan * 100 : 0;
    const biayaOp = cash.filter((c) => c.jenis === "keluar" && !["Pembelian Bahan", "Hutang"].includes(c.kategori)).reduce((s, c) => s + Number(c.jumlah || 0), 0);
    const labaBersih = labaKotor - biayaOp;
    const marginBersih = pendapatan > 0 ? labaBersih / pendapatan * 100 : 0;
    const perProduk = {};
    items.forEach((i) => {
      const n = i.nama_produk || "\u2014";
      if (!perProduk[n]) perProduk[n] = { qty: 0, omset: 0, hpp: 0 };
      perProduk[n].qty += Number(i.qty || 0);
      perProduk[n].omset += Number(i.subtotal || 0);
      perProduk[n].hpp += Number(i.hpp_satuan || 0) * Number(i.qty || 0);
    });
    const produkList = Object.entries(perProduk).map(([nama, v]) => ({
      nama,
      ...v,
      laba: v.omset - v.hpp,
      margin: v.omset > 0 ? (v.omset - v.hpp) / v.omset * 100 : 0
    })).sort((a, b) => b.omset - a.omset);
    const hariSet = new Set(trx.map((t) => (t.tanggal || "").slice(0, 10)));
    const hariAktif = hariSet.size || 1;
    const rataHarian = pendapatan / hariAktif;
    const stokHabis = produk.filter((p) => (p.stok_produk || 0) <= 0);
    const produkTerjual = new Set(items.map((i) => i.nama_produk));
    const produkMati = produk.filter((p) => !produkTerjual.has(p.nama_produk) && (p.stok_produk || 0) > 0);
    const konsentrasi = produkList.length && pendapatan > 0 ? produkList[0].omset / pendapatan * 100 : 0;
    const biayaWaste = waste.reduce((s, w) => s + Number(w.biaya_hpp || 0), 0);
    const rasioWaste = pendapatan > 0 ? biayaWaste / pendapatan * 100 : 0;
    const piutang = hutang.filter((h) => h.jenis === "piutang").reduce((s, h) => s + Number(h.jumlah || 0), 0);
    const hutangTotal = hutang.filter((h) => h.jenis === "hutang").reduce((s, h) => s + Number(h.jumlah || 0), 0);
    const skor = {
      profitabilitas: Math.max(0, Math.min(100, Math.round(marginBersih / 20 * 100))),
      // 20% margin = 100
      marginKotor: Math.max(0, Math.min(100, Math.round(marginKotor / 40 * 100))),
      // 40% = 100
      konsistensi: Math.max(0, Math.min(100, Math.round(hariAktif / 30 * 100))),
      diversifikasi: produkList.length === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - Math.max(0, konsentrasi - 30) * 1.4))),
      efisiensiWaste: Math.max(0, Math.min(100, Math.round(100 - rasioWaste * 10))),
      // 0% waste = 100
      likuiditas: piutang + hutangTotal === 0 ? 80 : Math.max(0, Math.min(100, Math.round(100 - hutangTotal / (pendapatan || 1) * 100)))
    };
    const total = Math.round(Object.values(skor).reduce((s, v) => s + v, 0) / Object.keys(skor).length);
    const rekom = [];
    if (marginBersih < 5) rekom.push({ p: "tinggi", t: "Margin bersih sangat tipis", d: `Margin ${marginBersih.toFixed(1)}%. Tinjau harga jual atau tekan HPP. Target minimal 10-15%.` });
    else if (marginBersih < 10) rekom.push({ p: "sedang", t: "Margin bersih masih tipis", d: `Margin ${marginBersih.toFixed(1)}%. Masih bisa ditingkatkan dengan efisiensi bahan atau harga.` });
    else rekom.push({ p: "baik", t: "Margin bersih sehat", d: `Margin ${marginBersih.toFixed(1)}%. Pertahankan struktur biaya saat ini.` });
    if (marginKotor < 30) rekom.push({ p: "sedang", t: "HPP terlalu tinggi terhadap harga jual", d: `HPP memakan ${(100 - marginKotor).toFixed(1)}% dari pendapatan. Cek harga bahan & porsi.` });
    if (konsentrasi > 50) rekom.push({ p: "tinggi", t: "Penjualan terlalu bergantung 1 produk", d: `${konsentrasi.toFixed(0)}% omset dari "${produkList[0]?.nama}". Risiko besar jika produk itu turun.` });
    if (hariAktif < 15) rekom.push({ p: "sedang", t: "Penjualan belum konsisten", d: `Hanya ${hariAktif} hari ada transaksi dalam 30 hari. Pertimbangkan promo di hari sepi.` });
    if (rasioWaste > 3) rekom.push({ p: "tinggi", t: "Waste terlalu besar", d: `Kerugian waste ${rp(biayaWaste)} (${rasioWaste.toFixed(1)}% dari omset). Perbaiki penyimpanan & perkiraan produksi.` });
    if (stokHabis.length > 0) rekom.push({ p: "sedang", t: `${stokHabis.length} produk stoknya habis`, d: `Produk: ${stokHabis.slice(0, 5).map((p) => p.nama_produk).join(", ")}${stokHabis.length > 5 ? ` +${stokHabis.length - 5} lagi` : ""}. Isi ulang agar tidak kehilangan penjualan.` });
    if (produkMati.length > 0) rekom.push({ p: "rendah", t: `${produkMati.length} produk tidak terjual 30 hari`, d: `Produk: ${produkMati.slice(0, 5).map((p) => p.nama_produk).join(", ")}. Pertimbangkan promo atau hentikan produksi.` });
    if (piutang > 0) rekom.push({ p: "rendah", t: "Ada piutang belum tertagih", d: `Total ${rp(piutang)}. Tagih agar arus kas lancar.` });
    if (hutangTotal > pendapatan * 0.5) rekom.push({ p: "tinggi", t: "Hutang besar dibanding pendapatan", d: `Hutang ${rp(hutangTotal)} vs pendapatan 30 hari ${rp(pendapatan)}. Prioritaskan pelunasan.` });
    if (labaBersih < 0) rekom.push({ p: "tinggi", t: "Bisnis sedang RUGI", d: `Rugi ${rp(Math.abs(labaBersih))} pada periode ini. Tinjau harga, HPP, dan biaya operasional.` });
    return {
      pendapatan,
      hpp,
      labaKotor,
      biayaOp,
      labaBersih,
      marginKotor,
      marginBersih,
      produkList,
      hariAktif,
      rataHarian,
      stokHabis,
      produkMati,
      konsentrasi,
      biayaWaste,
      rasioWaste,
      piutang,
      hutangTotal,
      skor,
      total,
      rekom
    };
  }, [trx, items, produk, cash, hutang, waste]);
  const GRADE = diag.total >= 80 ? { g: "A", l: "Sangat Sehat", c: "text-success" } : diag.total >= 65 ? { g: "B", l: "Sehat", c: "text-success" } : diag.total >= 50 ? { g: "C", l: "Cukup", c: "text-warning" } : diag.total >= 35 ? { g: "D", l: "Perlu Perbaikan", c: "text-warning" } : { g: "E", l: "Kritis", c: "text-danger" };
  const KOMPONEN = [
    { k: "profitabilitas", l: "Profitabilitas", d: "Margin bersih (target 20%)" },
    { k: "marginKotor", l: "Efisiensi HPP", d: "Margin kotor (target 40%)" },
    { k: "konsistensi", l: "Konsistensi Penjualan", d: "Hari aktif dalam 30 hari" },
    { k: "diversifikasi", l: "Diversifikasi Produk", d: "Tidak bergantung 1 produk" },
    { k: "efisiensiWaste", l: "Efisiensi Produksi", d: "Rasio waste rendah" },
    { k: "likuiditas", l: "Likuiditas", d: "Beban hutang vs pendapatan" }
  ];
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Diagnosis Bisnis", subtitle: "Skor kesehatan & rekomendasi otomatis", children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Menganalisis data 30 hari terakhir..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "card score-card", children: [
        /* @__PURE__ */ jsxs("div", { className: "score-circle", "data-grade": GRADE.g, children: [
          /* @__PURE__ */ jsx("div", { className: "sc-num", children: diag.total }),
          /* @__PURE__ */ jsx("div", { className: "sc-max", children: "/100" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: "Kesehatan Bisnis Anda" }),
          /* @__PURE__ */ jsxs("div", { className: `score-label ${GRADE.c}`, children: [
            GRADE.g,
            " \u2014 ",
            GRADE.l
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mt-2", children: [
            "Analisis 30 hari terakhir \xB7 ",
            diag.hariAktif,
            " hari aktif \xB7 rata-rata ",
            rp(diag.rataHarian),
            "/hari"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CA}" }),
          " Rincian Skor"
        ] }) }),
        KOMPONEN.map((k) => {
          const v = diag.skor[k.k];
          return /* @__PURE__ */ jsxs("div", { className: "comp-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "comp-info", children: [
              /* @__PURE__ */ jsx("div", { className: "font-bold", children: k.l }),
              /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: k.d })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "comp-bar", children: /* @__PURE__ */ jsx("div", { className: "comp-fill", style: { width: `${v}%`, background: v >= 70 ? "var(--success,#16a34a)" : v >= 45 ? "var(--warning,#d97706)" : "var(--danger,#dc3545)" } }) }),
            /* @__PURE__ */ jsx("div", { className: "comp-val", children: v })
          ] }, k.k);
        })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4A1}" }),
            " Rekomendasi"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
            diag.rekom.length,
            " temuan"
          ] })
        ] }),
        diag.rekom.map((r, i) => /* @__PURE__ */ jsxs("div", { className: `rekom rekom-${r.p}`, children: [
          /* @__PURE__ */ jsx("div", { className: "rekom-icon", children: r.p === "tinggi" ? "\u{1F534}" : r.p === "sedang" ? "\u{1F7E0}" : r.p === "baik" ? "\u{1F7E2}" : "\u{1F535}" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold", children: r.t }),
            /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: r.d })
          ] })
        ] }, i))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Pendapatan (30 hari)" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: rp(diag.pendapatan) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Laba Bersih" }),
          /* @__PURE__ */ jsx("div", { className: `metric-value ${diag.labaBersih >= 0 ? "text-success" : "text-danger"}`, children: rp(diag.labaBersih) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Margin Bersih" }),
          /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
            diag.marginBersih.toFixed(1),
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Hari Aktif" }),
          /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
            diag.hariAktif,
            " ",
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: "/30" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Kerugian Waste" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: rp(diag.biayaWaste) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Produk Tidak Laku" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value", children: diag.produkMati.length })
        ] })
      ] }),
      diag.produkList.length > 0 && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3C6}" }),
            " Produk Teratas"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
            "konsentrasi ",
            diag.konsentrasi.toFixed(0),
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Produk" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Terjual" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Omset" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Laba" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Margin" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: diag.produkList.slice(0, 10).map((p, i) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsxs("td", { className: "font-bold", children: [
              i + 1,
              ". ",
              p.nama
            ] }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: p.qty }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: rp(p.omset) }),
            /* @__PURE__ */ jsx("td", { className: `text-right ${p.laba >= 0 ? "text-success" : "text-danger"}`, children: rp(p.laba) }),
            /* @__PURE__ */ jsxs("td", { className: "text-right", children: [
              p.margin.toFixed(0),
              "%"
            ] })
          ] }, p.nama)) })
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .score-card { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .score-circle { width: 110px; height: 110px; border-radius: 50%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; border: 6px solid var(--primary); flex-shrink: 0; }
        .score-circle[data-grade="A"], .score-circle[data-grade="B"] { border-color: var(--success,#16a34a); }
        .score-circle[data-grade="C"], .score-circle[data-grade="D"] { border-color: var(--warning,#d97706); }
        .score-circle[data-grade="E"] { border-color: var(--danger,#dc3545); }
        .sc-num { font-size: 34px; font-weight: 800; line-height: 1; }
        .sc-max { font-size: 11px; color: var(--muted); }
        .score-label { font-size: 22px; font-weight: 800; }
        .comp-row { display: grid; grid-template-columns: 1fr 90px 40px; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border); }
        @media (min-width: 700px) { .comp-row { grid-template-columns: 220px 1fr 40px; } }
        .comp-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
        .comp-fill { height: 100%; border-radius: 4px; transition: width .3s; }
        .comp-val { text-align: right; font-weight: 700; }
        .rekom { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--border); }
        .rekom-icon { font-size: 16px; line-height: 1.4; }
      ` })
  ] });
}
