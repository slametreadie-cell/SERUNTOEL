import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Resep Produksi", subtitle: "Komposisi bahan per produk", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F372}" }),
        " ",
        batchList.length && produkId ? "Ubah Resep" : "Buat Resep Baru"
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "form-row", children: /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Produk" }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", value: produkId, onChange: (e) => setProdukId(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih produk \u2014" }),
          produk.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.nama_produk }, p.id))
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Bahan Baku" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: bahanId, onChange: (e) => setBahanId(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih bahan \u2014" }),
            bahan.map((b) => /* @__PURE__ */ jsxs("option", { value: b.id, children: [
              b.nama_bahan,
              " (",
              b.satuan || "pcs",
              ") \u2014 ",
              formatRupiah(b.harga_terakhir)
            ] }, b.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Qty" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", step: "0.01", value: qty, onChange: (e) => setQty(e.target.value), placeholder: "0" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "form-group", style: { justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: tambahKeBatch, children: "\uFF0B Tambah" }) })
      ] }),
      batchList.length > 0 && /* @__PURE__ */ jsx("div", { className: "table-wrap mt-2", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Bahan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Qty" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Harga" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Subtotal" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsxs("tbody", { children: [
          batchList.map((b, idx) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: b.nama_bahan }),
            /* @__PURE__ */ jsxs("td", { className: "text-right", children: [
              b.qty,
              " ",
              b.satuan
            ] }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(b.harga_satuan) }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(b.qty * b.harga_satuan) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusDariBatch(idx), children: "\u2715" }) })
          ] }, idx)),
          /* @__PURE__ */ jsxs("tr", { style: { background: "var(--card-alt, rgba(0,0,0,0.03))" }, children: [
            /* @__PURE__ */ jsx("td", { className: "font-extrabold", colSpan: 3, children: "TOTAL BIAYA BAHAN" }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold text-primary", children: formatRupiah(totalBiayaBatch) }),
            /* @__PURE__ */ jsx("td", {})
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end mt-3", children: [
        batchList.length > 0 && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => {
          setBatchList([]);
          setProdukId("");
        }, children: "Bersihkan" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-primary", onClick: simpanResep, disabled: saving || !batchList.length, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan Resep" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4D6}" }),
          " Daftar Resep"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          recipes.length,
          " resep"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : recipes.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F372}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada resep" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Buat resep untuk menghitung kebutuhan bahan tiap produk." })
      ] }) : /* @__PURE__ */ jsx("div", { style: { padding: 16, display: "grid", gap: 12 }, children: recipes.map((r) => {
        const items = Array.isArray(r.bahan_baku_json) ? r.bahan_baku_json : [];
        const total = items.reduce((s, b) => s + Number(b.qty || 0) * Number(b.harga_satuan || 0), 0);
        return /* @__PURE__ */ jsxs("div", { style: { border: "1px solid var(--border)", borderRadius: 10, padding: 14 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "font-extrabold", children: r.nama_produk || "\u2014" }),
              /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
                items.length,
                " bahan \xB7 biaya bahan ",
                formatRupiah(total)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => editResep(r), children: "\u270F\uFE0F Ubah" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusResep(r.id), children: "\u2715" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "table-wrap mt-2", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Bahan" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Qty" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Subtotal" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: items.map((b, i) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: b.nama_bahan }),
              /* @__PURE__ */ jsxs("td", { className: "text-right", children: [
                b.qty,
                " ",
                b.satuan
              ] }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(Number(b.qty || 0) * Number(b.harga_satuan || 0)) })
            ] }, i)) })
          ] }) })
        ] }, r.id);
      }) })
    ] })
  ] });
}
