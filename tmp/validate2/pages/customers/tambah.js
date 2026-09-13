import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
export default function TambahPelanggan() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nama: "",
    kontak: "",
    channel: "offline"
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("customers").insert({
        nama: form.nama.trim(),
        kontak: form.kontak || null,
        channel: form.channel
      });
      if (error2) throw error2;
      router.push("/customers");
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
      setSaving(false);
    }
  };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Tambah Pelanggan", subtitle: "Daftarkan pelanggan baru" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { maxWidth: 560 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F464}"), " Data Pelanggan")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", required: true, value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama pelanggan" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak (HP/WA/Email)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "08xx / email" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Channel"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.channel, onChange: (e) => setForm({ ...form, channel: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "offline" }, "Offline (datang ke toko)"), /* @__PURE__ */ React.createElement("option", { value: "online" }, "Online (marketplace/medsos)"), /* @__PURE__ */ React.createElement("option", { value: "reseller" }, "Reseller"))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end mt-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/customers") }, "Batal"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan")))));
}
