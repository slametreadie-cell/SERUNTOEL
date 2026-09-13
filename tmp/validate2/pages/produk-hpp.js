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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Produk & HPP", subtitle: "Kelola produk, kalkulasi HPP, dan harga jual" }, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Produk"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, totalProduk)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Nilai Stok"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, formatRupiah(nilaiStok))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Stok Menipis"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, stokRendah))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2", style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 240 },
      placeholder: "\u{1F50D} Cari produk...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  ), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 180 }, value: filterKategori, onChange: (e) => setFilterKategori(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Kategori"), kategori.map((k) => /* @__PURE__ */ React.createElement("option", { key: k.id, value: k.nama }, k.nama))), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 170 }, value: sortBy, onChange: (e) => setSortBy(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "terbaru" }, "Terbaru"), /* @__PURE__ */ React.createElement("option", { value: "nama" }, "Nama A-Z"), /* @__PURE__ */ React.createElement("option", { value: "harga_tinggi" }, "Harga Tertinggi"), /* @__PURE__ */ React.createElement("option", { value: "harga_rendah" }, "Harga Terendah"), /* @__PURE__ */ React.createElement("option", { value: "margin" }, "Margin Tertinggi"), /* @__PURE__ */ React.createElement("option", { value: "stok" }, "Stok Tersedikit"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${view === "grid" ? "btn-primary" : "btn-outline"}`, onClick: () => setView("grid") }, "\u25A6"), /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${view === "table" ? "btn-primary" : "btn-outline"}`, onClick: () => setView("table") }, "\u2630"), /* @__PURE__ */ React.createElement(Link, { href: "/produk-hpp/duplikat", className: "btn btn-outline" }, "\u{1F4C4} Duplikat"), /* @__PURE__ */ React.createElement(Link, { href: "/produk-hpp/baru", className: "btn btn-primary" }, "\uFF0B Produk Baru")))), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), loading ? /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "spinner", style: { borderColor: "var(--primary-light)", borderTopColor: "var(--primary)", margin: "0 auto 12px" } }), /* @__PURE__ */ React.createElement("p", { className: "text-muted" }, "Memuat produk..."))) : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 48 } }, "\u{1F371}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada produk"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan produk pertama Anda untuk mulai menghitung HPP."), /* @__PURE__ */ React.createElement(Link, { href: "/produk-hpp/baru", className: "btn btn-primary mt-3" }, "\uFF0B Tambah Produk"))) : view === "grid" ? /* @__PURE__ */ React.createElement("div", { className: "product-grid" }, filtered.map((p) => /* @__PURE__ */ React.createElement(Link, { key: p.id, href: `/produk-hpp/${p.id}`, className: "product-card" }, /* @__PURE__ */ React.createElement("div", { className: "product-img-wrap" }, p.foto_url ? /* @__PURE__ */ React.createElement("img", { src: p.foto_url, alt: p.nama_produk }) : /* @__PURE__ */ React.createElement("div", { className: "product-img-placeholder" }, "\u{1F371}")), /* @__PURE__ */ React.createElement("div", { className: "product-body" }, /* @__PURE__ */ React.createElement("div", { className: "product-name" }, p.nama_produk), /* @__PURE__ */ React.createElement("div", { className: "product-category" }, p.kategori || "Tanpa kategori"), /* @__PURE__ */ React.createElement("div", { className: "product-price" }, formatRupiah(p.harga_jual)), /* @__PURE__ */ React.createElement("div", { className: "product-meta" }, /* @__PURE__ */ React.createElement("span", null, "Stok: ", /* @__PURE__ */ React.createElement("b", { className: p.stok_produk <= 5 ? "text-danger" : "" }, p.stok_produk)), /* @__PURE__ */ React.createElement("span", { className: `badge ${p.margin >= 40 ? "badge-success" : p.margin >= 20 ? "badge-warning" : "badge-danger"}` }, Math.round(p.margin || 0), "% margin")))))) : /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", null, "Kategori"), /* @__PURE__ */ React.createElement("th", null, "HPP/Unit"), /* @__PURE__ */ React.createElement("th", null, "Harga Jual"), /* @__PURE__ */ React.createElement("th", null, "Margin"), /* @__PURE__ */ React.createElement("th", null, "Stok"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((p) => /* @__PURE__ */ React.createElement("tr", { key: p.id, onClick: () => router.push(`/produk-hpp/${p.id}`), style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, p.nama_produk), /* @__PURE__ */ React.createElement("td", null, p.kategori || "\u2014"), /* @__PURE__ */ React.createElement("td", null, formatRupiah(p.hpp_per_unit)), /* @__PURE__ */ React.createElement("td", { className: "text-primary font-bold" }, formatRupiah(p.harga_jual)), /* @__PURE__ */ React.createElement("td", null, Math.round(p.margin || 0), "%"), /* @__PURE__ */ React.createElement("td", { className: p.stok_produk <= 5 ? "text-danger font-bold" : "" }, p.stok_produk), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-sm btn-outline",
      title: "Ubah produk",
      onClick: (e) => {
        e.stopPropagation();
        router.push(`/produk-hpp/${p.id}`);
      }
    },
    "\u270F\uFE0F"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-sm btn-danger",
      title: "Hapus produk",
      onClick: (e) => hapusProduk(p, e)
    },
    "\u2715"
  ))))))))));
}
