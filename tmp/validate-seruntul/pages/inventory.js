import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Inventory", subtitle: "Stok bahan baku, produk jadi, dan riwayat pembelian", children: [
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Bahan Baku" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: bahan.length }),
        /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mt-2", children: [
          bahanKritis,
          " kritis"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Produk Jadi" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: produkJadi.length }),
        /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mt-2", children: [
          produkKritis,
          " stok menipis"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Pembelian" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: pembelian.length }),
        /* @__PURE__ */ jsx("div", { className: "text-sm text-muted mt-2", children: "transaksi" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex gap-2 mb-3", style: { overflowX: "auto" }, children: [
      { key: "bahan", label: "\u{1F9C2} Bahan Baku" },
      { key: "produk", label: "\u{1F4E6} Produk Jadi" },
      { key: "pembelian", label: "\u{1F6D2} Pembelian" }
    ].map((t) => /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.key), children: t.label }, t.key)) }),
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsx(
      "input",
      {
        className: "form-control",
        placeholder: `\u{1F50D} Cari ${tab === "bahan" ? "bahan baku" : tab === "produk" ? "produk jadi" : "pembelian"}...`,
        value: search,
        onChange: (e) => setSearch(e.target.value)
      }
    ) }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    editBahan && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u270F\uFE0F" }),
          " Ubah Bahan \u2014 ",
          editBahan.nama_bahan
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setEditBahan(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Bahan" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: editBahan.nama_bahan,
              onChange: (e) => setEditBahan({ ...editBahan, nama_bahan: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Satuan" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              className: "form-control",
              value: editBahan.satuan,
              onChange: (e) => setEditBahan({ ...editBahan, satuan: e.target.value }),
              children: ["kg", "gram", "liter", "ml", "pcs", "pack", "ikat", "lusin", "box"].map((s) => /* @__PURE__ */ jsx("option", { value: s, children: s }, s))
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Minimum" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: editBahan.stok_minimum,
              onChange: (e) => setEditBahan({ ...editBahan, stok_minimum: e.target.value })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted", children: [
        "Untuk mengubah ",
        /* @__PURE__ */ jsx("b", { children: "jumlah stok" }),
        ", gunakan menu ",
        /* @__PURE__ */ jsx("b", { children: "Stok & Opname" }),
        " agar selisihnya tercatat."
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setEditBahan(null), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanEditBahan, children: "\u{1F4BE} Simpan" })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsx("p", { className: "text-muted text-center", children: "Memuat..." }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      tab === "bahan" && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9C2}" }),
            " Daftar Bahan Baku"
          ] }),
          /* @__PURE__ */ jsx(Link, { href: "/inventory/tambah-bahan", className: "btn btn-primary btn-sm", children: "\uFF0B Bahan" })
        ] }),
        bahanFiltered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F9FA}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada bahan baku" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Bahan baku otomatis tercatat saat Anda membuat resep/HPP produk." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Bahan" }),
            /* @__PURE__ */ jsx("th", { children: "Satuan" }),
            /* @__PURE__ */ jsx("th", { children: "Stok Sisa" }),
            /* @__PURE__ */ jsx("th", { children: "Min." }),
            /* @__PURE__ */ jsx("th", { children: "Status" }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: bahanFiltered.map((b) => {
            const kritis = (b.stok_sisa || 0) <= (b.stok_minimum || 5);
            return /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "font-bold", children: b.nama_bahan }),
              /* @__PURE__ */ jsx("td", { children: b.satuan || "pcs" }),
              /* @__PURE__ */ jsx("td", { className: kritis ? "text-danger font-bold" : "font-bold", children: b.stok_sisa }),
              /* @__PURE__ */ jsx("td", { className: "text-muted", children: b.stok_minimum || 5 }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${kritis ? "badge-danger" : "badge-success"}`, children: kritis ? "Kritis" : "Aman" }) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    className: "btn btn-sm btn-outline",
                    onClick: () => setEditBahan({ id: b.id, nama_bahan: b.nama_bahan, satuan: b.satuan || "pcs", stok_minimum: b.stok_minimum || 0, status: b.status || "aktif" }),
                    children: "\u270F\uFE0F"
                  }
                ),
                /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusBahan(b), children: "\u2715" })
              ] }) })
            ] }, b.id);
          }) })
        ] }) })
      ] }),
      tab === "produk" && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4E6}" }),
          " Stok Produk Jadi"
        ] }) }),
        produkFiltered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4E6}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada produk" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan produk di menu Produk & HPP." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Produk" }),
            /* @__PURE__ */ jsx("th", { children: "Kategori" }),
            /* @__PURE__ */ jsx("th", { children: "Harga" }),
            /* @__PURE__ */ jsx("th", { children: "Stok" }),
            /* @__PURE__ */ jsx("th", { children: "Status" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: produkFiltered.map((p) => {
            const kritis = (p.stok_produk || 0) <= 5;
            return /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "font-bold", children: p.nama_produk }),
              /* @__PURE__ */ jsx("td", { children: p.kategori || "\u2014" }),
              /* @__PURE__ */ jsx("td", { children: formatRupiah(p.harga_jual) }),
              /* @__PURE__ */ jsx("td", { className: kritis ? "text-danger font-bold" : "font-bold", children: p.stok_produk }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${kritis ? "badge-danger" : "badge-success"}`, children: kritis ? "Menipis" : "Aman" }) })
            ] }, p.id);
          }) })
        ] }) })
      ] }),
      tab === "pembelian" && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F6D2}" }),
            " Riwayat Pembelian"
          ] }),
          /* @__PURE__ */ jsx(Link, { href: "/inventory/tambah-bahan", className: "btn btn-primary btn-sm", children: "\uFF0B Pembelian" })
        ] }),
        pembelian.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F6D2}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada pembelian" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Catat pembelian bahan dari supplier." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
            /* @__PURE__ */ jsx("th", { children: "Bahan" }),
            /* @__PURE__ */ jsx("th", { children: "Supplier" }),
            /* @__PURE__ */ jsx("th", { children: "Qty" }),
            /* @__PURE__ */ jsx("th", { children: "Total" }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: pembelian.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: p.tanggal }),
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: p.nama_bahan || "\u2014" }),
            /* @__PURE__ */ jsx("td", { children: p.suppliers?.nama || "\u2014" }),
            /* @__PURE__ */ jsx("td", { children: p.qty }),
            /* @__PURE__ */ jsx("td", { className: "text-primary font-bold", children: formatRupiah(p.total) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusPembelian(p), children: "\u2715" }) })
          ] }, p.id)) })
        ] }) })
      ] })
    ] })
  ] });
}
