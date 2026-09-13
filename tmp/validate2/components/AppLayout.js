import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "./AuthProvider";
import Icon from "./Icons";
const NAV_GROUPS = [
  {
    label: "Kasir",
    items: [
      { icon: "dashboard", title: "Dashboard", href: "/dashboard" },
      { icon: "cart", title: "POS Kasir", href: "/pos" },
      { icon: "receipt", title: "Riwayat Transaksi", href: "/kasir" },
      { icon: "lock", title: "Tutup Kas", href: "/kasir/tutup" },
      { icon: "ticket", title: "Voucher & Promo", href: "/voucher" }
    ]
  },
  {
    label: "Manajemen",
    items: [
      { icon: "box", title: "Inventory", href: "/inventory" },
      { icon: "clipboard", title: "Stok & Opname", href: "/inventory/stok" },
      { icon: "hourglass", title: "Produk Kadaluarsa", href: "/gudang/kadaluarsa" },
      { icon: "trash", title: "Waste Log", href: "/gudang/waste" },
      { icon: "users", title: "Pelanggan", href: "/customers" },
      { icon: "gem", title: "Loyalty & Member", href: "/loyalty" },
      { icon: "handshake", title: "Reseller", href: "/reseller" },
      { icon: "fileText", title: "Produk & HPP", href: "/produk-hpp" },
      { icon: "copy", title: "Duplikat Produk", href: "/produk-hpp/duplikat" },
      { icon: "pot", title: "Resep Produksi", href: "/produksi" },
      { icon: "checkSquare", title: "QC Checklist", href: "/qc" },
      { icon: "pulse", title: "Label Gizi", href: "/label-gizi" },
      { icon: "truck", title: "Supplier", href: "/suppliers" }
    ]
  },
  {
    label: "Pesanan",
    items: [{ icon: "calendar", title: "Pre-Order", href: "/preorder" }]
  },
  {
    label: "SDM",
    items: [{ icon: "userCheck", title: "Karyawan & Absensi", href: "/karyawan" }]
  },
  {
    label: "Keuangan",
    items: [
      { icon: "wallet", title: "Cashflow", href: "/cashflow" },
      { icon: "banknote", title: "Hutang & Piutang", href: "/keuangan/hutang" },
      { icon: "trendingUp", title: "Laporan Penjualan", href: "/laporan" },
      { icon: "barChart", title: "Laba Rugi (P&L)", href: "/laba-rugi" },
      { icon: "target", title: "Target & Budget", href: "/target" }
    ]
  },
  {
    label: "Analisis",
    items: [
      { icon: "stethoscope", title: "Diagnosis Bisnis", href: "/diagnosis" },
      { icon: "trendingDown", title: "Forecast & DOH", href: "/forecast-doh" },
      { icon: "orbit", title: "Simulasi Skenario", href: "/forecast" }
    ]
  },
  {
    label: "Sistem",
    items: [
      { icon: "settings", title: "Pengaturan", href: "/settings" },
      { icon: "sliders", title: "Pengaturan Lanjutan", href: "/pengaturan-lanjutan" },
      { icon: "book", title: "Panduan", href: "/panduan" },
      { icon: "shield", title: "Audit Log", href: "/audit" }
    ]
  }
];
const MOBILE_NAV = [
  { icon: "dashboard", title: "Beranda", href: "/dashboard" },
  { icon: "cart", title: "Kasir", href: "/pos" },
  { icon: "box", title: "Stok", href: "/inventory" },
  { icon: "wallet", title: "Kas", href: "/cashflow" }
];
export default function AppLayout({ children, title, subtitle, actions }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const saved = localStorage.getItem("seruntul-theme") || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("seruntul-theme", next);
  };
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.asPath]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);
  const isActive = (href) => router.pathname === href;
  const nama = user?.email?.split("@")[0] || "User";
  const initial = (user?.email?.[0] || "S").toUpperCase();
  return /* @__PURE__ */ React.createElement("div", { className: "app" }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `sidebar-overlay ${sidebarOpen ? "show" : ""}`,
      onClick: () => setSidebarOpen(false),
      "aria-hidden": "true"
    }
  ), /* @__PURE__ */ React.createElement("aside", { className: `sidebar ${sidebarOpen ? "open" : ""}`, "aria-label": "Menu utama" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar-header" }, /* @__PURE__ */ React.createElement(Link, { href: "/dashboard", className: "sidebar-logo" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar-logo-icon", "aria-hidden": "true" }, "\u{1F41F}"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sidebar-logo-text" }, "Seruntul"), /* @__PURE__ */ React.createElement("div", { className: "sidebar-logo-sub" }, "Entrepreneur Suite"))), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "sidebar-close show-mobile",
      onClick: () => setSidebarOpen(false),
      "aria-label": "Tutup menu"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 18 })
  )), /* @__PURE__ */ React.createElement("nav", { className: "sidebar-nav" }, NAV_GROUPS.map((group) => /* @__PURE__ */ React.createElement("div", { className: "nav-group", key: group.label }, /* @__PURE__ */ React.createElement("div", { className: "nav-group-label" }, group.label), group.items.map((item) => /* @__PURE__ */ React.createElement(
    Link,
    {
      key: item.href,
      href: item.href,
      className: `nav-item ${isActive(item.href) ? "active" : ""}`,
      "aria-current": isActive(item.href) ? "page" : void 0
    },
    /* @__PURE__ */ React.createElement(Icon, { name: item.icon, size: 17 }),
    item.title
  ))))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-footer" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline btn-block", onClick: signOut }, /* @__PURE__ */ React.createElement(Icon, { name: "logout", size: 15 }), "Keluar"))), /* @__PURE__ */ React.createElement("div", { className: "main" }, /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "topbar-inner" }, /* @__PURE__ */ React.createElement("div", { className: "topbar-left" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "menu-toggle show-mobile",
      onClick: () => setSidebarOpen(true),
      "aria-label": "Buka menu",
      "aria-expanded": sidebarOpen
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "menu", size: 18 })
  ), title && /* @__PURE__ */ React.createElement("div", { className: "topbar-title" }, /* @__PURE__ */ React.createElement("div", { className: "page-title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "page-subtitle" }, subtitle))), /* @__PURE__ */ React.createElement("div", { className: "topbar-right" }, actions, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "theme-toggle",
      onClick: toggleTheme,
      "aria-label": theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang",
      title: theme === "light" ? "Tema gelap" : "Tema terang"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: theme === "light" ? "moon" : "sun", size: 16 })
  ), /* @__PURE__ */ React.createElement("div", { className: "avatar", title: user?.email || nama }, initial)))), /* @__PURE__ */ React.createElement("div", { className: "content" }, title ? /* @__PURE__ */ React.createElement("div", { className: "page-header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-title" }, title), subtitle && /* @__PURE__ */ React.createElement("div", { className: "page-subtitle" }, subtitle)), actions && /* @__PURE__ */ React.createElement("div", { className: "header-actions" }, actions)) : null, /* @__PURE__ */ React.createElement("div", { className: "fade-in" }, children))), /* @__PURE__ */ React.createElement("nav", { className: "bottom-nav", "aria-label": "Navigasi cepat" }, MOBILE_NAV.map((item) => /* @__PURE__ */ React.createElement(
    Link,
    {
      key: item.href,
      href: item.href,
      className: `bottom-nav-item ${isActive(item.href) ? "active" : ""}`,
      "aria-current": isActive(item.href) ? "page" : void 0
    },
    /* @__PURE__ */ React.createElement(Icon, { name: item.icon, size: 19 }),
    /* @__PURE__ */ React.createElement("span", null, item.title)
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "bottom-nav-item",
      onClick: () => setSidebarOpen(true),
      "aria-label": "Buka semua menu"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "menu", size: 19 }),
    /* @__PURE__ */ React.createElement("span", null, "Menu")
  )), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .topbar-title { min-width: 0; }
        .topbar-title .page-title {
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .topbar-title .page-subtitle { display: none; }
        @media (min-width: 1024px) {
          .topbar-title { display: none; }
        }
      `));
}
