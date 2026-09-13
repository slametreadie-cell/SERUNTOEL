import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
export default function Settings() {
  const { user } = useAuth();
  const [config, setConfig] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, kRes] = await Promise.all([
      supabase.from("configuration").select("*").order("key"),
      supabase.from("product_categories").select("*").order("nama")
    ]);
    setConfig(cRes.data || []);
    setKategori(kRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const updateConfig = async (id, value) => {
    await supabase.from("configuration").update({ value }).eq("id", id);
  };
  const [newKategori, setNewKategori] = useState("");
  const [newMargin, setNewMargin] = useState(30);
  const addKategori = async () => {
    if (!newKategori.trim()) return;
    const { error } = await supabase.from("product_categories").insert({
      nama: newKategori.trim(),
      margin_persen: Number(newMargin) || 30
    });
    if (error) setMsg("Gagal: " + error.message);
    else {
      setNewKategori("");
      setMsg("\u2705 Kategori ditambahkan");
      fetchData();
    }
    setTimeout(() => setMsg(""), 3e3);
  };
  const hapusKategori = async (id) => {
    await supabase.from("product_categories").delete().eq("id", id);
    fetchData();
  };
  if (loading) {
    return /* @__PURE__ */ React.createElement(AppLayout, { title: "Pengaturan" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("p", { className: "text-muted" }, "Memuat...")));
  }
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Pengaturan", subtitle: "Konfigurasi aplikasi" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u2699\uFE0F"), " Konfigurasi Umum")), config.map((c) => /* @__PURE__ */ React.createElement("div", { className: "form-group", key: c.id }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, c.key), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      defaultValue: c.value,
      onBlur: (e) => updateConfig(c.id, e.target.value)
    }
  ), c.keterangan && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, c.keterangan)))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F9FE}"), " Identitas Toko (Struk)")), ["nama_toko", "alamat_toko", "telepon_toko", "footer_struk"].map((key) => {
    const row = config.find((c) => c.key === key);
    return /* @__PURE__ */ React.createElement("div", { className: "form-group", key }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, { nama_toko: "Nama Toko", alamat_toko: "Alamat", telepon_toko: "No. Telepon", footer_struk: "Ucapan di Struk" }[key]), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        defaultValue: row?.value || "",
        placeholder: row ? "" : "belum diisi",
        onBlur: (e) => {
          if (row) updateConfig(row.id, e.target.value);
          else supabase.from("configuration").insert({ key, value: e.target.value }).then(() => fetchData());
        }
      }
    ));
  }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, "Teks ini muncul di struk yang dicetak dari POS."))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3F7}\uFE0F"), " Kategori Produk")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-3" }, /* @__PURE__ */ React.createElement("input", { className: "form-control", placeholder: "Nama kategori baru", value: newKategori, onChange: (e) => setNewKategori(e.target.value) }), /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 90 }, type: "number", placeholder: "Margin %", value: newMargin, onChange: (e) => setNewMargin(e.target.value) }), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: addKategori }, "\uFF0B")), kategori.map((k) => /* @__PURE__ */ React.createElement("div", { key: k.id, className: "flex items-center justify-between py-2", style: { borderBottom: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, k.nama), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, "Margin default: ", k.margin_persen, "%")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusKategori(k.id) }, "\u2715")))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F464}"), " Info Akun")), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Email"), /* @__PURE__ */ React.createElement("b", null, user?.email)), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "User ID"), /* @__PURE__ */ React.createElement("b", { className: "text-muted", style: { fontSize: 12 } }, user?.id))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      `));
}
