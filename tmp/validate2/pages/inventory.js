import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function Inventory() {
  const { user } = useAuth();
  const simpanEditBahan = async () => {
    if (!editBahan) return;
    if (!editBahan.nama_bahan?.trim()) {
      alert("Nama bahan tidak boleh kosong");
      return;
    }
    await supabase.from("ingredients").update({
      nama_bahan: editBahan.nama_bahan.trim(),
      satuan: editBahan.satuan || "pcs",
      stok_minimum: Number(editBahan.stok_minimum) || 0,
      status: editBahan.status || "aktif"
    }).eq("id", editBahan.id);
    logAudit({ aksi: "ubah_bahan", user, sheetTarget: "ingredients", detail: { nama: editBahan.nama_bahan } });
    setEditBahan(null);
    fetchData();
  };
  const [editBahan, setEditBahan] = useState(null);
  const hapusBahan = async (b) => {
    if (!confirm(`Hapus bahan "${b.nama_bahan}"?

Riwayat harga & pembeliannya ikut terhapus.`)) return;
    const { error: error2 } = await supabase.from("ingredients").delete().eq("id", b.id);
    if (error2) {
      alert("Gagal menghapus: " + error2.message);
      return;
    }
    logAudit({ aksi: "hapus_bahan", user, sheetTarget: "ingredients", detail: { nama: b.nama_bahan } });
    fetchData();
  };
  const hapusPembelian = async (row) => {
    if (!confirm("Hapus catatan pembelian ini?")) return;
    await supabase.from("supplier_purchases").delete().eq("id", row.id);
    fetchData();
  };
  const [tab, setTab] = useState("bahan");
  const [bahan, setBahan] = useState([]);
  const [produkJadi, setProdukJadi] = useState([]);
  const [pembelian, setPembelian] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bahanRes, produkRes, beliRes] = await Promise.all([
        supabase.from("ingredients").select("*").order("nama_bahan"),
        supabase.from("products").select("id, nama_produk, kategori, stok_produk, harga_jual").order("nama_produk"),
        supabase.from("supplier_purchases").select("*, suppliers(nama)").order("tanggal", { ascending: false }).limit(50)
      ]);
      if (bahanRes.error) throw bahanRes.error;
      if (produkRes.error) throw produkRes.error;
      if (beliRes.error) throw beliRes.error;
      setBahan(bahanRes.data || []);
      setProdukJadi(produkRes.data || []);
      setPembelian(beliRes.data || []);
    } catch (e) {
      setError(e.message || "Gagal memuat data inventory");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  const filterBySearch = (list, field) => !search ? list : list.filter((x) => (x[field] || "").toLowerCase().includes(search.toLowerCase()));
  const bahanFiltered = filterBySearch(bahan, "nama_bahan");
  const produkFiltered = filterBySearch(produkJadi, "nama_produk");
  const bahanKritis = bahan.filter((b) => (b.stok_sisa || 0) <= (b.stok_minimum || 5)).length;
  const produkKritis = produkJadi.filter((p) => (p.stok_produk || 0) <= 5).length;
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Inventory", subtitle: "Stok bahan baku, produk jadi, dan riwayat pembelian" }, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Bahan Baku"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, bahan.length), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mt-2" }, bahanKritis, " kritis")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Produk Jadi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, produkJadi.length), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mt-2" }, produkKritis, " stok menipis")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Pembelian"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, pembelian.length), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mt-2" }, "transaksi"))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-3", style: { overflowX: "auto" } }, [
    { key: "bahan", label: "\u{1F9C2} Bahan Baku" },
    { key: "produk", label: "\u{1F4E6} Produk Jadi" },
    { key: "pembelian", label: "\u{1F6D2} Pembelian" }
  ].map((t) => /* @__PURE__ */ React.createElement("button", { key: t.key, className: `btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.key) }, t.label))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      placeholder: `\u{1F50D} Cari ${tab === "bahan" ? "bahan baku" : tab === "produk" ? "produk jadi" : "pembelian"}...`,
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), editBahan && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u270F\uFE0F"), " Ubah Bahan \u2014 ", editBahan.nama_bahan), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setEditBahan(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Bahan"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: editBahan.nama_bahan,
      onChange: (e) => setEditBahan({ ...editBahan, nama_bahan: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Satuan"), /* @__PURE__ */ React.createElement(
    "select",
    {
      className: "form-control",
      value: editBahan.satuan,
      onChange: (e) => setEditBahan({ ...editBahan, satuan: e.target.value })
    },
    ["kg", "gram", "liter", "ml", "pcs", "pack", "ikat", "lusin", "box"].map((s) => /* @__PURE__ */ React.createElement("option", { key: s, value: s }, s))
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stok Minimum"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: editBahan.stok_minimum,
      onChange: (e) => setEditBahan({ ...editBahan, stok_minimum: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-muted" }, "Untuk mengubah ", /* @__PURE__ */ React.createElement("b", null, "jumlah stok"), ", gunakan menu ", /* @__PURE__ */ React.createElement("b", null, "Stok & Opname"), " agar selisihnya tercatat."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setEditBahan(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanEditBahan }, "\u{1F4BE} Simpan"))), loading ? /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center" }, "Memuat...")) : /* @__PURE__ */ React.createElement(React.Fragment, null, tab === "bahan" && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F9C2}"), " Daftar Bahan Baku"), /* @__PURE__ */ React.createElement(Link, { href: "/inventory/tambah-bahan", className: "btn btn-primary btn-sm" }, "\uFF0B Bahan")), bahanFiltered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F9FA}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada bahan baku"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Bahan baku otomatis tercatat saat Anda membuat resep/HPP produk.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Bahan"), /* @__PURE__ */ React.createElement("th", null, "Satuan"), /* @__PURE__ */ React.createElement("th", null, "Stok Sisa"), /* @__PURE__ */ React.createElement("th", null, "Min."), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, bahanFiltered.map((b) => {
    const kritis = (b.stok_sisa || 0) <= (b.stok_minimum || 5);
    return /* @__PURE__ */ React.createElement("tr", { key: b.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, b.nama_bahan), /* @__PURE__ */ React.createElement("td", null, b.satuan || "pcs"), /* @__PURE__ */ React.createElement("td", { className: kritis ? "text-danger font-bold" : "font-bold" }, b.stok_sisa), /* @__PURE__ */ React.createElement("td", { className: "text-muted" }, b.stok_minimum || 5), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${kritis ? "badge-danger" : "badge-success"}` }, kritis ? "Kritis" : "Aman")), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn btn-sm btn-outline",
        onClick: () => setEditBahan({ id: b.id, nama_bahan: b.nama_bahan, satuan: b.satuan || "pcs", stok_minimum: b.stok_minimum || 0, status: b.status || "aktif" })
      },
      "\u270F\uFE0F"
    ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusBahan(b) }, "\u2715"))));
  }))))), tab === "produk" && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4E6}"), " Stok Produk Jadi")), produkFiltered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4E6}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada produk"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan produk di menu Produk & HPP.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", null, "Kategori"), /* @__PURE__ */ React.createElement("th", null, "Harga"), /* @__PURE__ */ React.createElement("th", null, "Stok"), /* @__PURE__ */ React.createElement("th", null, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, produkFiltered.map((p) => {
    const kritis = (p.stok_produk || 0) <= 5;
    return /* @__PURE__ */ React.createElement("tr", { key: p.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, p.nama_produk), /* @__PURE__ */ React.createElement("td", null, p.kategori || "\u2014"), /* @__PURE__ */ React.createElement("td", null, formatRupiah(p.harga_jual)), /* @__PURE__ */ React.createElement("td", { className: kritis ? "text-danger font-bold" : "font-bold" }, p.stok_produk), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${kritis ? "badge-danger" : "badge-success"}` }, kritis ? "Menipis" : "Aman")));
  }))))), tab === "pembelian" && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F6D2}"), " Riwayat Pembelian"), /* @__PURE__ */ React.createElement(Link, { href: "/inventory/tambah-bahan", className: "btn btn-primary btn-sm" }, "\uFF0B Pembelian")), pembelian.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F6D2}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada pembelian"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catat pembelian bahan dari supplier.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Bahan"), /* @__PURE__ */ React.createElement("th", null, "Supplier"), /* @__PURE__ */ React.createElement("th", null, "Qty"), /* @__PURE__ */ React.createElement("th", null, "Total"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, pembelian.map((p) => /* @__PURE__ */ React.createElement("tr", { key: p.id }, /* @__PURE__ */ React.createElement("td", null, p.tanggal), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, p.nama_bahan || "\u2014"), /* @__PURE__ */ React.createElement("td", null, p.suppliers?.nama || "\u2014"), /* @__PURE__ */ React.createElement("td", null, p.qty), /* @__PURE__ */ React.createElement("td", { className: "text-primary font-bold" }, formatRupiah(p.total)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusPembelian(p) }, "\u2715"))))))))));
}
