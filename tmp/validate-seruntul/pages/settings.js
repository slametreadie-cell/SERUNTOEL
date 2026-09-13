import { jsx, jsxs } from "react/jsx-runtime";
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
    return /* @__PURE__ */ jsx(AppLayout, { title: "Pengaturan", children: /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsx("p", { className: "text-muted", children: "Memuat..." }) }) });
  }
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Pengaturan", subtitle: "Konfigurasi aplikasi", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u2699\uFE0F" }),
          " Konfigurasi Umum"
        ] }) }),
        config.map((c) => /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: c.key }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              defaultValue: c.value,
              onBlur: (e) => updateConfig(c.id, e.target.value)
            }
          ),
          c.keterangan && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted mt-1", children: c.keterangan })
        ] }, c.id))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9FE}" }),
          " Identitas Toko (Struk)"
        ] }) }),
        ["nama_toko", "alamat_toko", "telepon_toko", "footer_struk"].map((key) => {
          const row = config.find((c) => c.key === key);
          return /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: { nama_toko: "Nama Toko", alamat_toko: "Alamat", telepon_toko: "No. Telepon", footer_struk: "Ucapan di Struk" }[key] }),
            /* @__PURE__ */ jsx(
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
            )
          ] }, key);
        }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "Teks ini muncul di struk yang dicetak dari POS." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3F7}\uFE0F" }),
        " Kategori Produk"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mb-3", children: [
        /* @__PURE__ */ jsx("input", { className: "form-control", placeholder: "Nama kategori baru", value: newKategori, onChange: (e) => setNewKategori(e.target.value) }),
        /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 90 }, type: "number", placeholder: "Margin %", value: newMargin, onChange: (e) => setNewMargin(e.target.value) }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: addKategori, children: "\uFF0B" })
      ] }),
      kategori.map((k) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between py-2", style: { borderBottom: "1px solid var(--border)" }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "font-bold", children: k.nama }),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
            "Margin default: ",
            k.margin_persen,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusKategori(k.id), children: "\u2715" })
      ] }, k.id))
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F464}" }),
        " Info Akun"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
        /* @__PURE__ */ jsx("span", { children: "Email" }),
        /* @__PURE__ */ jsx("b", { children: user?.email })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
        /* @__PURE__ */ jsx("span", { children: "User ID" }),
        /* @__PURE__ */ jsx("b", { className: "text-muted", style: { fontSize: 12 }, children: user?.id })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      ` })
  ] });
}
