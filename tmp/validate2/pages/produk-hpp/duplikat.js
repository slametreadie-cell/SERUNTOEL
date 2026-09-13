import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function DuplikatProduk() {
  const { user } = useAuth();
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [sumber, setSumber] = useState(null);
  const [hasil, setHasil] = useState([]);
  const [form, setForm] = useState({ nama_produk: "", harga_jual: "", hpp_per_unit: "", stok_produk: "0", kategori: "" });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: error2 } = await supabase.from("products").select("*").order("nama_produk");
    if (error2) setError(error2.message);
    else setProduk(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const pilih = (p) => {
    setSumber(p);
    setForm({
      nama_produk: `${p.nama_produk} (Copy)`,
      harga_jual: String(p.harga_jual ?? ""),
      hpp_per_unit: String(p.hpp_per_unit ?? ""),
      stok_produk: "0",
      kategori: p.kategori || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const duplikat = async (e) => {
    e.preventDefault();
    if (!sumber) {
      setError("Pilih produk sumber dulu");
      return;
    }
    if (!form.nama_produk.trim()) {
      setError("Nama produk baru wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data, error: error2 } = await supabase.from("products").insert({
        nama_produk: form.nama_produk.trim(),
        kategori: form.kategori || null,
        harga_jual: Number(form.harga_jual) || 0,
        hpp_per_unit: Number(form.hpp_per_unit) || 0,
        stok_produk: Number(form.stok_produk) || 0,
        jumlah_produksi: 0,
        total_hpp: 0,
        margin: sumber.margin || 0,
        rincian_json: sumber.rincian_json || {},
        foto_url: sumber.foto_url || null
      }).select().single();
      if (error2) throw error2;
      logAudit({
        aksi: "duplikat_produk",
        user,
        sheetTarget: "products",
        detail: { dari: sumber.nama_produk, ke: form.nama_produk }
      });
      setMsg(`\u2705 Produk "${form.nama_produk}" dibuat dari "${sumber.nama_produk}"`);
      setHasil((prev) => [{ nama: data.nama_produk, dari: sumber.nama_produk }, ...prev]);
      setSumber(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 5e3);
    }
  };
  const hapus = async (p) => {
    if (!confirm(`Hapus produk ${p.nama_produk}?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    fetchData();
  };
  const filtered = produk.filter((p) => !search || (p.nama_produk || "").toLowerCase().includes(search.toLowerCase()) || (p.kategori || "").toLowerCase().includes(search.toLowerCase()));
  return /* @__PURE__ */ React.createElement(
    AppLayout,
    {
      title: "Duplikat Produk",
      subtitle: "Buat produk baru dari produk yang mirip",
      actions: /* @__PURE__ */ React.createElement(Link, { href: "/produk-hpp", className: "btn btn-outline btn-sm" }, "\u2190 Produk & HPP")
    },
    msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg),
    error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error),
    sumber && /* @__PURE__ */ React.createElement("form", { onSubmit: duplikat }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C4}"), " Duplikat dari: ", sumber.nama_produk), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => setSumber(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mb-3" }, "Foto, margin, dan rincian HPP ikut disalin. Sesuaikan nama, harga, dan stok di bawah."), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Produk Baru *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.nama_produk, onChange: (e) => setForm({ ...form, nama_produk: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kategori"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kategori, onChange: (e) => setForm({ ...form, kategori: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "HPP / Unit (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.hpp_per_unit, onChange: (e) => setForm({ ...form, hpp_per_unit: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Harga Jual (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.harga_jual, onChange: (e) => setForm({ ...form, harga_jual: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stok Awal"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.stok_produk, onChange: (e) => setForm({ ...form, stok_produk: e.target.value }) }))), (() => {
      const hpp = Number(form.hpp_per_unit) || 0;
      const jual = Number(form.harga_jual) || 0;
      const laba = jual - hpp;
      const margin = jual > 0 ? laba / jual * 100 : 0;
      return /* @__PURE__ */ React.createElement("div", { className: `alert ${laba >= 0 ? "alert-info" : "alert-danger"}` }, "Laba per unit ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(laba)), " \xB7 margin ", /* @__PURE__ */ React.createElement("b", null, margin.toFixed(1), "%"));
    })(), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => setSumber(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Membuat...") : "\u{1F4C4} Buat Duplikat")))),
    hasil.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u2705"), " Baru Dibuat")), hasil.map((h, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "text-sm", style: { padding: "6px 0", borderBottom: "1px dashed var(--border)" } }, /* @__PURE__ */ React.createElement("b", null, h.nama), " ", /* @__PURE__ */ React.createElement("span", { className: "text-muted" }, "dari ", h.dari)))),
    /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4E6}"), " Pilih Produk Sumber"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        style: { maxWidth: 240 },
        placeholder: "\u{1F50D} Cari produk...",
        value: search,
        onChange: (e) => setSearch(e.target.value)
      }
    )), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4E6}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada produk"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan produk dulu di menu Produk & HPP.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Kategori"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "HPP"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Harga Jual"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Stok"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((p) => /* @__PURE__ */ React.createElement("tr", { key: p.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, p.nama_produk), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, p.kategori || "\u2014")), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(p.hpp_per_unit)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold text-primary" }, formatRupiah(p.harga_jual)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, p.stok_produk || 0), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-primary", onClick: () => pilih(p) }, "\u{1F4C4} Duplikat"), /* @__PURE__ */ React.createElement(Link, { href: `/produk-hpp/${p.id}`, className: "btn btn-sm btn-outline" }, "Lihat"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(p) }, "\u2715")))))))))
  );
}
