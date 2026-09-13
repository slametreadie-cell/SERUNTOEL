import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(
    AppLayout,
    {
      title: "Duplikat Produk",
      subtitle: "Buat produk baru dari produk yang mirip",
      actions: /* @__PURE__ */ jsx(Link, { href: "/produk-hpp", className: "btn btn-outline btn-sm", children: "\u2190 Produk & HPP" }),
      children: [
        msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
        error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
          "\u26A0\uFE0F ",
          error
        ] }),
        sumber && /* @__PURE__ */ jsx("form", { onSubmit: duplikat, children: /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
            /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C4}" }),
              " Duplikat dari: ",
              sumber.nama_produk
            ] }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => setSumber(null), children: "\u2715" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-sm text-muted mb-3", children: "Foto, margin, dan rincian HPP ikut disalin. Sesuaikan nama, harga, dan stok di bawah." }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Produk Baru *" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", value: form.nama_produk, onChange: (e) => setForm({ ...form, nama_produk: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kategori" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kategori, onChange: (e) => setForm({ ...form, kategori: e.target.value }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "HPP / Unit (Rp)" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.hpp_per_unit, onChange: (e) => setForm({ ...form, hpp_per_unit: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Harga Jual (Rp)" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.harga_jual, onChange: (e) => setForm({ ...form, harga_jual: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Awal" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.stok_produk, onChange: (e) => setForm({ ...form, stok_produk: e.target.value }) })
            ] })
          ] }),
          (() => {
            const hpp = Number(form.hpp_per_unit) || 0;
            const jual = Number(form.harga_jual) || 0;
            const laba = jual - hpp;
            const margin = jual > 0 ? laba / jual * 100 : 0;
            return /* @__PURE__ */ jsxs("div", { className: `alert ${laba >= 0 ? "alert-info" : "alert-danger"}`, children: [
              "Laba per unit ",
              /* @__PURE__ */ jsx("b", { children: formatRupiah(laba) }),
              " \xB7 margin ",
              /* @__PURE__ */ jsxs("b", { children: [
                margin.toFixed(1),
                "%"
              ] })
            ] });
          })(),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => setSumber(null), children: "Batal" }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "spinner" }),
              " Membuat..."
            ] }) : "\u{1F4C4} Buat Duplikat" })
          ] })
        ] }) }),
        hasil.length > 0 && /* @__PURE__ */ jsxs("div", { className: "card", children: [
          /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u2705" }),
            " Baru Dibuat"
          ] }) }),
          hasil.map((h, i) => /* @__PURE__ */ jsxs("div", { className: "text-sm", style: { padding: "6px 0", borderBottom: "1px dashed var(--border)" }, children: [
            /* @__PURE__ */ jsx("b", { children: h.nama }),
            " ",
            /* @__PURE__ */ jsxs("span", { className: "text-muted", children: [
              "dari ",
              h.dari
            ] })
          ] }, i))
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4E6}" }),
              " Pilih Produk Sumber"
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-control",
                style: { maxWidth: 240 },
                placeholder: "\u{1F50D} Cari produk...",
                value: search,
                onChange: (e) => setSearch(e.target.value)
              }
            )
          ] }),
          loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
            /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4E6}" }),
            /* @__PURE__ */ jsx("h3", { children: "Belum ada produk" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan produk dulu di menu Produk & HPP." })
          ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Nama" }),
              /* @__PURE__ */ jsx("th", { children: "Kategori" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "HPP" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Harga Jual" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Stok" }),
              /* @__PURE__ */ jsx("th", {})
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: filtered.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "font-bold", children: p.nama_produk }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: p.kategori || "\u2014" }) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(p.hpp_per_unit) }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-bold text-primary", children: formatRupiah(p.harga_jual) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: p.stok_produk || 0 }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
                /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-primary", onClick: () => pilih(p), children: "\u{1F4C4} Duplikat" }),
                /* @__PURE__ */ jsx(Link, { href: `/produk-hpp/${p.id}`, className: "btn btn-sm btn-outline", children: "Lihat" }),
                /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(p), children: "\u2715" })
              ] }) })
            ] }, p.id)) })
          ] }) })
        ] })
      ]
    }
  );
}
