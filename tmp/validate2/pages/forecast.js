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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Forecast & Simulasi", subtitle: "Simulasi dampak perubahan biaya & harga" }, /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3AF}"), " Simulasi Skenario")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Pilih Produk"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: produkId, onChange: (e) => setProdukId(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 Pilih produk \u2014"), produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, p.nama_produk)))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kenaikan Bahan (%)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: kenaikanBahan, onChange: (e) => setKenaikanBahan(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Penurunan Penjualan (%)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: penurunanJual, onChange: (e) => setPenurunanJual(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kenaikan Operasional (%)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: kenaikanOp, onChange: (e) => setKenaikanOp(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Perubahan Margin (poin %)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: perubahanMargin, onChange: (e) => setPerubahanMargin(e.target.value), placeholder: "mis. -5 atau +10" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", style: { flex: 1 }, onClick: hitung }, "\u{1F52E} Hitung Simulasi"), hasil && /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: simpanSimulasi, disabled: saving }, saving ? "Menyimpan..." : "\u{1F4BE} Simpan")), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger mt-3" }, error)), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CA}"), " Hasil Simulasi")), !hasil ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F52E}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada simulasi"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, 'Isi parameter di kiri lalu klik "Hitung Simulasi".')) : /* @__PURE__ */ React.createElement("div", { className: "hpp-summary" }, /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "HPP Sekarang"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(hasil.hppSekarang))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Harga Jual Sekarang"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(hasil.hargaSekarang))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "HPP Baru"), /* @__PURE__ */ React.createElement("b", { className: "text-danger" }, formatRupiah(hasil.hppBaru))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Harga Jual Baru"), /* @__PURE__ */ React.createElement("b", { className: "text-primary" }, formatRupiah(hasil.hargaJualBaru))), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Margin Baru"), /* @__PURE__ */ React.createElement("b", null, Math.round(hasil.marginBaru), "%")), /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "Laba / Unit"), /* @__PURE__ */ React.createElement("b", { className: hasil.labaUnit >= 0 ? "text-success" : "text-danger" }, formatRupiah(hasil.labaUnit))), hasil.bepBaru > 0 && /* @__PURE__ */ React.createElement("div", { className: "hpp-row" }, /* @__PURE__ */ React.createElement("span", null, "BEP (unit)"), /* @__PURE__ */ React.createElement("b", null, hasil.bepBaru))), hasil && hasil.labaUnit < 0 && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger mt-3" }, "\u26A0\uFE0F Produk ini akan RUGI ", formatRupiah(Math.abs(hasil.labaUnit)), " per unit!"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DC}"), " Riwayat Simulasi")), riwayat.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Belum ada simulasi tersimpan.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", null, "Kenaikan Bahan"), /* @__PURE__ */ React.createElement("th", null, "Penurunan Jual"), /* @__PURE__ */ React.createElement("th", null, "HPP Baru"), /* @__PURE__ */ React.createElement("th", null, "Harga Baru"), /* @__PURE__ */ React.createElement("th", null, "Laba/Unit"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, riwayat.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, r.keterangan || "\u2014"), /* @__PURE__ */ React.createElement("td", null, "+", r.kenaikan_bahan, "%"), /* @__PURE__ */ React.createElement("td", null, "-", r.penurunan_penjualan, "%"), /* @__PURE__ */ React.createElement("td", null, formatRupiah(r.hpp_baru)), /* @__PURE__ */ React.createElement("td", null, formatRupiah(r.harga_jual_baru)), /* @__PURE__ */ React.createElement("td", { className: r.laba_unit >= 0 ? "text-success font-bold" : "text-danger font-bold" }, formatRupiah(r.laba_unit)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusSimulasi(r) }, "\u2715")))))))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .hpp-summary { display: flex; flex-direction: column; gap: 8px; }
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      `));
}
