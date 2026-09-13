import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function TambahBahan() {
  const router = useRouter();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nama_bahan: "",
    satuan: "kg",
    stok_awal: 0,
    stok_minimum: 5,
    harga: 0,
    supplier_id: "",
    keterangan: ""
  });
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("suppliers").select("id, nama").order("nama");
      setSuppliers(data || []);
    };
    load();
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const qty = Number(form.stok_awal) || 0;
      const harga = Number(form.harga) || 0;
      const { data: existing } = await supabase.from("ingredients").select("id, stok_sisa, nama_bahan").ilike("nama_bahan", form.nama_bahan.trim());
      let bahanId;
      if (existing && existing.length > 0) {
        bahanId = existing[0].id;
        const stokBaru = (existing[0].stok_sisa || 0) + qty;
        const { error: upErr } = await supabase.from("ingredients").update({ stok_sisa: stokBaru, stok_minimum: Number(form.stok_minimum) || 5 }).eq("id", bahanId);
        if (upErr) throw upErr;
      } else {
        const { data: ins, error: insErr } = await supabase.from("ingredients").insert({
          nama_bahan: form.nama_bahan.trim(),
          satuan: form.satuan,
          stok_sisa: qty,
          stok_minimum: Number(form.stok_minimum) || 5,
          stok_rutin: qty
        }).select("id").single();
        if (insErr) throw insErr;
        bahanId = ins.id;
      }
      if (harga > 0) {
        const { error: priceErr } = await supabase.from("ingredient_prices").insert({
          bahan_id: bahanId,
          nama_bahan: form.nama_bahan.trim(),
          harga,
          satuan: form.satuan,
          supplier_id: form.supplier_id || null,
          keterangan: form.keterangan
        });
        if (priceErr) throw priceErr;
      }
      if (qty > 0) {
        const { error: beliErr } = await supabase.from("supplier_purchases").insert({
          bahan_id: bahanId,
          nama_bahan: form.nama_bahan.trim(),
          supplier_id: form.supplier_id || null,
          qty,
          harga,
          total: qty * harga,
          keterangan: form.keterangan
        });
        if (beliErr) throw beliErr;
      }
      router.push("/inventory");
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx(AppLayout, { title: "Tambah Bahan", subtitle: "Catat stok & pembelian bahan baku", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9C2}" }),
        " Informasi Bahan"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Bahan *" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", required: true, value: form.nama_bahan, onChange: (e) => setForm({ ...form, nama_bahan: e.target.value }), placeholder: "Contoh: Tepung Tapioka, Daging Ayam, dll" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Satuan" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.satuan, onChange: (e) => setForm({ ...form, satuan: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "kg", children: "kg" }),
            /* @__PURE__ */ jsx("option", { value: "gram", children: "gram" }),
            /* @__PURE__ */ jsx("option", { value: "liter", children: "liter" }),
            /* @__PURE__ */ jsx("option", { value: "ml", children: "ml" }),
            /* @__PURE__ */ jsx("option", { value: "pcs", children: "pcs" }),
            /* @__PURE__ */ jsx("option", { value: "pack", children: "pack" }),
            /* @__PURE__ */ jsx("option", { value: "ikat", children: "ikat" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Awal / Masuk" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.stok_awal, onChange: (e) => setForm({ ...form, stok_awal: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Minimum (peringatan)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.stok_minimum, onChange: (e) => setForm({ ...form, stok_minimum: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Harga Beli / Satuan" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.harga, onChange: (e) => setForm({ ...form, harga: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Supplier" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.supplier_id, onChange: (e) => setForm({ ...form, supplier_id: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Tanpa supplier \u2014" }),
            suppliers.map((s) => /* @__PURE__ */ jsx("option", { value: s.id, children: s.nama }, s.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.keterangan, onChange: (e) => setForm({ ...form, keterangan: e.target.value }), placeholder: "Opsional" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/inventory"), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan Bahan" })
      ] })
    ] })
  ] }) });
}
