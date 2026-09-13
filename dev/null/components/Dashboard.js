import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "./AuthProvider";
import AppLayout from "./AppLayout";
import Icon from "./Icons";
import { StatCard, Sparkline, SkeletonStat, SkeletonRows, EmptyBlock, StockBar } from "./DashboardWidgets";
const QUICK_ACCESS = [
  { icon: "cart", title: "POS Kasir", desc: "Transaksi penjualan", href: "/pos" },
  { icon: "box", title: "Inventory", desc: "Stok bahan & produk", href: "/inventory" },
  { icon: "wallet", title: "Cashflow", desc: "Arus kas masuk & keluar", href: "/cashflow" },
  { icon: "users", title: "Pelanggan", desc: "Database & loyalitas", href: "/customers" },
  { icon: "trendingUp", title: "Laporan", desc: "Laba rugi & analisis", href: "/laporan" },
  { icon: "fileText", title: "Produk & HPP", desc: "Kalkulasi harga pokok", href: "/produk-hpp" }
];
const rupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const rupiahShort = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toFixed(1).replace(".", ",")} jt`;
  if (Math.abs(n) >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return `Rp ${n}`;
};
const hariAwal = (offsetHari = 0) => {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - offsetHari);
  d.setHours(0, 0, 0, 0);
  return d;
};
const waktuLalu = (iso) => {
  if (!iso) return "";
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1e3);
  if (detik < 60) return "baru saja";
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  const hari = Math.floor(detik / 86400);
  return hari === 1 ? "kemarin" : `${hari} hari lalu`;
};
const LABEL_AKSI = {
  tambah_transaksi: "Transaksi baru",
  tambah_produk: "Produk ditambahkan",
  tambah_piutang: "Piutang dicatat",
  tambah_hutang: "Hutang dicatat",
  tambah_cashflow: "Cashflow dicatat",
  hapus_produk: "Produk dihapus",
  hapus_transaksi: "Transaksi dihapus",
  login: "Masuk aplikasi"
};
export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const fetchData = useCallback(async () => {
    if (!user) return;
    setError("");
    setLoading(true);
    try {
      const awalHariIni = hariAwal(0);
      const awalKemarin = hariAwal(1);
      const tujuhHari = hariAwal(6);
      const tigaPuluhHari = hariAwal(29);
      const [trxRes, prodRes, custRes, cfRes, rpRes, auditRes, profileRes] = await Promise.all([
        supabase.from("transactions").select("id, id_transaksi, tanggal, total_bayar").gte("tanggal", tigaPuluhHari.toISOString()).order("tanggal", { ascending: false }).limit(500),
        supabase.from("products").select("id, nama_produk, stok_produk, harga_jual, hpp_per_unit").limit(500),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("cashflow").select("jenis, jumlah, tanggal").gte("tanggal", tigaPuluhHari.toISOString().slice(0, 10)).limit(500),
        supabase.from("receivables_payables").select("jenis, jumlah, status").eq("status", "aktif").limit(500),
        supabase.from("audit_logs").select("aksi, user_email, tanggal, detail_json").order("tanggal", { ascending: false }).limit(6),
        supabase.from("users").select("role, nama").eq("id", user.id).maybeSingle()
      ]);
      const transaksi = trxRes.error ? [] : trxRes.data || [];
      const produk = prodRes.error ? [] : prodRes.data || [];
      const cashflow = cfRes.error ? [] : cfRes.data || [];
      const hutangPiutang = rpRes.error ? [] : rpRes.data || [];
      const aktivitas = auditRes.error ? [] : auditRes.data || [];
      const gagalSemua = trxRes.error && prodRes.error && custRes.error;
      if (gagalSemua) throw trxRes.error;
      const hariIni = transaksi.filter((t) => new Date(t.tanggal) >= awalHariIni);
      const kemarin = transaksi.filter((t) => {
        const d = new Date(t.tanggal);
        return d >= awalKemarin && d < awalHariIni;
      });
      const omsetHariIni = hariIni.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
      const omsetKemarin = kemarin.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
      const deltaOmset = omsetKemarin > 0 ? (omsetHariIni - omsetKemarin) / omsetKemarin * 100 : null;
      const seri7 = [];
      for (let i = 6; i >= 0; i--) {
        const mulai = hariAwal(i);
        const sampai = hariAwal(i - 1);
        const total = transaksi.filter((t) => {
          const d = new Date(t.tanggal);
          return d >= mulai && d < sampai;
        }).reduce((s, t) => s + Number(t.total_bayar || 0), 0);
        seri7.push(total);
      }
      const omset7Hari = seri7.reduce((s, v) => s + v, 0);
      const idTrx7 = transaksi.filter((t) => new Date(t.tanggal) >= tujuhHari).map((t) => t.id);
      let terlaris = [];
      if (idTrx7.length) {
        const { data: items } = await supabase.from("transaction_items").select("produk_id, nama_produk, qty, subtotal").in("transaksi_id", idTrx7.slice(0, 200));
        const peta = {};
        (items || []).forEach((it) => {
          const k = it.produk_id || it.nama_produk;
          if (!k) return;
          if (!peta[k]) peta[k] = { nama: it.nama_produk || "Produk", qty: 0, omzet: 0 };
          peta[k].qty += Number(it.qty || 0);
          peta[k].omzet += Number(it.subtotal || 0);
        });
        terlaris = Object.values(peta).sort((a, b) => b.qty - a.qty).slice(0, 5);
      }
      const stokKritis = produk.filter((p) => Number(p.stok_produk || 0) <= 5).sort((a, b) => Number(a.stok_produk || 0) - Number(b.stok_produk || 0)).slice(0, 5);
      const kasHariIni = cashflow.filter((c) => new Date(c.tanggal) >= awalHariIni);
      const kasMasuk = kasHariIni.filter((c) => c.jenis === "masuk").reduce((s, c) => s + Number(c.jumlah || 0), 0);
      const kasKeluar = kasHariIni.filter((c) => c.jenis === "keluar").reduce((s, c) => s + Number(c.jumlah || 0), 0);
      const piutang = hutangPiutang.filter((r) => r.jenis === "piutang").reduce((s, r) => s + Number(r.jumlah || 0), 0);
      const hutang = hutangPiutang.filter((r) => r.jenis === "hutang").reduce((s, r) => s + Number(r.jumlah || 0), 0);
      setData({
        omsetHariIni,
        transaksiHariIni: hariIni.length,
        deltaOmset,
        seri7,
        omset7Hari,
        terlaris,
        stokKritis,
        jumlahProduk: produk.length,
        pelanggan: custRes.error ? 0 : custRes.count || 0,
        kasMasuk,
        kasKeluar,
        piutang,
        hutang,
        aktivitas
      });
      setProfile(profileRes.error ? null : profileRes.data);
    } catch (err) {
      setError(err.message || "Gagal memuat data dari Supabase");
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const nama = profile?.nama || user?.email?.split("@")[0] || "User";
  const role = profile?.role || "user";
  const sapaan = useMemo(() => {
    const jam = (/* @__PURE__ */ new Date()).getHours();
    if (jam < 11) return "Selamat pagi";
    if (jam < 15) return "Selamat siang";
    if (jam < 19) return "Selamat sore";
    return "Selamat malam";
  }, []);
  const tanggal = (/* @__PURE__ */ new Date()).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const tombolRefresh = /* @__PURE__ */ jsxs("button", { className: "btn btn-outline", onClick: fetchData, disabled: loading, "aria-label": "Muat ulang data", children: [
    /* @__PURE__ */ jsx(Icon, { name: "refresh", size: 15 }),
    /* @__PURE__ */ jsx("span", { className: "hide-mobile", children: loading ? "Memuat..." : "Muat Ulang" })
  ] });
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Dashboard", subtitle: tanggal, actions: tombolRefresh, children: [
    /* @__PURE__ */ jsxs("div", { className: "page-header", children: [
      /* @__PURE__ */ jsxs("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "page-title", children: [
          sapaan,
          ", ",
          nama
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "page-subtitle", children: [
          "Ringkasan bisnis Anda hari ini \xB7 ",
          /* @__PURE__ */ jsx("span", { className: "badge badge-success capitalize", children: role })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Link, { href: "/pos", className: "btn btn-primary", children: [
        /* @__PURE__ */ jsx(Icon, { name: "plus", size: 15 }),
        "Transaksi Baru"
      ] })
    ] }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", role: "alert", children: [
      /* @__PURE__ */ jsx(Icon, { name: "alert", size: 16 }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Gagal memuat data." }),
        " ",
        error
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "metrics-grid", children: loading || !data ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(SkeletonStat, {}),
      /* @__PURE__ */ jsx(SkeletonStat, {}),
      /* @__PURE__ */ jsx(SkeletonStat, {}),
      /* @__PURE__ */ jsx(SkeletonStat, {})
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: "Penjualan Hari Ini",
          value: rupiahShort(data.omsetHariIni),
          icon: "trendingUp",
          tone: "primary",
          delta: data.deltaOmset,
          hint: `${data.transaksiHariIni} transaksi`
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: "Omzet 7 Hari",
          value: rupiahShort(data.omset7Hari),
          icon: "barChart",
          hint: "Total seminggu terakhir"
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: "Stok Menipis",
          value: data.stokKritis.length,
          icon: "alert",
          tone: data.stokKritis.length > 0 ? "warning" : "",
          hint: "Produk \u2264 5 unit"
        }
      ),
      /* @__PURE__ */ jsx(
        StatCard,
        {
          label: "Pelanggan",
          value: data.pelanggan,
          icon: "users",
          hint: `${data.jumlahProduk} produk aktif`
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx(Icon, { name: "trendingUp", size: 16 }),
            "Tren Penjualan"
          ] }),
          /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: "7 hari" })
        ] }),
        loading || !data ? /* @__PURE__ */ jsx("div", { className: "skeleton", style: { height: 90 }, "aria-hidden": "true" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between mb-2", children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "stat-value", children: rupiah(data.omset7Hari) }),
            /* @__PURE__ */ jsx("div", { className: "stat-hint", children: "Total 7 hari terakhir" })
          ] }) }),
          /* @__PURE__ */ jsx(
            Sparkline,
            {
              values: data.seri7,
              ariaLabel: `Tren penjualan 7 hari, total ${rupiah(data.omset7Hari)}`
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-muted mt-2", children: [
            /* @__PURE__ */ jsx("span", { children: "6 hari lalu" }),
            /* @__PURE__ */ jsx("span", { children: "Hari ini" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx(Icon, { name: "wallet", size: 16 }),
            "Kas & Tagihan"
          ] }),
          /* @__PURE__ */ jsx(Link, { href: "/cashflow", className: "text-sm text-primary", children: "Kelola" })
        ] }),
        loading || !data ? /* @__PURE__ */ jsx(SkeletonRows, { rows: 3 }) : /* @__PURE__ */ jsxs("div", { className: "list", children: [
          /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
            /* @__PURE__ */ jsx("div", { className: "list-icon", style: { color: "var(--success)" }, children: /* @__PURE__ */ jsx(Icon, { name: "trendingUp", size: 15 }) }),
            /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
              /* @__PURE__ */ jsx("div", { className: "list-title", children: "Kas masuk hari ini" }),
              /* @__PURE__ */ jsx("div", { className: "list-meta", children: "Pemasukan tercatat" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "list-value", style: { color: "var(--success)" }, children: [
              "+",
              rupiahShort(data.kasMasuk)
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
            /* @__PURE__ */ jsx("div", { className: "list-icon", style: { color: "var(--danger)" }, children: /* @__PURE__ */ jsx(Icon, { name: "trendingDown", size: 15 }) }),
            /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
              /* @__PURE__ */ jsx("div", { className: "list-title", children: "Kas keluar hari ini" }),
              /* @__PURE__ */ jsx("div", { className: "list-meta", children: "Pengeluaran tercatat" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "list-value", style: { color: "var(--danger)" }, children: [
              "-",
              rupiahShort(data.kasKeluar)
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
            /* @__PURE__ */ jsx("div", { className: "list-icon", children: /* @__PURE__ */ jsx(Icon, { name: "banknote", size: 15 }) }),
            /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
              /* @__PURE__ */ jsx("div", { className: "list-title", children: "Piutang aktif" }),
              /* @__PURE__ */ jsx("div", { className: "list-meta", children: "Belum dibayar pelanggan" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "list-value", children: rupiahShort(data.piutang) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
            /* @__PURE__ */ jsx("div", { className: "list-icon", children: /* @__PURE__ */ jsx(Icon, { name: "receipt", size: 15 }) }),
            /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
              /* @__PURE__ */ jsx("div", { className: "list-title", children: "Hutang aktif" }),
              /* @__PURE__ */ jsx("div", { className: "list-meta", children: "Kewajiban ke supplier" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "list-value", children: rupiahShort(data.hutang) })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx(Icon, { name: "barChart", size: 16 }),
            "Produk Terlaris"
          ] }),
          /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: "7 hari" })
        ] }),
        loading || !data ? /* @__PURE__ */ jsx(SkeletonRows, { rows: 4 }) : data.terlaris.length === 0 ? /* @__PURE__ */ jsx(
          EmptyBlock,
          {
            icon: "box",
            title: "Belum ada penjualan",
            message: "Data terlaris muncul setelah ada transaksi minggu ini."
          }
        ) : /* @__PURE__ */ jsx("div", { className: "list", children: data.terlaris.map((p, i) => /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
          /* @__PURE__ */ jsx("span", { className: "rank", children: i + 1 }),
          /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
            /* @__PURE__ */ jsx("div", { className: "list-title", children: p.nama }),
            /* @__PURE__ */ jsxs("div", { className: "list-meta", children: [
              p.qty,
              " terjual"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "list-value", children: rupiahShort(p.omzet) })
        ] }, `${p.nama}-${i}`)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx(Icon, { name: "alert", size: 16 }),
            "Stok Menipis"
          ] }),
          /* @__PURE__ */ jsx(Link, { href: "/inventory/stok", className: "text-sm text-primary", children: "Lihat stok" })
        ] }),
        loading || !data ? /* @__PURE__ */ jsx(SkeletonRows, { rows: 4 }) : data.stokKritis.length === 0 ? /* @__PURE__ */ jsx(
          EmptyBlock,
          {
            icon: "checkSquare",
            title: "Stok aman",
            message: "Tidak ada produk di bawah batas minimum. Kerja bagus!"
          }
        ) : /* @__PURE__ */ jsx("div", { className: "list", children: data.stokKritis.map((p) => /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
          /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
            /* @__PURE__ */ jsx("div", { className: "list-title", children: p.nama_produk || "Tanpa nama" }),
            /* @__PURE__ */ jsxs("div", { className: "list-meta", children: [
              "Sisa ",
              Number(p.stok_produk || 0),
              " unit"
            ] }),
            /* @__PURE__ */ jsx(StockBar, { value: p.stok_produk })
          ] }),
          /* @__PURE__ */ jsx(
            "span",
            {
              className: `badge ${Number(p.stok_produk || 0) <= 0 ? "badge-danger" : "badge-warning"}`,
              children: Number(p.stok_produk || 0) <= 0 ? "Habis" : "Rendah"
            }
          )
        ] }, p.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx(Icon, { name: "orbit", size: 16 }),
        "Akses Cepat"
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "grid-3", children: QUICK_ACCESS.map((item) => /* @__PURE__ */ jsxs(Link, { href: item.href, className: "quick-card", children: [
        /* @__PURE__ */ jsx("div", { className: "quick-icon", children: /* @__PURE__ */ jsx(Icon, { name: item.icon, size: 19 }) }),
        /* @__PURE__ */ jsxs("div", { style: { minWidth: 0 }, children: [
          /* @__PURE__ */ jsx("div", { className: "quick-title", children: item.title }),
          /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: item.desc })
        ] }),
        /* @__PURE__ */ jsx(Icon, { name: "chevronRight", size: 15, className: "quick-arrow" })
      ] }, item.href)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx(Icon, { name: "pulse", size: 16 }),
          "Aktivitas Terbaru"
        ] }),
        /* @__PURE__ */ jsx(Link, { href: "/audit", className: "text-sm text-primary", children: "Lihat semua" })
      ] }),
      loading || !data ? /* @__PURE__ */ jsx(SkeletonRows, { rows: 4 }) : data.aktivitas.length === 0 ? /* @__PURE__ */ jsx(
        EmptyBlock,
        {
          icon: "inbox",
          title: "Belum ada aktivitas",
          message: "Riwayat akan tercatat otomatis saat Anda mulai bekerja.",
          action: /* @__PURE__ */ jsx(Link, { href: "/pos", className: "btn btn-primary mt-3", children: "Mulai Transaksi" })
        }
      ) : /* @__PURE__ */ jsx("div", { className: "list", children: data.aktivitas.map((a, i) => /* @__PURE__ */ jsxs("div", { className: "list-item", children: [
        /* @__PURE__ */ jsx("div", { className: "list-icon", children: /* @__PURE__ */ jsx(Icon, { name: "pulse", size: 15 }) }),
        /* @__PURE__ */ jsxs("div", { className: "list-body", children: [
          /* @__PURE__ */ jsx("div", { className: "list-title", children: LABEL_AKSI[a.aksi] || a.aksi || "Aktivitas" }),
          /* @__PURE__ */ jsxs("div", { className: "list-meta", children: [
            a.user_email || "sistem",
            " \xB7 ",
            waktuLalu(a.tanggal)
          ] })
        ] })
      ] }, i)) })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .quick-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--card);
          transition: border-color 0.12s, background 0.12s;
        }
        .quick-card:hover {
          border-color: var(--primary);
          background: var(--primary-light);
        }
        .quick-icon {
          width: 38px;
          height: 38px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--card-alt);
          border: 1px solid var(--border);
          color: var(--primary);
          flex-shrink: 0;
        }
        .quick-title {
          font-weight: 500;
          font-size: var(--fs-base);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .quick-card :global(.quick-arrow) {
          margin-left: auto;
          color: var(--muted);
          opacity: 0;
          transition: opacity 0.12s, transform 0.12s;
        }
        .quick-card:hover :global(.quick-arrow) {
          opacity: 1;
        }
      ` })
  ] });
}
