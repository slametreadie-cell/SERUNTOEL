import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const MODE_REKOM = {
  kompetitif: 0.25,
  standar: 0.4,
  premium: 0.6
};
export default function ProdukBaru() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = router.query;
  const isEdit = !!id;
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nama_produk: "",
    kategori: "",
    stok_produk: 0,
    target_batch: 1,
    hasil_per_batch: 1,
    mode_harga: "otomatis",
    margin: 40,
    harga_manual: 0,
    pajak_persen: 0,
    foto_url: ""
  });
  const [bahanRows, setBahanRows] = useState([{ nama: "", qty: 0, harga: 0 }]);
  const [kemasanRows, setKemasanRows] = useState([{ nama: "", qty: 0, harga: 0 }]);
  const [opRows, setOpRows] = useState([{ nama: "", qty: 0, harga: 0 }]);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const loadKategori = async () => {
      const { data } = await supabase.from("product_categories").select("*").order("nama");
      setKategoriList(data || []);
    };
    loadKategori();
  }, []);
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data, error: error2 } = await supabase.from("products").select("*").eq("id", id).single();
      if (error2) {
        setError(error2.message);
      } else if (data) {
        setForm({
          nama_produk: data.nama_produk || "",
          kategori: data.kategori || "",
          stok_produk: data.stok_produk || 0,
          target_batch: 1,
          hasil_per_batch: data.jumlah_produksi || 1,
          mode_harga: "otomatis",
          margin: Math.round(data.margin || 0),
          harga_manual: data.harga_jual || 0,
          pajak_persen: 0,
          foto_url: data.foto_url || ""
        });
        if (data.rincian_json && data.rincian_json.bahan) setBahanRows(data.rincian_json.bahan);
        if (data.rincian_json && data.rincian_json.kemasan) setKemasanRows(data.rincian_json.kemasan);
        if (data.rincian_json && data.rincian_json.operasional) setOpRows(data.rincian_json.operasional);
        if (data.foto_url) setFotoPreview(data.foto_url);
      }
      setLoading(false);
    };
    load();
  }, [id]);
  const sumRows = (rows) => rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.harga) || 0), 0);
  const totalSebelumPajak = sumRows(bahanRows) + sumRows(kemasanRows) + sumRows(opRows);
  const pajakNominal = totalSebelumPajak * (Number(form.pajak_persen) || 0) / 100;
  const totalDenganPajak = totalSebelumPajak + pajakNominal;
  const hasilPerBatch = Math.max(1, Number(form.hasil_per_batch) || 1);
  const hppPerUnit = totalDenganPajak / hasilPerBatch;
  let hargaJual, marginEfektif;
  if (form.mode_harga === "manual") {
    hargaJual = Number(form.harga_manual) || 0;
    marginEfektif = hppPerUnit > 0 ? (hargaJual - hppPerUnit) / hppPerUnit * 100 : 0;
  } else {
    const m = (Number(form.margin) || 40) / 100;
    hargaJual = hppPerUnit * (1 + m);
    marginEfektif = m * 100;
  }
  const rugi = hargaJual < hppPerUnit && hppPerUnit > 0;
  const updateRow = (setter, rows, idx, field, value) => {
    const next = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setter(next);
  };
  const addRow = (setter, rows) => setter([...rows, { nama: "", qty: 0, harga: 0 }]);
  const removeRow = (setter, rows, idx) => {
    if (rows.length <= 1) return;
    setter(rows.filter((_, i) => i !== idx));
  };
  const handleFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };
  const uploadFoto = async () => {
    if (!fotoFile) return form.foto_url;
    setUploading(true);
    try {
      const ext = fotoFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { error: error2 } = await supabase.storage.from("product-photos").upload(fileName, fotoFile, {
        cacheControl: "3600",
        upsert: false
      });
      if (error2) throw error2;
      const { data } = supabase.storage.from("product-photos").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) {
      throw new Error("Gagal upload foto: " + e.message);
    } finally {
      setUploading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let fotoUrl = form.foto_url;
      if (fotoFile) {
        fotoUrl = await uploadFoto();
      }
      const rincian = {
        bahan: bahanRows.filter((r) => r.nama),
        kemasan: kemasanRows.filter((r) => r.nama),
        operasional: opRows.filter((r) => r.nama),
        total_sebelum_pajak: totalSebelumPajak,
        pajak_persen: Number(form.pajak_persen) || 0,
        pajak_nominal: pajakNominal,
        total_hpp: totalDenganPajak
      };
      const payload = {
        nama_produk: form.nama_produk,
        kategori: form.kategori || null,
        stok_produk: Number(form.stok_produk) || 0,
        jumlah_produksi: hasilPerBatch,
        total_hpp: totalDenganPajak,
        hpp_per_unit: hppPerUnit,
        harga_jual: hargaJual,
        margin: marginEfektif,
        rincian_json: rincian,
        foto_url: fotoUrl || null
      };
      let res;
      if (isEdit) {
        res = await supabase.from("products").update(payload).eq("id", id);
      } else {
        res = await supabase.from("products").insert(payload);
      }
      if (res.error) throw res.error;
      router.push("/produk-hpp");
    } catch (err) {
      setError(err.message || "Gagal menyimpan produk");
      setSaving(false);
    }
  };
  const RowEditor = ({ title, rows, setter, color }) => /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "card-title mb-2", style: { fontSize: 14 }, children: [
      /* @__PURE__ */ jsx("span", { style: { color }, children: "\u25CF" }),
      " ",
      title
    ] }),
    rows.map((r, i) => /* @__PURE__ */ jsxs("div", { className: "form-row mb-2", style: { gridTemplateColumns: "1fr 80px 130px 40px", gap: 8 }, children: [
      /* @__PURE__ */ jsx("input", { className: "form-control", placeholder: "Nama", value: r.nama, onChange: (e) => updateRow(setter, rows, i, "nama", e.target.value) }),
      /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", placeholder: "Qty", value: r.qty, onChange: (e) => updateRow(setter, rows, i, "qty", e.target.value) }),
      /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", placeholder: "Harga", value: r.harga, onChange: (e) => updateRow(setter, rows, i, "harga", e.target.value) }),
      /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-danger", onClick: () => removeRow(setter, rows, i), children: "\u2715" })
    ] }, i)),
    /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => addRow(setter, rows), children: "\uFF0B Tambah Baris" })
  ] });
  if (loading) {
    return /* @__PURE__ */ jsx(AppLayout, { title: "Produk", children: /* @__PURE__ */ jsx("div", { className: "card", children: /* @__PURE__ */ jsx("p", { className: "text-muted", children: "Memuat..." }) }) });
  }
  return /* @__PURE__ */ jsxs(AppLayout, { title: isEdit ? "Edit Produk" : "Produk Baru", subtitle: "Kalkulasi HPP otomatis", children: [
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
      error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
        "\u26A0\uFE0F ",
        error
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "card", children: [
          /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4E6}" }),
            " Informasi Produk"
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Produk *" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", required: true, value: form.nama_produk, onChange: (e) => setForm({ ...form, nama_produk: e.target.value }), placeholder: "Contoh: Abon Ikan Kemasan 100g" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kategori" }),
              /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.kategori, onChange: (e) => setForm({ ...form, kategori: e.target.value }), children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih Kategori \u2014" }),
                kategoriList.map((k) => /* @__PURE__ */ jsx("option", { value: k.nama, children: k.nama }, k.id)),
                /* @__PURE__ */ jsx("option", { value: "Lainnya", children: "Lainnya" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Awal" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.stok_produk, onChange: (e) => setForm({ ...form, stok_produk: e.target.value }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Foto Produk" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "foto-box", onClick: () => document.getElementById("fotoInput").click(), children: fotoPreview ? /* @__PURE__ */ jsx("img", { src: fotoPreview, alt: "preview" }) : /* @__PURE__ */ jsxs("span", { className: "text-muted", children: [
                "\u{1F4F7}",
                /* @__PURE__ */ jsx("br", {}),
                /* @__PURE__ */ jsx("small", { children: "Klik untuk upload" })
              ] }) }),
              /* @__PURE__ */ jsx("input", { id: "fotoInput", type: "file", accept: "image/*", style: { display: "none" }, onChange: handleFoto }),
              /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted", children: [
                /* @__PURE__ */ jsx("p", { children: "Format: JPG/PNG" }),
                /* @__PURE__ */ jsx("p", { children: "Maks 5MB" }),
                fotoPreview && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline mt-2", onClick: () => {
                  setFotoFile(null);
                  setFotoPreview("");
                  setForm({ ...form, foto_url: "" });
                }, children: "Hapus Foto" })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", children: [
          /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9EE}" }),
            " Kalkulasi HPP"
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Target Batch" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.target_batch, onChange: (e) => setForm({ ...form, target_batch: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Hasil per Batch (unit)" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.hasil_per_batch, onChange: (e) => setForm({ ...form, hasil_per_batch: e.target.value }) })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(RowEditor, { title: "Bahan Baku", rows: bahanRows, setter: setBahanRows, color: "#0D9488" }) }),
          /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(RowEditor, { title: "Kemasan", rows: kemasanRows, setter: setKemasanRows, color: "#3B82F6" }) }),
          /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(RowEditor, { title: "Biaya Operasional", rows: opRows, setter: setOpRows, color: "#F59E0B" }) }),
          /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Pajak (%)" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.pajak_persen, onChange: (e) => setForm({ ...form, pajak_persen: e.target.value }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Mode Harga" }),
              /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.mode_harga, onChange: (e) => setForm({ ...form, mode_harga: e.target.value }), children: [
                /* @__PURE__ */ jsx("option", { value: "otomatis", children: "Otomatis (margin)" }),
                /* @__PURE__ */ jsx("option", { value: "manual", children: "Manual" }),
                /* @__PURE__ */ jsx("option", { value: "rekomendasi", children: "Rekomendasi" })
              ] })
            ] })
          ] }),
          form.mode_harga === "otomatis" && /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Margin (%)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.margin, onChange: (e) => setForm({ ...form, margin: e.target.value }) })
          ] }),
          form.mode_harga === "manual" && /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Harga Jual Manual" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.harga_manual, onChange: (e) => setForm({ ...form, harga_manual: e.target.value }) })
          ] }),
          form.mode_harga === "rekomendasi" && /* @__PURE__ */ jsx("div", { className: "flex gap-2 flex-wrap", children: Object.entries(MODE_REKOM).map(([k, m]) => /* @__PURE__ */ jsxs("button", { type: "button", className: "btn btn-sm btn-outline capitalize", onClick: () => setForm({ ...form, mode_harga: "otomatis", margin: Math.round(m * 100) }), children: [
            k,
            " (+",
            Math.round(m * 100),
            "%)"
          ] }, k)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: `card ${rugi ? "" : ""}`, style: { position: "sticky", bottom: 16, border: rugi ? "2px solid var(--danger)" : "2px solid var(--primary)", zIndex: 10 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between flex-wrap gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex gap-4 flex-wrap", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "Total Biaya" }),
              /* @__PURE__ */ jsx("div", { className: "font-bold", style: { fontSize: 20 }, children: formatRupiah(totalDenganPajak) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "HPP / Unit" }),
              /* @__PURE__ */ jsx("div", { className: "font-bold", style: { fontSize: 20 }, children: formatRupiah(hppPerUnit) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "Harga Jual" }),
              /* @__PURE__ */ jsx("div", { className: `font-extrabold ${rugi ? "text-danger" : "text-primary"}`, style: { fontSize: 24 }, children: formatRupiah(hargaJual) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "Margin" }),
              /* @__PURE__ */ jsxs("div", { className: `font-bold ${marginEfektif >= 40 ? "text-success" : marginEfektif >= 20 ? "text-primary" : "text-danger"}`, style: { fontSize: 20 }, children: [
                Math.round(marginEfektif),
                "%"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/produk-hpp"), children: "Batal" }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving || uploading, children: saving || uploading ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "spinner" }),
              " Menyimpan..."
            ] }) : "\u{1F4BE} Simpan Produk" })
          ] })
        ] }),
        rugi && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger mt-3 mb-0", style: { marginBottom: 0 }, children: [
          "\u26A0\uFE0F Harga jual lebih rendah dari HPP \u2014 Anda akan RUGI ",
          formatRupiah(hppPerUnit - hargaJual),
          " per unit!"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .foto-box {
          width: 120px; height: 120px;
          border: 2px dashed var(--border);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; text-align: center;
          transition: all .2s;
          background: var(--bg);
        }
        .foto-box:hover { border-color: var(--primary); }
        .foto-box img { width: 100%; height: 100%; object-fit: cover; }
      ` })
  ] });
}
