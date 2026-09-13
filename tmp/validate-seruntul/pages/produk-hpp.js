import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function ProdukHPP() {
  const { user } = useAuth();
  const hapusProduk = async (row, e) => {
    if (e) e.stopPropagation();
    if (!confirm(`Hapus produk "${row.nama_produk}"?

Tindakan ini tidak bisa dibatalkan.`)) return;
    const { error: error2 } = await supabase.from("products").delete().eq("id", row.id);
    if (error2) {
      alert("Gagal menghapus: " + error2.message);
      return;
    }
    logAudit({ aksi: "hapus_produk", user, sheetTarget: "products", detail: { nama: row.nama_produk } });
    fetchData();
  };
  const router = useRouter();
  const [produk, setProduk] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterKategori, setFilterKategori] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [sortBy, setSortBy] = useState("terbaru");
  const fetchProduk = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: error2 } = await supabase.from("products").select("*, product_categories(nama)").order("created_at", { ascending: false });
      if (error2) throw error2;
      setProduk(data || []);
    } catch (e) {
      setError(e.message || "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  }, []);
  const fetchKategori = useCallback(async () => {
    const { data } = await supabase.from("product_categories").select("*").order("nama");
    setKategori(data || []);
  }, []);
  useEffect(() => {
    fetchProduk();
    fetchKategori();
  }, [fetchProduk, fetchKategori]);
  let filtered = produk.filter((p) => {
    const matchKat = !filterKategori || p.kategori === filterKategori || p.kategori_id === filterKategori;
    const matchSearch = !search || (p.nama_produk || "").toLowerCase().includes(search.toLowerCase());
    return matchKat && matchSearch;
  });
  if (sortBy === "nama") filtered = [...filtered].sort((a, b) => (a.nama_produk || "").localeCompare(b.nama_produk));
  else if (sortBy === "harga_tinggi") filtered = [...filtered].sort((a, b) => (b.harga_jual || 0) - (a.harga_jual || 0));
  else if (sortBy === "harga_rendah") filtered = [...filtered].sort((a, b) => (a.harga_jual || 0) - (b.harga_jual || 0));
  else if (sortBy === "margin") filtered = [...filtered].sort((a, b) => (b.margin || 0) - (a.margin || 0));
  else if (sortBy === "stok") filtered = [...filtered].sort((a, b) => (a.stok_produk || 0) - (b.stok_produk || 0));
  const totalProduk = filtered.length;
  const nilaiStok = filtered.reduce((s, p) => s + (p.harga_jual || 0) * (p.stok_produk || 0), 0);
  const stokRendah = filtered.filter((p) => (p.stok_produk || 0) <= 5).length;
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Produk & HPP", subtitle: "Kelola produk, kalkulasi HPP, dan harga jual", children: [
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Produk" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: totalProduk })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Nilai Stok" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: formatRupiah(nilaiStok) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Stok Menipis" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: stokRendah })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 240 },
            placeholder: "\u{1F50D} Cari produk...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        ),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 180 }, value: filterKategori, onChange: (e) => setFilterKategori(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Kategori" }),
          kategori.map((k) => /* @__PURE__ */ jsx("option", { value: k.nama, children: k.nama }, k.id))
        ] }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 170 }, value: sortBy, onChange: (e) => setSortBy(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "terbaru", children: "Terbaru" }),
          /* @__PURE__ */ jsx("option", { value: "nama", children: "Nama A-Z" }),
          /* @__PURE__ */ jsx("option", { value: "harga_tinggi", children: "Harga Tertinggi" }),
          /* @__PURE__ */ jsx("option", { value: "harga_rendah", children: "Harga Terendah" }),
          /* @__PURE__ */ jsx("option", { value: "margin", children: "Margin Tertinggi" }),
          /* @__PURE__ */ jsx("option", { value: "stok", children: "Stok Tersedikit" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${view === "grid" ? "btn-primary" : "btn-outline"}`, onClick: () => setView("grid"), children: "\u25A6" }),
        /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${view === "table" ? "btn-primary" : "btn-outline"}`, onClick: () => setView("table"), children: "\u2630" }),
        /* @__PURE__ */ jsx(Link, { href: "/produk-hpp/duplikat", className: "btn btn-outline", children: "\u{1F4C4} Duplikat" }),
        /* @__PURE__ */ jsx(Link, { href: "/produk-hpp/baru", className: "btn btn-primary", children: "\uFF0B Produk Baru" })
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
      /* @__PURE__ */ jsx("div", { className: "spinner", style: { borderColor: "var(--primary-light)", borderTopColor: "var(--primary)", margin: "0 auto 12px" } }),
      /* @__PURE__ */ jsx("p", { className: "text-muted", children: "Memuat produk..." })
    ] }) }) : filtered.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
      /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 48 }, children: "\u{1F371}" }),
      /* @__PURE__ */ jsx("h3", { children: "Belum ada produk" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan produk pertama Anda untuk mulai menghitung HPP." }),
      /* @__PURE__ */ jsx(Link, { href: "/produk-hpp/baru", className: "btn btn-primary mt-3", children: "\uFF0B Tambah Produk" })
    ] }) }) : view === "grid" ? /* @__PURE__ */ jsx("div", { className: "product-grid", children: filtered.map((p) => /* @__PURE__ */ jsxs(Link, { href: `/produk-hpp/${p.id}`, className: "product-card", children: [
      /* @__PURE__ */ jsx("div", { className: "product-img-wrap", children: p.foto_url ? /* @__PURE__ */ jsx("img", { src: p.foto_url, alt: p.nama_produk }) : /* @__PURE__ */ jsx("div", { className: "product-img-placeholder", children: "\u{1F371}" }) }),
      /* @__PURE__ */ jsxs("div", { className: "product-body", children: [
        /* @__PURE__ */ jsx("div", { className: "product-name", children: p.nama_produk }),
        /* @__PURE__ */ jsx("div", { className: "product-category", children: p.kategori || "Tanpa kategori" }),
        /* @__PURE__ */ jsx("div", { className: "product-price", children: formatRupiah(p.harga_jual) }),
        /* @__PURE__ */ jsxs("div", { className: "product-meta", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "Stok: ",
            /* @__PURE__ */ jsx("b", { className: p.stok_produk <= 5 ? "text-danger" : "", children: p.stok_produk })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: `badge ${p.margin >= 40 ? "badge-success" : p.margin >= 20 ? "badge-warning" : "badge-danger"}`, children: [
            Math.round(p.margin || 0),
            "% margin"
          ] })
        ] })
      ] })
    ] }, p.id)) }) : /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 0 }, children: /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: "Produk" }),
        /* @__PURE__ */ jsx("th", { children: "Kategori" }),
        /* @__PURE__ */ jsx("th", { children: "HPP/Unit" }),
        /* @__PURE__ */ jsx("th", { children: "Harga Jual" }),
        /* @__PURE__ */ jsx("th", { children: "Margin" }),
        /* @__PURE__ */ jsx("th", { children: "Stok" }),
        /* @__PURE__ */ jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: filtered.map((p) => /* @__PURE__ */ jsxs("tr", { onClick: () => router.push(`/produk-hpp/${p.id}`), style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsx("td", { className: "font-bold", children: p.nama_produk }),
        /* @__PURE__ */ jsx("td", { children: p.kategori || "\u2014" }),
        /* @__PURE__ */ jsx("td", { children: formatRupiah(p.hpp_per_unit) }),
        /* @__PURE__ */ jsx("td", { className: "text-primary font-bold", children: formatRupiah(p.harga_jual) }),
        /* @__PURE__ */ jsxs("td", { children: [
          Math.round(p.margin || 0),
          "%"
        ] }),
        /* @__PURE__ */ jsx("td", { className: p.stok_produk <= 5 ? "text-danger font-bold" : "", children: p.stok_produk }),
        /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-sm btn-outline",
              title: "Ubah produk",
              onClick: (e) => {
                e.stopPropagation();
                router.push(`/produk-hpp/${p.id}`);
              },
              children: "\u270F\uFE0F"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-sm btn-danger",
              title: "Hapus produk",
              onClick: (e) => hapusProduk(p, e),
              children: "\u2715"
            }
          )
        ] }) })
      ] }, p.id)) })
    ] }) }) })
  ] });
}
