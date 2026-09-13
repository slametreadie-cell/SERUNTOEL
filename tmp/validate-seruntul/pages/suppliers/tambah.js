import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
export default function TambahSupplier() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nama: "",
    bahan_utama: "",
    kontak: "",
    alamat: "",
    rating: 0,
    catatan: ""
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("suppliers").insert({
        nama: form.nama.trim(),
        bahan_utama: form.bahan_utama || null,
        kontak: form.kontak || null,
        alamat: form.alamat || null,
        rating: Number(form.rating) || 0,
        catatan: form.catatan || null
      });
      if (error2) throw error2;
      router.push("/suppliers");
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx(AppLayout, { title: "Tambah Supplier", subtitle: "Daftarkan pemasok baru", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { maxWidth: 560 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3ED}" }),
        " Data Supplier"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Supplier *" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", required: true, value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama pemasok" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Bahan Utama" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.bahan_utama, onChange: (e) => setForm({ ...form, bahan_utama: e.target.value }), placeholder: "Contoh: Tepung, Daging" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Rating (0-5)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", min: "0", max: "5", value: form.rating, onChange: (e) => setForm({ ...form, rating: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "08xx / email" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Alamat" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", value: form.alamat, onChange: (e) => setForm({ ...form, alamat: e.target.value }), placeholder: "Alamat pemasok" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Catatan" }),
        /* @__PURE__ */ jsx("textarea", { className: "form-control", rows: "3", value: form.catatan, onChange: (e) => setForm({ ...form, catatan: e.target.value }), placeholder: "Opsional" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end mt-3", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/suppliers"), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan" })
      ] })
    ] })
  ] }) });
}
