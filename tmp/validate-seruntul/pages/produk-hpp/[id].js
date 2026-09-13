import { jsx, jsxs } from "react/jsx-runtime";
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
    return /* @__PURE__ */ jsx(AppLayout, { title: "Detail Produk", children: /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsx("p", { className: "text-muted", children: "Memuat..." }) }) });
  }
  if (error || !produk) {
    return /* @__PURE__ */ jsx(AppLayout, { title: "Detail Produk", children: /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
      /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F615}" }),
      /* @__PURE__ */ jsx("h3", { children: error || "Produk tidak ditemukan" }),
      /* @__PURE__ */ jsx(Link, { href: "/produk-hpp", className: "btn btn-outline mt-3", children: "\u2190 Kembali" })
    ] }) }) });
  }
  const rincian = produk.rincian_json || {};
  const margin = Math.round(produk.margin || 0);
  const marginBadge = margin >= 40 ? "badge-success" : margin >= 20 ? "badge-warning" : "badge-danger";
  return /* @__PURE__ */ jsxs(AppLayout, { title: produk.nama_produk, subtitle: "Detail produk & kalkulasi HPP", children: [
    /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "foto-detail", children: produk.foto_url ? /* @__PURE__ */ jsx("img", { src: produk.foto_url, alt: produk.nama_produk }) : /* @__PURE__ */ jsx("div", { className: "foto-placeholder", children: "\u{1F371}" }) }),
        /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: "Kategori" }),
            /* @__PURE__ */ jsx("div", { className: "badge badge-info", children: produk.kategori || "Tanpa kategori" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: "Stok" }),
            /* @__PURE__ */ jsxs("div", { className: `font-bold ${produk.stok_produk <= 5 ? "text-danger" : ""}`, children: [
              produk.stok_produk,
              " unit"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm text-muted", children: "Margin" }),
            /* @__PURE__ */ jsxs("span", { className: `badge ${marginBadge}`, children: [
              margin,
              "%"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-4", children: [
          /* @__PURE__ */ jsx(Link, { href: `/produk-hpp/baru?id=${produk.id}`, className: "btn btn-primary", children: "\u270F\uFE0F Edit Produk" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-danger", onClick: () => setConfirmDelete(true), children: "\u{1F5D1}\uFE0F Hapus" })
        ] }),
        confirmDelete && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger mt-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
            /* @__PURE__ */ jsx("b", { children: "Hapus produk ini?" }),
            /* @__PURE__ */ jsx("br", {}),
            "Tindakan ini tidak bisa dibatalkan."
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setConfirmDelete(false), children: "Batal" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: handleDelete, children: "Ya, Hapus" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9EE}" }),
          " Rincian HPP"
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "hpp-summary", children: [
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Total Bahan Baku" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(rincian.bahan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Total Kemasan" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(rincian.kemasan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Total Operasional" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(rincian.operasional?.reduce((s, r) => s + r.qty * r.harga, 0) || 0) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              "Pajak (",
              rincian.pajak_persen || 0,
              "%)"
            ] }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(rincian.pajak_nominal || 0) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row hpp-total", children: [
            /* @__PURE__ */ jsx("span", { children: "Total HPP" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(produk.total_hpp) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Hasil per Batch" }),
            /* @__PURE__ */ jsxs("b", { children: [
              produk.jumlah_produksi,
              " unit"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row hpp-highlight", children: [
            /* @__PURE__ */ jsx("span", { children: "HPP / Unit" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(produk.hpp_per_unit) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row hpp-highlight", children: [
            /* @__PURE__ */ jsx("span", { children: "Harga Jual" }),
            /* @__PURE__ */ jsx("b", { className: "text-primary", children: formatRupiah(produk.harga_jual) })
          ] })
        ] }),
        rincian.bahan?.length > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
          /* @__PURE__ */ jsx("div", { className: "card-title mb-2", style: { fontSize: 14 }, children: "\u{1F4CB} Bahan Baku" }),
          /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Nama" }),
              /* @__PURE__ */ jsx("th", { children: "Qty" }),
              /* @__PURE__ */ jsx("th", { children: "Harga" }),
              /* @__PURE__ */ jsx("th", { children: "Subtotal" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: rincian.bahan.map((b, i) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: b.nama }),
              /* @__PURE__ */ jsx("td", { children: b.qty }),
              /* @__PURE__ */ jsx("td", { children: formatRupiah(b.harga) }),
              /* @__PURE__ */ jsx("td", { children: formatRupiah(b.qty * b.harga) })
            ] }, i)) })
          ] }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
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
      ` })
  ] });
}
