import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
export default function Forecast() {
  const { user } = useAuth();
  const [produk, setProduk] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [produkId, setProdukId] = useState("");
  const [kenaikanBahan, setKenaikanBahan] = useState(0);
  const [penurunanJual, setPenurunanJual] = useState(0);
  const [kenaikanOp, setKenaikanOp] = useState(0);
  const [perubahanMargin, setPerubahanMargin] = useState(0);
  const [hasil, setHasil] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from("products").select("id, nama_produk, hpp_per_unit, harga_jual, margin").order("nama_produk"),
      supabase.from("simulation_scenarios").select("*").order("created_at", { ascending: false }).limit(20)
    ]);
    setProduk(pRes.data || []);
    setRiwayat(rRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const hapusSimulasi = async (r) => {
    if (!confirm("Hapus skenario simulasi ini?")) return;
    await supabase.from("simulation_scenarios").delete().eq("id", r.id);
    fetchData();
  };
  const hitung = () => {
    const p = produk.find((x) => x.id === produkId);
    if (!p) {
      setError("Pilih produk dulu");
      return;
    }
    setError("");
    const hppSekarang = Number(p.hpp_per_unit) || 0;
    const hargaSekarang = Number(p.harga_jual) || 0;
    const marginSekarang = Number(p.margin) || 0;
    const hppBaru = hppSekarang * (1 + (Number(kenaikanBahan) || 0) / 100) * (1 + (Number(kenaikanOp) || 0) / 100);
    const marginBaru = marginSekarang + (Number(perubahanMargin) || 0);
    const hargaJualBaru = hppBaru * (1 + marginBaru / 100);
    const labaUnit = hargaJualBaru - hppBaru;
    const biayaTetap = 0;
    const bepBaru = biayaTetap > 0 ? Math.ceil(biayaTetap / (labaUnit || 1)) : 0;
    setHasil({
      hppSekarang,
      hargaSekarang,
      hppBaru,
      hargaJualBaru,
      marginBaru,
      labaUnit,
      bepBaru,
      penurunanJual: Number(penurunanJual) || 0
    });
  };
  const simpanSimulasi = async () => {
    if (!hasil) return;
    setSaving(true);
    const p = produk.find((x) => x.id === produkId);
    try {
      const { error: error2 } = await supabase.from("simulation_scenarios").insert({
        kenaikan_bahan: Number(kenaikanBahan) || 0,
        penurunan_penjualan: Number(penurunanJual) || 0,
        kenaikan_op: Number(kenaikanOp) || 0,
        perubahan_margin: Number(perubahanMargin) || 0,
        hpp_baru: hasil.hppBaru,
        harga_jual_baru: hasil.hargaJualBaru,
        laba_unit: hasil.labaUnit,
        margin_baru: hasil.marginBaru,
        bep_baru: hasil.bepBaru,
        keterangan: p?.nama_produk || "",
        status: "simulasi"
      });
      if (error2) throw error2;
      setHasil(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Forecast & Simulasi", subtitle: "Simulasi dampak perubahan biaya & harga", children: [
    /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3AF}" }),
          " Simulasi Skenario"
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Pilih Produk" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: produkId, onChange: (e) => setProdukId(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih produk \u2014" }),
            produk.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.nama_produk }, p.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kenaikan Bahan (%)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: kenaikanBahan, onChange: (e) => setKenaikanBahan(e.target.value) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Penurunan Penjualan (%)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: penurunanJual, onChange: (e) => setPenurunanJual(e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kenaikan Operasional (%)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: kenaikanOp, onChange: (e) => setKenaikanOp(e.target.value) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Perubahan Margin (poin %)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: perubahanMargin, onChange: (e) => setPerubahanMargin(e.target.value), placeholder: "mis. -5 atau +10" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-primary", style: { flex: 1 }, onClick: hitung, children: "\u{1F52E} Hitung Simulasi" }),
          hasil && /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: simpanSimulasi, disabled: saving, children: saving ? "Menyimpan..." : "\u{1F4BE} Simpan" })
        ] }),
        error && /* @__PURE__ */ jsx("div", { className: "alert alert-danger mt-3", children: error })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CA}" }),
          " Hasil Simulasi"
        ] }) }),
        !hasil ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F52E}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada simulasi" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: 'Isi parameter di kiri lalu klik "Hitung Simulasi".' })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "hpp-summary", children: [
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "HPP Sekarang" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(hasil.hppSekarang) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Harga Jual Sekarang" }),
            /* @__PURE__ */ jsx("b", { children: formatRupiah(hasil.hargaSekarang) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "HPP Baru" }),
            /* @__PURE__ */ jsx("b", { className: "text-danger", children: formatRupiah(hasil.hppBaru) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Harga Jual Baru" }),
            /* @__PURE__ */ jsx("b", { className: "text-primary", children: formatRupiah(hasil.hargaJualBaru) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Margin Baru" }),
            /* @__PURE__ */ jsxs("b", { children: [
              Math.round(hasil.marginBaru),
              "%"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "Laba / Unit" }),
            /* @__PURE__ */ jsx("b", { className: hasil.labaUnit >= 0 ? "text-success" : "text-danger", children: formatRupiah(hasil.labaUnit) })
          ] }),
          hasil.bepBaru > 0 && /* @__PURE__ */ jsxs("div", { className: "hpp-row", children: [
            /* @__PURE__ */ jsx("span", { children: "BEP (unit)" }),
            /* @__PURE__ */ jsx("b", { children: hasil.bepBaru })
          ] })
        ] }),
        hasil && hasil.labaUnit < 0 && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger mt-3", children: [
          "\u26A0\uFE0F Produk ini akan RUGI ",
          formatRupiah(Math.abs(hasil.labaUnit)),
          " per unit!"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4DC}" }),
        " Riwayat Simulasi"
      ] }) }),
      riwayat.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-state", children: /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Belum ada simulasi tersimpan." }) }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Produk" }),
          /* @__PURE__ */ jsx("th", { children: "Kenaikan Bahan" }),
          /* @__PURE__ */ jsx("th", { children: "Penurunan Jual" }),
          /* @__PURE__ */ jsx("th", { children: "HPP Baru" }),
          /* @__PURE__ */ jsx("th", { children: "Harga Baru" }),
          /* @__PURE__ */ jsx("th", { children: "Laba/Unit" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: riwayat.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: r.keterangan || "\u2014" }),
          /* @__PURE__ */ jsxs("td", { children: [
            "+",
            r.kenaikan_bahan,
            "%"
          ] }),
          /* @__PURE__ */ jsxs("td", { children: [
            "-",
            r.penurunan_penjualan,
            "%"
          ] }),
          /* @__PURE__ */ jsx("td", { children: formatRupiah(r.hpp_baru) }),
          /* @__PURE__ */ jsx("td", { children: formatRupiah(r.harga_jual_baru) }),
          /* @__PURE__ */ jsx("td", { className: r.laba_unit >= 0 ? "text-success font-bold" : "text-danger font-bold", children: formatRupiah(r.laba_unit) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusSimulasi(r), children: "\u2715" }) })
        ] }, r.id)) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .hpp-summary { display: flex; flex-direction: column; gap: 8px; }
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      ` })
  ] });
}
