import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
export default function StokOpname() {
  const { user } = useAuth();
  const [tab, setTab] = useState("bahan");
  const [bahan, setBahan] = useState([]);
  const [produk, setProduk] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [opname, setOpname] = useState(null);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [bRes, pRes, rRes] = await Promise.all([
      supabase.from("ingredients").select("*").order("nama_bahan"),
      supabase.from("products").select("id, nama_produk, kategori, stok_produk").order("nama_produk"),
      supabase.from("stock_cards").select("*").order("created_at", { ascending: false }).limit(300)
    ]);
    if (bRes.error) setError(bRes.error.message);
    setBahan(bRes.data || []);
    setProduk(pRes.data || []);
    setRiwayat(rRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const daftar = tab === "bahan" ? bahan.map((b) => ({ id: b.id, nama: b.nama_bahan, satuan: b.satuan || "pcs", stok: b.stok_sisa || 0, min: b.stok_minimum || 0, kategori: null })) : produk.map((p) => ({ id: p.id, nama: p.nama_produk, satuan: "pcs", stok: p.stok_produk || 0, min: 0, kategori: p.kategori }));
  const filtered = daftar.filter((d) => !search || (d.nama || "").toLowerCase().includes(search.toLowerCase()));
  const stat = useMemo(() => {
    const kritis = daftar.filter((d) => d.min > 0 && d.stok <= d.min);
    const habis = daftar.filter((d) => d.stok <= 0);
    return {
      total: daftar.length,
      kritis: kritis.length,
      habis: habis.length,
      nilai: bahan.reduce((s, b) => s + (b.stok_sisa || 0), 0)
    };
  }, [daftar, bahan]);
  const mulaiOpname = (item) => {
    setOpname({ item, jenis: opname?.jenis || tab, stokFisik: String(item.stok), alasan: "" });
  };
  const simpanOpname = async () => {
    if (!opname) return;
    const fisik = Number(opname.stokFisik);
    if (Number.isNaN(fisik) || fisik < 0) {
      setError("Stok fisik tidak valid");
      return;
    }
    const { item } = opname;
    const selisih = fisik - item.stok;
    setSaving(true);
    setError("");
    try {
      if (tab === "bahan") {
        await supabase.from("ingredients").update({ stok_sisa: fisik }).eq("id", item.id);
        await supabase.from("stock_cards").insert({
          bahan_id: item.id,
          nama_bahan: item.nama,
          satuan: item.satuan,
          stok_awal: item.stok,
          masuk: selisih > 0 ? selisih : 0,
          keluar: selisih < 0 ? Math.abs(selisih) : 0,
          stok_sisa: fisik,
          status: "opname"
        });
      } else {
        await supabase.from("products").update({ stok_produk: fisik }).eq("id", item.id);
      }
      logAudit({
        aksi: "stok_opname",
        user,
        sheetTarget: tab === "bahan" ? "ingredients" : "products",
        detail: { nama: item.nama, stok_lama: item.stok, stok_fisik: fisik, selisih, alasan: opname.alasan || null }
      });
      setMsg(selisih === 0 ? `\u2705 ${item.nama}: stok sudah sesuai` : `\u2705 ${item.nama}: dikoreksi ${selisih > 0 ? "+" : ""}${selisih} ${item.satuan}`);
      setOpname(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Stok & Opname", subtitle: "Cek fisik stok dan koreksi selisih" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Item"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Stok Kritis"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, stat.kritis)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Stok Habis"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, stat.habis)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Catatan Opname"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, riwayat.length))), opname && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Opname \u2014 ", opname.item.nama), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setOpname(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mb-3" }, "Stok tercatat sistem: ", /* @__PURE__ */ React.createElement("b", null, opname.item.stok, " ", opname.item.satuan)), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stok Fisik Hasil Hitung"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      autoFocus: true,
      value: opname.stokFisik,
      onChange: (e) => setOpname({ ...opname, stokFisik: e.target.value })
    }
  ), opname.stokFisik !== "" && /* @__PURE__ */ React.createElement("div", { className: `text-sm mt-1 ${Number(opname.stokFisik) - opname.item.stok === 0 ? "text-success" : "text-danger"}` }, "Selisih: ", /* @__PURE__ */ React.createElement("b", null, Number(opname.stokFisik) - opname.item.stok > 0 ? "+" : "", Number(opname.stokFisik) - opname.item.stok, " ", opname.item.satuan))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Alasan Selisih (opsional)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: opname.alasan,
      onChange: (e) => setOpname({ ...opname, alasan: e.target.value }),
      placeholder: "mis. tumpah, salah catat, susut"
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanOpname, disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Koreksi"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${tab === "bahan" ? "btn-primary" : "btn-outline"}`, onClick: () => {
    setTab("bahan");
    setOpname(null);
  } }, "\u{1F9C2} Bahan Baku"), /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${tab === "produk" ? "btn-primary" : "btn-outline"}`, onClick: () => {
    setTab("produk");
    setOpname(null);
  } }, "\u{1F4E6} Produk Jadi")), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 220 },
      placeholder: "\u{1F50D} Cari...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  )), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4CB}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada ", tab === "bahan" ? "bahan baku" : "produk"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan ", tab === "bahan" ? "bahan di menu Inventory" : "produk di menu Produk & HPP", ".")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), tab === "produk" && /* @__PURE__ */ React.createElement("th", null, "Kategori"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Stok Sistem"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Stok Min"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => {
    const kritis = d.min > 0 && d.stok <= d.min;
    const habis = d.stok <= 0;
    return /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, d.nama), tab === "produk" && /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, d.kategori || "\u2014")), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, d.stok, " ", /* @__PURE__ */ React.createElement("span", { className: "text-muted text-xs" }, d.satuan)), /* @__PURE__ */ React.createElement("td", { className: "text-right text-muted" }, d.min || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${habis ? "badge-danger" : kritis ? "badge-warning" : "badge-success"}` }, habis ? "Habis" : kritis ? "Kritis" : "Aman")), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => mulaiOpname(d) }, "\u{1F4CB} Opname")));
  }))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F5C2}\uFE0F"), " Kartu Stok (Mutasi Bahan)"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, riwayat.length, " catatan")), riwayat.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada mutasi stok. Catatan muncul setelah opname atau pembelian bahan.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Bahan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Awal"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Masuk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Keluar"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Sisa"), /* @__PURE__ */ React.createElement("th", null, "Ket"))), /* @__PURE__ */ React.createElement("tbody", null, riwayat.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(r.created_at)), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, r.nama_bahan), /* @__PURE__ */ React.createElement("td", { className: "text-right text-muted" }, r.stok_awal), /* @__PURE__ */ React.createElement("td", { className: "text-right text-success font-bold" }, r.masuk ? `+${r.masuk}` : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger font-bold" }, r.keluar ? `\u2212${r.keluar}` : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, r.stok_sisa, " ", /* @__PURE__ */ React.createElement("span", { className: "text-xs text-muted" }, r.satuan)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, r.status || "\u2014")))))))));
}
