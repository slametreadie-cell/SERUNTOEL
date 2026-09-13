import { jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(
    AppLayout,
    {
      title: "Riwayat Transaksi",
      subtitle: "Cari transaksi & cetak ulang struk",
      actions: /* @__PURE__ */ jsx(Link, { href: "/kasir/tutup", className: "btn btn-outline btn-sm", children: "\u{1F512} Tutup Kas" }),
      children: [
        error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
          "\u26A0\uFE0F ",
          error
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
          /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
            /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Omset" }),
            /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: formatRupiah(stat.omzet) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
            /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Transaksi" }),
            /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.jumlah })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
            /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Tunai" }),
            /* @__PURE__ */ jsx("div", { className: "metric-value text-success", children: formatRupiah(stat.cash) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
            /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Non-Tunai" }),
            /* @__PURE__ */ jsx("div", { className: "metric-value", children: formatRupiah(stat.nonCash) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
            /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Diskon" }),
            /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(stat.diskon) })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }),
          /* @__PURE__ */ jsx("span", { className: "text-muted text-sm", children: "s/d" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 150 }, value: metodeFilter, onChange: (e) => setMetodeFilter(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Semua Metode" }),
            /* @__PURE__ */ jsx("option", { value: "cash", children: "Tunai" }),
            /* @__PURE__ */ jsx("option", { value: "qris", children: "QRIS" }),
            /* @__PURE__ */ jsx("option", { value: "transfer", children: "Transfer" }),
            /* @__PURE__ */ jsx("option", { value: "ewallet", children: "E-Wallet" })
          ] }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 140 }, value: channelFilter, onChange: (e) => setChannelFilter(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Semua Channel" }),
            /* @__PURE__ */ jsx("option", { value: "offline", children: "Offline" }),
            /* @__PURE__ */ jsx("option", { value: "online", children: "Online" }),
            /* @__PURE__ */ jsx("option", { value: "reseller", children: "Reseller" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              style: { maxWidth: 200 },
              placeholder: "\u{1F50D} No. trx / pelanggan",
              value: search,
              onChange: (e) => setSearch(e.target.value)
            }
          ),
          /* @__PURE__ */ jsx("button", { className: "btn btn-outline btn-sm", onClick: fetchData, children: "\u{1F504} Muat Ulang" })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9FE}" }),
              " Daftar Transaksi"
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
              filtered.length,
              " transaksi"
            ] })
          ] }),
          loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
            /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F9FE}" }),
            /* @__PURE__ */ jsx("h3", { children: "Tidak ada transaksi" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Coba ubah rentang tanggal atau filter." })
          ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Waktu" }),
              /* @__PURE__ */ jsx("th", { children: "No. Transaksi" }),
              /* @__PURE__ */ jsx("th", { children: "Pelanggan" }),
              /* @__PURE__ */ jsx("th", { children: "Metode" }),
              /* @__PURE__ */ jsx("th", { children: "Channel" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Item" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Diskon" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total" }),
              /* @__PURE__ */ jsx("th", {})
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: filtered.map((t) => {
              const diskonTotal = Number(t.diskon || 0) + Number(t.diskon_voucher || 0);
              return /* @__PURE__ */ jsxs("tr", { children: [
                /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", style: { whiteSpace: "nowrap" }, children: tglID(t.tanggal) }),
                /* @__PURE__ */ jsxs("td", { children: [
                  /* @__PURE__ */ jsx("div", { className: "font-bold", style: { fontSize: 12 }, children: t.id_transaksi }),
                  t.voucher_kode && /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
                    "\u{1F39F}\uFE0F ",
                    t.voucher_kode
                  ] })
                ] }),
                /* @__PURE__ */ jsx("td", { children: t.customer || "\u2014" }),
                /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: METODE_LABEL[t.metode_pembayaran] || t.metode_pembayaran }) }),
                /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${t.channel === "reseller" ? "badge-warning" : t.channel === "online" ? "badge-info" : "badge-success"}`, children: t.channel || "offline" }) }),
                /* @__PURE__ */ jsx("td", { className: "text-right", children: t.items?.length || 0 }),
                /* @__PURE__ */ jsx("td", { className: "text-right text-danger", children: diskonTotal > 0 ? `\u2212${formatRupiah(diskonTotal)}` : "\u2014" }),
                /* @__PURE__ */ jsx("td", { className: "text-right font-bold text-primary", children: formatRupiah(t.total_bayar) }),
                /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => cetak(t), children: "\u{1F5A8}\uFE0F" }) })
              ] }, t.id);
            }) })
          ] }) })
        ] })
      ]
    }
  );
}
