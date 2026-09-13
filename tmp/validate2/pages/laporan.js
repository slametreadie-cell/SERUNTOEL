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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Laporan", subtitle: "Analisis penjualan & laba" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, PRESETS.map((p) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: p.id,
      className: `btn btn-sm ${preset === p.id ? "btn-primary" : "btn-outline"}`,
      onClick: () => setPreset(p.id)
    },
    p.label
  )), preset === "custom" && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2", style: { width: "100%", marginTop: 8 } }, /* @__PURE__ */ React.createElement("input", { type: "date", className: "form-control", style: { maxWidth: 170 }, value: dari, onChange: (e) => setDari(e.target.value) }), /* @__PURE__ */ React.createElement("span", { className: "text-muted text-sm" }, "s/d"), /* @__PURE__ */ React.createElement("input", { type: "date", className: "form-control", style: { maxWidth: 170 }, value: sampai, onChange: (e) => setSampai(e.target.value) }))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mt-2" }, formatTanggal(dari), " \u2014 ", formatTanggal(sampai))), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat laporan...") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Omset"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, formatRupiah(ringkas.omset))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total HPP"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(ringkas.hpp))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Laba Kotor"), /* @__PURE__ */ React.createElement("div", { className: `metric-value ${ringkas.labaKotor >= 0 ? "text-success" : "text-danger"}` }, formatRupiah(ringkas.labaKotor))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Margin"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, ringkas.marginPersen.toFixed(1), "%")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Jumlah Transaksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, ringkas.jumlah)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Rata-rata / Transaksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, formatRupiah(ringkas.rataRata)))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C8}"), " Omset Harian")), ringkas.perHari.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm" }, "Tidak ada data pada periode ini.") : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto", paddingBottom: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: 6, minHeight: 160, minWidth: ringkas.perHari.length * 44 } }, ringkas.perHari.map((d) => /* @__PURE__ */ React.createElement("div", { key: d.tgl, style: { flex: "0 0 38px", textAlign: "center" }, title: `${d.tgl}: ${formatRupiah(d.omset)}` }, /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted", style: { marginBottom: 2 } }, formatRupiahShort(d.omset)), /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        height: Math.max(4, d.omset / maxHarian * 110),
        background: "var(--primary, #2563eb)",
        borderRadius: "4px 4px 0 0"
      }
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted", style: { marginTop: 4 } }, d.tgl.slice(8), "/", d.tgl.slice(5, 7))))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3C6}"), " Produk Terlaris"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, ringkas.perProduk.length, " produk")), ringkas.perProduk.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4E6}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada penjualan"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Data produk muncul setelah ada transaksi di POS.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Terjual"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Omset"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Laba"))), /* @__PURE__ */ React.createElement("tbody", null, ringkas.perProduk.map((p, idx) => /* @__PURE__ */ React.createElement("tr", { key: p.nama }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, idx + 1, ". ", p.nama), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, p.qty), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(p.omset)), /* @__PURE__ */ React.createElement("td", { className: `text-right font-bold ${p.omset - p.hpp >= 0 ? "text-success" : "text-danger"}` }, formatRupiah(p.omset - p.hpp)))))))), /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4B3}"), " Metode Bayar")), ringkas.perMetode.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada data.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Metode"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Transaksi"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total"))), /* @__PURE__ */ React.createElement("tbody", null, ringkas.perMetode.map((m) => /* @__PURE__ */ React.createElement("tr", { key: m.nama }, /* @__PURE__ */ React.createElement("td", { className: "capitalize font-bold" }, m.nama), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, m.jumlah), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(m.total)))))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3EA}"), " Channel Penjualan")), ringkas.perChannel.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada data.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Channel"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Transaksi"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total"))), /* @__PURE__ */ React.createElement("tbody", null, ringkas.perChannel.map((c) => /* @__PURE__ */ React.createElement("tr", { key: c.nama }, /* @__PURE__ */ React.createElement("td", { className: "capitalize font-bold" }, c.nama), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, c.jumlah), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(c.total))))))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C5}"), " Rincian Harian")), ringkas.perHari.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada data.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Transaksi"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Omset"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Rata-rata"))), /* @__PURE__ */ React.createElement("tbody", null, [...ringkas.perHari].reverse().map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.tgl }, /* @__PURE__ */ React.createElement("td", null, formatTanggal(d.tgl)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, d.jumlah), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(d.omset)), /* @__PURE__ */ React.createElement("td", { className: "text-right text-muted" }, formatRupiah(d.jumlah ? d.omset / d.jumlah : 0)))), /* @__PURE__ */ React.createElement("tr", { style: { background: "var(--card-alt, rgba(0,0,0,0.03))" } }, /* @__PURE__ */ React.createElement("td", { className: "font-extrabold" }, "TOTAL"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold" }, ringkas.jumlah), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold" }, formatRupiah(ringkas.omset)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold" }, formatRupiah(ringkas.rataRata)))))))));
}
