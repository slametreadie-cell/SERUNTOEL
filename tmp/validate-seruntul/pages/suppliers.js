import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const formatTanggal = (v) => {
  if (!v) return "\u2014";
  const d = new Date(v);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
export default function Suppliers() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [msg, setMsg] = useState("");
  const hapusSupplier = async (s) => {
    if (!confirm(`Hapus supplier "${s.nama}"?`)) return;
    await supabase.from("suppliers").delete().eq("id", s.id);
    logAudit({ aksi: "hapus_supplier", user, sheetTarget: "suppliers", detail: { nama: s.nama } });
    setMsg(`\u2705 Supplier ${s.nama} dihapus`);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const simpanEditSupplier = async () => {
    if (!editRow) return;
    if (!editRow.nama?.trim()) {
      alert("Nama tidak boleh kosong");
      return;
    }
    await supabase.from("suppliers").update({
      nama: editRow.nama.trim(),
      kontak: editRow.kontak || null,
      bahan_utama: editRow.bahan_utama || null,
      alamat: editRow.alamat || null,
      rating: Number(editRow.rating) || 0
    }).eq("id", editRow.id);
    logAudit({ aksi: "ubah_supplier", user, sheetTarget: "suppliers", detail: { nama: editRow.nama } });
    setMsg("\u2705 Data supplier diperbarui");
    setEditRow(null);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("suppliers").select("*").order("total_belanja", { ascending: false });
    if (error2) setError(error2.message);
    else setData(data2 || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const filtered = data.filter((s) => {
    return !search || (s.nama || "").toLowerCase().includes(search.toLowerCase()) || (s.bahan_utama || "").toLowerCase().includes(search.toLowerCase());
  });
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Supplier", subtitle: "Pemasok bahan baku", children: [
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 280, flex: 1 }, placeholder: "\u{1F50D} Cari nama/bahan utama...", value: search, onChange: (e) => setSearch(e.target.value) }),
      /* @__PURE__ */ jsx(Link, { href: "/suppliers/tambah", className: "btn btn-primary", children: "\uFF0B Supplier" })
    ] }) }),
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    editRow && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u270F\uFE0F" }),
          " Ubah Supplier"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.nama, onChange: (e) => setEditRow({ ...editRow, nama: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.kontak, onChange: (e) => setEditRow({ ...editRow, kontak: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Bahan Utama" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.bahan_utama, onChange: (e) => setEditRow({ ...editRow, bahan_utama: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Alamat" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.alamat, onChange: (e) => setEditRow({ ...editRow, alamat: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Rating (1-5)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              min: "0",
              max: "5",
              value: editRow.rating,
              onChange: (e) => setEditRow({ ...editRow, rating: e.target.value })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setEditRow(null), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanEditSupplier, children: "\u{1F4BE} Simpan" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3ED}" }),
          " Daftar Supplier"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          filtered.length,
          " supplier"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F3ED}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada supplier" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan pemasok bahan baku Anda." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          /* @__PURE__ */ jsx("th", { children: "Bahan Utama" }),
          /* @__PURE__ */ jsx("th", { children: "Kontak" }),
          /* @__PURE__ */ jsx("th", { children: "Rating" }),
          /* @__PURE__ */ jsx("th", { children: "Pembelian" }),
          /* @__PURE__ */ jsx("th", { children: "Total" }),
          /* @__PURE__ */ jsx("th", { children: "Terakhir" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((s) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: s.nama }),
          /* @__PURE__ */ jsx("td", { children: s.bahan_utama || "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: s.kontak || "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-warning", children: "\u2B50".repeat(Math.min(5, s.rating || 0)) || "\u2014" }) }),
          /* @__PURE__ */ jsxs("td", { children: [
            s.total_pembelian || 0,
            "x"
          ] }),
          /* @__PURE__ */ jsx("td", { className: "text-primary font-bold", children: formatRupiah(s.total_belanja) }),
          /* @__PURE__ */ jsx("td", { className: "text-muted", children: formatTanggal(s.last_purchase) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "btn btn-sm btn-outline",
                onClick: () => setEditRow({ id: s.id, nama: s.nama, kontak: s.kontak || "", bahan_utama: s.bahan_utama || "", alamat: s.alamat || "", rating: s.rating || 0 }),
                children: "\u270F\uFE0F"
              }
            ),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusSupplier(s), children: "\u2715" })
          ] }) })
        ] }, s.id)) })
      ] }) })
    ] })
  ] });
}
