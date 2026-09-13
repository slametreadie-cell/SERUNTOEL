import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx(AppLayout, { title: "Tambah Pelanggan", subtitle: "Daftarkan pelanggan baru", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { maxWidth: 560 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F464}" }),
        " Data Pelanggan"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama *" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", required: true, value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }), placeholder: "Nama pelanggan" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak (HP/WA/Email)" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "08xx / email" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Channel" }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.channel, onChange: (e) => setForm({ ...form, channel: e.target.value }), children: [
          /* @__PURE__ */ jsx("option", { value: "offline", children: "Offline (datang ke toko)" }),
          /* @__PURE__ */ jsx("option", { value: "online", children: "Online (marketplace/medsos)" }),
          /* @__PURE__ */ jsx("option", { value: "reseller", children: "Reseller" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end mt-3", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/customers"), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan" })
      ] })
    ] })
  ] }) });
}
