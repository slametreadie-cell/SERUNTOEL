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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Tambah Bahan", subtitle: "Catat stok & pembelian bahan baku" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F9C2}"), " Informasi Bahan")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Bahan *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", required: true, value: form.nama_bahan, onChange: (e) => setForm({ ...form, nama_bahan: e.target.value }), placeholder: "Contoh: Tepung Tapioka, Daging Ayam, dll" })), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Satuan"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.satuan, onChange: (e) => setForm({ ...form, satuan: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "kg" }, "kg"), /* @__PURE__ */ React.createElement("option", { value: "gram" }, "gram"), /* @__PURE__ */ React.createElement("option", { value: "liter" }, "liter"), /* @__PURE__ */ React.createElement("option", { value: "ml" }, "ml"), /* @__PURE__ */ React.createElement("option", { value: "pcs" }, "pcs"), /* @__PURE__ */ React.createElement("option", { value: "pack" }, "pack"), /* @__PURE__ */ React.createElement("option", { value: "ikat" }, "ikat"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stok Awal / Masuk"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.stok_awal, onChange: (e) => setForm({ ...form, stok_awal: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stok Minimum (peringatan)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.stok_minimum, onChange: (e) => setForm({ ...form, stok_minimum: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Harga Beli / Satuan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.harga, onChange: (e) => setForm({ ...form, harga: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Supplier"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.supplier_id, onChange: (e) => setForm({ ...form, supplier_id: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Tanpa supplier \u2014"), suppliers.map((s) => /* @__PURE__ */ React.createElement("option", { key: s.id, value: s.id }, s.nama)))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.keterangan, onChange: (e) => setForm({ ...form, keterangan: e.target.value }), placeholder: "Opsional" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/inventory") }, "Batal"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Bahan")))));
}
