import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { cetakStruk } from "../../utils/struk";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const tglID = (v) => new Date(v).toLocaleString("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const METODE_LABEL = { cash: "Tunai", qris: "QRIS", transfer: "Transfer", ewallet: "E-Wallet" };
export default function Kasir() {
  const { user } = useAuth();
  const [transaksi, setTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toko, setToko] = useState({});
  const [dari, setDari] = useState(hariIni());
  const [sampai, setSampai] = useState(hariIni());
  const [metodeFilter, setMetodeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [search, setSearch] = useState("");
  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return;
    setLoading(true);
    setError("");
    try {
      const gte = `${dari}T00:00:00`;
      const lte = `${sampai}T23:59:59`;
      const { data: trx, error: e1 } = await supabase.from("transactions").select("*").gte("tanggal", gte).lte("tanggal", lte).order("tanggal", { ascending: false });
      if (e1) throw e1;
      const ids = (trx || []).map((t) => t.id);
      let items = [];
      if (ids.length) {
        const { data: it } = await supabase.from("transaction_items").select("*").in("transaksi_id", ids);
        items = it || [];
      }
      setTransaksi((trx || []).map((t) => ({ ...t, items: items.filter((i) => i.transaksi_id === t.id) })));
      const { data: cfg } = await supabase.from("configuration").select("key, value");
      const cm = {};
      (cfg || []).forEach((c) => {
        cm[c.key] = c.value;
      });
      setToko(cm);
    } catch (e) {
      setError(e.message);
      setTransaksi([]);
    }
    setLoading(false);
  }, [dari, sampai]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const cetak = (t) => cetakStruk({
    ...t,
    nama_toko: toko.nama_toko,
    alamat_toko: toko.alamat_toko,
    telepon_toko: toko.telepon_toko,
    footer_struk: toko.footer_struk
  });
  const filtered = transaksi.filter((t) => {
    const okM = !metodeFilter || t.metode_pembayaran === metodeFilter;
    const okC = !channelFilter || t.channel === channelFilter;
    const hay = `${t.id_transaksi || ""} ${t.customer || ""} ${t.voucher_kode || ""}`.toLowerCase();
    const okS = !search || hay.includes(search.toLowerCase());
    return okM && okC && okS;
  });
  const stat = useMemo(() => {
    const omzet = filtered.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const diskon = filtered.reduce((s, t) => s + Number(t.diskon || 0) + Number(t.diskon_voucher || 0), 0);
    const cash = filtered.filter((t) => t.metode_pembayaran === "cash").reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    return { omzet, diskon, cash, nonCash: omzet - cash, jumlah: filtered.length };
  }, [filtered]);
  return /* @__PURE__ */ React.createElement(
    AppLayout,
    {
      title: "Riwayat Transaksi",
      subtitle: "Cari transaksi & cetak ulang struk",
      actions: /* @__PURE__ */ React.createElement(Link, { href: "/kasir/tutup", className: "btn btn-outline btn-sm" }, "\u{1F512} Tutup Kas")
    },
    error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error),
    /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Omset"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, formatRupiah(stat.omzet))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Transaksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.jumlah)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Tunai"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, formatRupiah(stat.cash))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Non-Tunai"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, formatRupiah(stat.nonCash))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Diskon"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(stat.diskon)))),
    /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }), /* @__PURE__ */ React.createElement("span", { className: "text-muted text-sm" }, "s/d"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 150 }, value: metodeFilter, onChange: (e) => setMetodeFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Metode"), /* @__PURE__ */ React.createElement("option", { value: "cash" }, "Tunai"), /* @__PURE__ */ React.createElement("option", { value: "qris" }, "QRIS"), /* @__PURE__ */ React.createElement("option", { value: "transfer" }, "Transfer"), /* @__PURE__ */ React.createElement("option", { value: "ewallet" }, "E-Wallet")), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 140 }, value: channelFilter, onChange: (e) => setChannelFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Channel"), /* @__PURE__ */ React.createElement("option", { value: "offline" }, "Offline"), /* @__PURE__ */ React.createElement("option", { value: "online" }, "Online"), /* @__PURE__ */ React.createElement("option", { value: "reseller" }, "Reseller")), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        style: { maxWidth: 200 },
        placeholder: "\u{1F50D} No. trx / pelanggan",
        value: search,
        onChange: (e) => setSearch(e.target.value)
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-sm", onClick: fetchData }, "\u{1F504} Muat Ulang"))),
    /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F9FE}"), " Daftar Transaksi"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " transaksi")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F9FE}"), /* @__PURE__ */ React.createElement("h3", null, "Tidak ada transaksi"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Coba ubah rentang tanggal atau filter.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Waktu"), /* @__PURE__ */ React.createElement("th", null, "No. Transaksi"), /* @__PURE__ */ React.createElement("th", null, "Pelanggan"), /* @__PURE__ */ React.createElement("th", null, "Metode"), /* @__PURE__ */ React.createElement("th", null, "Channel"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Item"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Diskon"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((t) => {
      const diskonTotal = Number(t.diskon || 0) + Number(t.diskon_voucher || 0);
      return /* @__PURE__ */ React.createElement("tr", { key: t.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm", style: { whiteSpace: "nowrap" } }, tglID(t.tanggal)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold", style: { fontSize: 12 } }, t.id_transaksi), t.voucher_kode && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, "\u{1F39F}\uFE0F ", t.voucher_kode)), /* @__PURE__ */ React.createElement("td", null, t.customer || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, METODE_LABEL[t.metode_pembayaran] || t.metode_pembayaran)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${t.channel === "reseller" ? "badge-warning" : t.channel === "online" ? "badge-info" : "badge-success"}` }, t.channel || "offline")), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, t.items?.length || 0), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger" }, diskonTotal > 0 ? `\u2212${formatRupiah(diskonTotal)}` : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold text-primary" }, formatRupiah(t.total_bayar)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => cetak(t) }, "\u{1F5A8}\uFE0F")));
    })))))
  );
}
