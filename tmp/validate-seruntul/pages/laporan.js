import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const formatRupiahShort = (v) => {
  const n = Number(v || 0);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}jt`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}rb`;
  return String(n);
};
const formatTanggal = (v) => {
  if (!v) return "\u2014";
  return new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const PRESETS = [
  { id: "hari", label: "Hari Ini" },
  { id: "7", label: "7 Hari" },
  { id: "30", label: "30 Hari" },
  { id: "bulan", label: "Bulan Ini" },
  { id: "custom", label: "Custom" }
];
export default function Laporan() {
  const { user } = useAuth();
  const [transaksi, setTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = /* @__PURE__ */ new Date();
  const [preset, setPreset] = useState("30");
  const [dari, setDari] = useState(toISO(new Date(today.getTime() - 29 * 864e5)));
  const [sampai, setSampai] = useState(toISO(today));
  useEffect(() => {
    const now = /* @__PURE__ */ new Date();
    if (preset === "hari") {
      setDari(toISO(now));
      setSampai(toISO(now));
    } else if (preset === "bulan") {
      setDari(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
      setSampai(toISO(now));
    } else if (preset !== "custom") {
      const n = Number(preset);
      setDari(toISO(new Date(now.getTime() - (n - 1) * 864e5)));
      setSampai(toISO(now));
    }
  }, [preset]);
  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return;
    setLoading(true);
    setError("");
    try {
      const gte = `${dari}T00:00:00`;
      const lte = `${sampai}T23:59:59`;
      const { data: trx, error: e1 } = await supabase.from("transactions").select("*").gte("tanggal", gte).lte("tanggal", lte).order("tanggal", { ascending: true });
      if (e1) throw e1;
      const ids = (trx || []).map((t) => t.id);
      let items = [];
      if (ids.length) {
        const { data: it, error: e2 } = await supabase.from("transaction_items").select("*").in("transaksi_id", ids);
        if (e2) throw e2;
        items = it || [];
      }
      setTransaksi((trx || []).map((t) => ({ ...t, items: items.filter((i) => i.transaksi_id === t.id) })));
    } catch (err) {
      setError(err.message || "Gagal memuat laporan");
      setTransaksi([]);
    }
    setLoading(false);
  }, [dari, sampai]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const ringkas = useMemo(() => {
    const omset = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const jumlah = transaksi.length;
    let hpp = 0;
    const perProduk = {};
    const perMetode = {};
    const perHari = {};
    const perChannel = {};
    transaksi.forEach((t) => {
      const tgl = (t.tanggal || "").slice(0, 10);
      if (!perHari[tgl]) perHari[tgl] = { omset: 0, jumlah: 0 };
      perHari[tgl].omset += Number(t.total_bayar || 0);
      perHari[tgl].jumlah += 1;
      const m = t.metode_pembayaran || "lainnya";
      if (!perMetode[m]) perMetode[m] = { total: 0, jumlah: 0 };
      perMetode[m].total += Number(t.total_bayar || 0);
      perMetode[m].jumlah += 1;
      const c = t.channel || "offline";
      if (!perChannel[c]) perChannel[c] = { total: 0, jumlah: 0 };
      perChannel[c].total += Number(t.total_bayar || 0);
      perChannel[c].jumlah += 1;
      (t.items || []).forEach((i) => {
        const nama = i.nama_produk || "Tanpa nama";
        const qty = Number(i.qty || 0);
        const sub = Number(i.subtotal || 0);
        const h = Number(i.hpp_satuan || 0) * qty;
        hpp += h;
        if (!perProduk[nama]) perProduk[nama] = { qty: 0, omset: 0, hpp: 0 };
        perProduk[nama].qty += qty;
        perProduk[nama].omset += sub;
        perProduk[nama].hpp += h;
      });
    });
    const labaKotor = omset - hpp;
    return {
      omset,
      jumlah,
      hpp,
      labaKotor,
      marginPersen: omset > 0 ? labaKotor / omset * 100 : 0,
      rataRata: jumlah > 0 ? omset / jumlah : 0,
      perProduk: Object.entries(perProduk).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.qty - a.qty),
      perMetode: Object.entries(perMetode).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.total - a.total),
      perChannel: Object.entries(perChannel).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.total - a.total),
      perHari: Object.entries(perHari).map(([tgl, v]) => ({ tgl, ...v })).sort((a, b) => a.tgl.localeCompare(b.tgl))
    };
  }, [transaksi]);
  const maxHarian = Math.max(1, ...ringkas.perHari.map((d) => d.omset));
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Laporan", subtitle: "Analisis penjualan & laba", children: [
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 16 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        PRESETS.map((p) => /* @__PURE__ */ jsx(
          "button",
          {
            className: `btn btn-sm ${preset === p.id ? "btn-primary" : "btn-outline"}`,
            onClick: () => setPreset(p.id),
            children: p.label
          },
          p.id
        )),
        preset === "custom" && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", style: { width: "100%", marginTop: 8 }, children: [
          /* @__PURE__ */ jsx("input", { type: "date", className: "form-control", style: { maxWidth: 170 }, value: dari, onChange: (e) => setDari(e.target.value) }),
          /* @__PURE__ */ jsx("span", { className: "text-muted text-sm", children: "s/d" }),
          /* @__PURE__ */ jsx("input", { type: "date", className: "form-control", style: { maxWidth: 170 }, value: sampai, onChange: (e) => setSampai(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted mt-2", children: [
        formatTanggal(dari),
        " \u2014 ",
        formatTanggal(sampai)
      ] })
    ] }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat laporan..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Omset" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: formatRupiah(ringkas.omset) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total HPP" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(ringkas.hpp) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Laba Kotor" }),
          /* @__PURE__ */ jsx("div", { className: `metric-value ${ringkas.labaKotor >= 0 ? "text-success" : "text-danger"}`, children: formatRupiah(ringkas.labaKotor) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Margin" }),
          /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
            ringkas.marginPersen.toFixed(1),
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Jumlah Transaksi" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value", children: ringkas.jumlah })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
          /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Rata-rata / Transaksi" }),
          /* @__PURE__ */ jsx("div", { className: "metric-value", children: formatRupiah(ringkas.rataRata) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C8}" }),
          " Omset Harian"
        ] }) }),
        ringkas.perHari.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", children: "Tidak ada data pada periode ini." }) : /* @__PURE__ */ jsx("div", { style: { overflowX: "auto", paddingBottom: 4 }, children: /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "flex-end", gap: 6, minHeight: 160, minWidth: ringkas.perHari.length * 44 }, children: ringkas.perHari.map((d) => /* @__PURE__ */ jsxs("div", { style: { flex: "0 0 38px", textAlign: "center" }, title: `${d.tgl}: ${formatRupiah(d.omset)}`, children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", style: { marginBottom: 2 }, children: formatRupiahShort(d.omset) }),
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                height: Math.max(4, d.omset / maxHarian * 110),
                background: "var(--primary, #2563eb)",
                borderRadius: "4px 4px 0 0"
              }
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", style: { marginTop: 4 }, children: [
            d.tgl.slice(8),
            "/",
            d.tgl.slice(5, 7)
          ] })
        ] }, d.tgl)) }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3C6}" }),
            " Produk Terlaris"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
            ringkas.perProduk.length,
            " produk"
          ] })
        ] }),
        ringkas.perProduk.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4E6}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada penjualan" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Data produk muncul setelah ada transaksi di POS." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Produk" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Terjual" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Omset" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Laba" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: ringkas.perProduk.map((p, idx) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsxs("td", { className: "font-bold", children: [
              idx + 1,
              ". ",
              p.nama
            ] }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: p.qty }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(p.omset) }),
            /* @__PURE__ */ jsx("td", { className: `text-right font-bold ${p.omset - p.hpp >= 0 ? "text-success" : "text-danger"}`, children: formatRupiah(p.omset - p.hpp) })
          ] }, p.nama)) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
          /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4B3}" }),
            " Metode Bayar"
          ] }) }),
          ringkas.perMetode.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada data." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Metode" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Transaksi" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: ringkas.perMetode.map((m) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "capitalize font-bold", children: m.nama }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: m.jumlah }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(m.total) })
            ] }, m.nama)) })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
          /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3EA}" }),
            " Channel Penjualan"
          ] }) }),
          ringkas.perChannel.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada data." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Channel" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Transaksi" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: ringkas.perChannel.map((c) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "capitalize font-bold", children: c.nama }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: c.jumlah }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(c.total) })
            ] }, c.nama)) })
          ] }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C5}" }),
          " Rincian Harian"
        ] }) }),
        ringkas.perHari.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada data." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Transaksi" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Omset" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Rata-rata" })
          ] }) }),
          /* @__PURE__ */ jsxs("tbody", { children: [
            [...ringkas.perHari].reverse().map((d) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: formatTanggal(d.tgl) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: d.jumlah }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(d.omset) }),
              /* @__PURE__ */ jsx("td", { className: "text-right text-muted", children: formatRupiah(d.jumlah ? d.omset / d.jumlah : 0) })
            ] }, d.tgl)),
            /* @__PURE__ */ jsxs("tr", { style: { background: "var(--card-alt, rgba(0,0,0,0.03))" }, children: [
              /* @__PURE__ */ jsx("td", { className: "font-extrabold", children: "TOTAL" }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold", children: ringkas.jumlah }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold", children: formatRupiah(ringkas.omset) }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold", children: formatRupiah(ringkas.rataRata) })
            ] })
          ] })
        ] }) })
      ] })
    ] })
  ] });
}
