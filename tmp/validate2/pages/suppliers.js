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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Supplier", subtitle: "Pemasok bahan baku" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 280, flex: 1 }, placeholder: "\u{1F50D} Cari nama/bahan utama...", value: search, onChange: (e) => setSearch(e.target.value) }), /* @__PURE__ */ React.createElement(Link, { href: "/suppliers/tambah", className: "btn btn-primary" }, "\uFF0B Supplier"))), msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), editRow && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u270F\uFE0F"), " Ubah Supplier"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.nama, onChange: (e) => setEditRow({ ...editRow, nama: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.kontak, onChange: (e) => setEditRow({ ...editRow, kontak: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Bahan Utama"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.bahan_utama, onChange: (e) => setEditRow({ ...editRow, bahan_utama: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Alamat"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.alamat, onChange: (e) => setEditRow({ ...editRow, alamat: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Rating (1-5)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      min: "0",
      max: "5",
      value: editRow.rating,
      onChange: (e) => setEditRow({ ...editRow, rating: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setEditRow(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanEditSupplier }, "\u{1F4BE} Simpan"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3ED}"), " Daftar Supplier"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " supplier")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F3ED}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada supplier"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan pemasok bahan baku Anda.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Bahan Utama"), /* @__PURE__ */ React.createElement("th", null, "Kontak"), /* @__PURE__ */ React.createElement("th", null, "Rating"), /* @__PURE__ */ React.createElement("th", null, "Pembelian"), /* @__PURE__ */ React.createElement("th", null, "Total"), /* @__PURE__ */ React.createElement("th", null, "Terakhir"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((s) => /* @__PURE__ */ React.createElement("tr", { key: s.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, s.nama), /* @__PURE__ */ React.createElement("td", null, s.bahan_utama || "\u2014"), /* @__PURE__ */ React.createElement("td", null, s.kontak || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-warning" }, "\u2B50".repeat(Math.min(5, s.rating || 0)) || "\u2014")), /* @__PURE__ */ React.createElement("td", null, s.total_pembelian || 0, "x"), /* @__PURE__ */ React.createElement("td", { className: "text-primary font-bold" }, formatRupiah(s.total_belanja)), /* @__PURE__ */ React.createElement("td", { className: "text-muted" }, formatTanggal(s.last_purchase)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-sm btn-outline",
      onClick: () => setEditRow({ id: s.id, nama: s.nama, kontak: s.kontak || "", bahan_utama: s.bahan_utama || "", alamat: s.alamat || "", rating: s.rating || 0 })
    },
    "\u270F\uFE0F"
  ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusSupplier(s) }, "\u2715"))))))))));
}
