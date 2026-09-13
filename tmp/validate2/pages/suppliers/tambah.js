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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Tambah Supplier", subtitle: "Daftarkan pemasok baru" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { maxWidth: 560 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3ED}"), " Data Supplier")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Supplier *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", required: true, value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama pemasok" })), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Bahan Utama"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.bahan_utama, onChange: (e) => setForm({ ...form, bahan_utama: e.target.value }), placeholder: "Contoh: Tepung, Daging" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Rating (0-5)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", min: "0", max: "5", value: form.rating, onChange: (e) => setForm({ ...form, rating: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "08xx / email" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Alamat"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.alamat, onChange: (e) => setForm({ ...form, alamat: e.target.value }), placeholder: "Alamat pemasok" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Catatan"), /* @__PURE__ */ React.createElement("textarea", { className: "form-control", rows: "3", value: form.catatan, onChange: (e) => setForm({ ...form, catatan: e.target.value }), placeholder: "Opsional" })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end mt-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/suppliers") }, "Batal"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan")))));
}
