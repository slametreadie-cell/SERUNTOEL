import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function ProdukDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [produk, setProduk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fetchProduk = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: error2 } = await supabase.from("products").select("*").eq("id", id).single();
    if (error2) setError(error2.message);
    else setProduk(data);
    setLoading(false);
  }, [id]);
  useEffect(() => {
    fetchProduk();
  }, [fetchProduk]);
  const handleDelete = async () => {
    const { error: error2 } = await supabase.from("products").delete().eq("id", id);
    if (error2) {
      setError(error2.message);
    } else {
      router.push("/produk-hpp");
    }
  };
  if (loading) {
    return /* @__PURE__ */ React.createElement(AppLayout, { title: "Detail Produk" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("p", { className: "text-muted" }, "Memuat...")));
  }
  if (error || !produk) {
    return /* @__PURE__ */ React.createElement(AppLayout, { title: "Detail Produk" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F615}"), /* @__PURE__ */ React.createElement("h3", null, error || "Produk tidak ditemukan"), /* @__PURE__ */ React.createElement(Link, { href: "/produk-hpp", className: "btn btn-outline mt-3" }, "\u2190 Kembali"))));
  }
  const rincian = produk.rincian_json || {};
  const margin = Math.round(produk.margin || 0);
  const marginBadge = margin >= 40 ? "badge-success" : margin >= 20 ? "badge-warning" : "badge-danger";
  return /* @__PURE__ */ React.createElement(AppLayout, { title: produk.nama_produk, subtitle: "Detail produk & kalkulasi HPP" }, /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "foto-detail" }, produk.foto_url ? /* @__PURE__ */ React.createElement("img", { src: produk.foto_url, alt: produk.nama_produk }) : /* @__PURE__ */ React.createElement("div", { className: "foto-placeholder" }, "\u{1F371}")), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Kategori"), /* @__PURE__ */ React.createElement("div", { className: "badge badge-info" }, produk.kategori || "Tanpa kategori")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Stok"), /* @__PURE__ */ React.createElement("div", { className: `font-bold ${produk.stok_produk <= 5 ? "text-danger" : ""}` }, produk.stok_produk, " unit")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Margin"), /* @__PURE__ */ React.createElement("span", { className: `badge ${marginBadge}` }, margin, "%")))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mt-4" }, /* @__PURE__ */ React.createElement(Link, { href: `/produk-hpp/baru?id=${produk.id}`, className: "btn btn-primary" }, "\u270F\uFE0F Edit Produk"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-danger", onClick: () => setConfirmDelete(true) }, "\u{1F5D1}\uFE0F Hapus")), confirmDelete && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("b", null, "Hapus produk ini?"), /* @__PURE__ */ React.createElement("br", null), "Tindakan ini tidak bisa dibatalkan."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setConfirmDelete(false) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: handleDelete }, "Ya, Hapus")))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F9EE}"), " Rincian HPP")), /* @__PURE__ */ React.createElement("div", { className: "hpp-summary" }, /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Total Bahan Baku"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rincian.bahan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Total Kemasan"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rincian.kemasan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Total Operasional"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rincian.operasional?.reduce((s, r) => s + r.qty * r.harga, 0) || 0))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Pajak (", rincian.pajak_persen || 0, "%)"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rincian.pajak_nominal || 0))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row hpp-total" }, /* @__PURE__ */ React.createElement("span", null, "Total HPP"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(produk.total_hpp))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Hasil per Batch"), /* @__PURE__ */ React.createElement("b", null, produk.jumlah_produksi, " unit")), /* @__PURE__ */ React.createElement("div", { className: "hpp-row hpp-highlight" }, /* @__PURE__ */ React.createElement("span", null, "HPP / Unit"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(produk.hpp_per_unit))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row hpp-highlight" }, /* @__PURE__ */ React.createElement("span", null, "Harga Jual"), /* @__PURE__ */ React.createElement("b", { className: "text-primary" }, formatRupiah(produk.harga_jual)))), rincian.bahan?.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, /* @__PURE__ */ React.createElement("div", { className: "card-title mb-2", style: { fontSize: 14 } }, "\u{1F4CB} Bahan Baku"), /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Qty"), /* @__PURE__ */ React.createElement("th", null, "Harga"), /* @__PURE__ */ React.createElement("th", null, "Subtotal"))), /* @__PURE__ */ React.createElement("tbody", null, rincian.bahan.map((b, i) => /* @__PURE__ */ React.createElement("tr", { key: i }, /* @__PURE__ */ React.createElement("td", null, b.nama), /* @__PURE__ */ React.createElement("td", null, b.qty), /* @__PURE__ */ React.createElement("td", null, formatRupiah(b.harga)), /* @__PURE__ */ React.createElement("td", null, formatRupiah(b.qty * b.harga)))))))))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .foto-detail {
          width: 100%; height: 280px; border-radius: var(--radius);
          overflow: hidden; background: var(--bg);
          display: flex; align-items: center; justify-content: center;
        }
        .foto-detail img { width: 100%; height: 100%; object-fit: cover; }
        .foto-placeholder { font-size: 80px; opacity: .4; }
        .hpp-summary { display: flex; flex-direction: column; gap: 8px; }
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
        .hpp-total { font-size: var(--fs-md); border-bottom: 2px solid var(--border); }
        .hpp-highlight { border-bottom: none; background: var(--bg); padding: 12px; border-radius: var(--radius-sm); }
      `));
}
