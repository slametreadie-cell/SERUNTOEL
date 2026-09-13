import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function Produksi() {
  const { user } = useAuth();
  const [produk, setProduk] = useState([]);
  const [bahan, setBahan] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [produkId, setProdukId] = useState("");
  const [bahanId, setBahanId] = useState("");
  const [qty, setQty] = useState("");
  const [batchList, setBatchList] = useState([]);
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, bRes, rRes, prRes] = await Promise.all([
      supabase.from("products").select("id, nama_produk, hpp_per_unit, harga_jual, jumlah_produksi").order("nama_produk"),
      supabase.from("ingredients").select("*").order("nama_bahan"),
      supabase.from("recipes").select("*").order("created_at", { ascending: false }),
      supabase.from("ingredient_prices").select("bahan_id, harga, satuan, tanggal").order("tanggal", { ascending: false })
    ]);
    setProduk(pRes.data || []);
    setRecipes(rRes.data || []);
    const hargaMap = {};
    (prRes.data || []).forEach((p) => {
      if (p.bahan_id && hargaMap[p.bahan_id] === void 0) hargaMap[p.bahan_id] = Number(p.harga) || 0;
    });
    setBahan((bRes.data || []).map((b) => ({
      ...b,
      harga_terakhir: hargaMap[b.id] ?? 0
    })));
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const bahanMap = useMemo(() => {
    const m = {};
    bahan.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [bahan]);
  const tambahKeBatch = () => {
    if (!bahanId) {
      setError("Pilih bahan dulu");
      return;
    }
    const b = bahanMap[bahanId];
    if (!b) return;
    setError("");
    setBatchList((prev) => [...prev, {
      bahan_id: b.id,
      nama_bahan: b.nama_bahan,
      satuan: b.satuan || "pcs",
      qty: Number(qty) || 1,
      harga_satuan: Number(b.harga_terakhir) || 0
    }]);
    setBahanId("");
    setQty("");
  };
  const hapusDariBatch = (idx) => setBatchList((prev) => prev.filter((_, i) => i !== idx));
  const totalBiayaBatch = batchList.reduce((s, b) => s + b.qty * b.harga_satuan, 0);
  const simpanResep = async () => {
    if (!produkId) {
      setError("Pilih produk dulu");
      return;
    }
    if (batchList.length === 0) {
      setError("Tambahkan minimal 1 bahan");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const p = produk.find((x) => x.id === produkId);
      const payload = {
        produk_id: produkId,
        nama_produk: p?.nama_produk || "",
        bahan_baku_json: batchList
      };
      const { data: existing } = await supabase.from("recipes").select("id").eq("produk_id", produkId).limit(1).maybeSingle();
      if (existing) {
        const { error: error2 } = await supabase.from("recipes").update(payload).eq("id", existing.id);
        if (error2) throw error2;
      } else {
        const { error: error2 } = await supabase.from("recipes").insert(payload);
        if (error2) throw error2;
      }
      setMsg("\u2705 Resep disimpan");
      setProdukId("");
      setBatchList([]);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const editResep = (r) => {
    setProdukId(r.produk_id || "");
    setBatchList(Array.isArray(r.bahan_baku_json) ? r.bahan_baku_json : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hapusResep = async (id) => {
    if (!confirm("Hapus resep ini?")) return;
    await supabase.from("recipes").delete().eq("id", id);
    fetchData();
  };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Resep Produksi", subtitle: "Komposisi bahan per produk" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F372}"), " ", batchList.length && produkId ? "Ubah Resep" : "Buat Resep Baru")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Produk"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: produkId, onChange: (e) => setProdukId(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih produk \u2014"), produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.nama_produk))))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Bahan Baku"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: bahanId, onChange: (e) => setBahanId(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih bahan \u2014"), bahan.map((b) => /* @__PURE__ */ React.createElement("option", { key: b.id, value: b.id }, b.nama_bahan, " (", b.satuan || "pcs", ") \u2014 ", formatRupiah(b.harga_terakhir))))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Qty"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", step: "0.01", value: qty, onChange: (e) => setQty(e.target.value), placeholder: "0" })), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: tambahKeBatch }, "\uFF0B Tambah"))), batchList.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "table-wrap mt-2" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Bahan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Qty"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Harga"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Subtotal"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, batchList.map((b, idx) => /* @__PURE__ */ React.createElement("tr", { key: idx }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, b.nama_bahan), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, b.qty, " ", b.satuan), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(b.harga_satuan)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(b.qty * b.harga_satuan)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusDariBatch(idx) }, "\u2715")))), /* @__PURE__ */ React.createElement("tr", { style: { background: "var(--card-alt, rgba(0,0,0,0.03))" } }, /* @__PURE__ */ React.createElement("td", { className: "font-extrabold", colSpan: 3 }, "TOTAL BIAYA BAHAN"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-extrabold text-primary" }, formatRupiah(totalBiayaBatch)), /* @__PURE__ */ React.createElement("td", null))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end mt-3" }, batchList.length > 0 && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => {
    setBatchList([]);
    setProdukId("");
  } }, "Bersihkan"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-primary", onClick: simpanResep, disabled: saving || !batchList.length }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Resep"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4D6}"), " Daftar Resep"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, recipes.length, " resep")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : recipes.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F372}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada resep"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Buat resep untuk menghitung kebutuhan bahan tiap produk.")) : /* @__PURE__ */ React.createElement("div", { style: { padding: 16, display: "grid", gap: 12 } }, recipes.map((r) => {
    const items = Array.isArray(r.bahan_baku_json) ? r.bahan_baku_json : [];
    const total = items.reduce((s, b) => s + Number(b.qty || 0) * Number(b.harga_satuan || 0), 0);
    return /* @__PURE__ */ React.createElement("div", { key: r.id, style: { border: "1px solid var(--border)", borderRadius: 8, padding: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold" }, r.nama_produk || "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, items.length, " bahan \xB7 biaya bahan ", formatRupiah(total))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => editResep(r) }, "\u270F\uFE0F Ubah"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusResep(r.id) }, "\u2715"))), /* @__PURE__ */ React.createElement("div", { className: "table-wrap mt-2" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Bahan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Qty"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Subtotal"))), /* @__PURE__ */ React.createElement("tbody", null, items.map((b, i) => /* @__PURE__ */ React.createElement("tr", { key: i }, /* @__PURE__ */ React.createElement("td", null, b.nama_bahan), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, b.qty, " ", b.satuan), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(Number(b.qty || 0) * Number(b.harga_satuan || 0)))))))));
  }))));
}
