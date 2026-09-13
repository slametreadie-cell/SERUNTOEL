import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const ALASAN = ["Rusak / basi", "Tumpah", "Salah masak", "Kadaluarsa", "Susut penyimpanan", "Retur pelanggan", "Lainnya"];
export default function Waste() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [dari, setDari] = useState(() => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [sampai, setSampai] = useState(hariIni());
  const [form, setForm] = useState({ tanggal: hariIni(), produk_id: "", qty_waste: "", alasan: ALASAN[0], petugas: "" });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [wRes, pRes] = await Promise.all([
      supabase.from("waste_logs").select("*").gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: false }),
      supabase.from("products").select("id, nama_produk, hpp_per_unit").order("nama_produk")
    ]);
    if (wRes.error) setError(wRes.error.message);
    setData(wRes.data || []);
    setProduk(pRes.data || []);
    setLoading(false);
  }, [dari, sampai]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const simpan = async (e) => {
    e.preventDefault();
    const p = produk.find((x) => x.id === form.produk_id);
    if (!p) {
      setError("Pilih produk dulu");
      return;
    }
    const qty = Number(form.qty_waste);
    if (!qty || qty <= 0) {
      setError("Qty waste harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const hpp = (Number(p.hpp_per_unit) || 0) * qty;
      const { error: error2 } = await supabase.from("waste_logs").insert({
        tanggal: form.tanggal || hariIni(),
        produk_id: p.id,
        nama_produk: p.nama_produk,
        qty_waste: qty,
        alasan: form.alasan || null,
        biaya_hpp: hpp,
        petugas: form.petugas || user?.email || null
      });
      if (error2) throw error2;
      const { data: fresh } = await supabase.from("products").select("stok_produk").eq("id", p.id).single();
      const stokBaru = Math.max(0, (fresh?.stok_produk || 0) - qty);
      await supabase.from("products").update({ stok_produk: stokBaru }).eq("id", p.id);
      logAudit({
        aksi: "waste",
        user,
        sheetTarget: "waste_logs",
        detail: { produk: p.nama_produk, qty, alasan: form.alasan, biaya: hpp }
      });
      setMsg(`\u2705 Waste dicatat \u2014 kerugian ${formatRupiah(hpp)}`);
      setForm({ ...form, produk_id: "", qty_waste: "", petugas: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  const hapus = async (w) => {
    if (!confirm(`Hapus catatan waste ${w.nama_produk}? Stok tidak dikembalikan.`)) return;
    await supabase.from("waste_logs").delete().eq("id", w.id);
    fetchData();
  };
  const filtered = data.filter(
    (w) => !search || (w.nama_produk || "").toLowerCase().includes(search.toLowerCase()) || (w.alasan || "").toLowerCase().includes(search.toLowerCase())
  );
  const stat = useMemo(() => {
    const biaya = filtered.reduce((s, w) => s + Number(w.biaya_hpp || 0), 0);
    const qty = filtered.reduce((s, w) => s + (w.qty_waste || 0), 0);
    const perAlasan = {};
    filtered.forEach((w) => {
      perAlasan[w.alasan || "Lainnya"] = (perAlasan[w.alasan || "Lainnya"] || 0) + 1;
    });
    const teratas = Object.entries(perAlasan).sort((a, b) => b[1] - a[1])[0];
    return { biaya, qty, n: filtered.length, teratas: teratas ? teratas[0] : "\u2014" };
  }, [filtered]);
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Waste Log", subtitle: "Catat produk rusak & kerugian", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Kerugian" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(stat.biaya) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Qty Waste" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.qty })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Jumlah Catatan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.n })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Alasan Terbanyak" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", style: { fontSize: 15 }, children: stat.teratas })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F5D1}\uFE0F" }),
        " Catat Waste Baru"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Produk *" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.produk_id, onChange: (e) => setForm({ ...form, produk_id: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 Pilih produk \u2014" }),
            produk.map((p) => /* @__PURE__ */ jsxs("option", { value: p.id, children: [
              p.nama_produk,
              " (HPP ",
              formatRupiah(p.hpp_per_unit),
              ")"
            ] }, p.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Qty *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: form.qty_waste,
              onChange: (e) => setForm({ ...form, qty_waste: e.target.value }),
              placeholder: "0"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tanggal, onChange: (e) => setForm({ ...form, tanggal: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Alasan" }),
          /* @__PURE__ */ jsx("select", { className: "form-control", value: form.alasan, onChange: (e) => setForm({ ...form, alasan: e.target.value }), children: ALASAN.map((a) => /* @__PURE__ */ jsx("option", { value: a, children: a }, a)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Petugas" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.petugas, onChange: (e) => setForm({ ...form, petugas: e.target.value }), placeholder: user?.email || "Nama petugas" })
        ] })
      ] }),
      form.produk_id && form.qty_waste && /* @__PURE__ */ jsxs("div", { className: "alert alert-warning", children: [
        "Perkiraan kerugian:",
        " ",
        /* @__PURE__ */ jsx("b", { children: formatRupiah((Number(produk.find((x) => x.id === form.produk_id)?.hpp_per_unit) || 0) * (Number(form.qty_waste) || 0)) }),
        " ",
        "\xB7 stok produk akan berkurang ",
        form.qty_waste
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-danger", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\u{1F5D1}\uFE0F Catat Waste" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
        " Riwayat Waste"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { style: { padding: "0 16px 12px" }, className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: dari, onChange: (e) => setDari(e.target.value) }),
        /* @__PURE__ */ jsx("span", { className: "text-muted text-sm", children: "s/d" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", style: { maxWidth: 165 }, value: sampai, onChange: (e) => setSampai(e.target.value) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 200 },
            placeholder: "\u{1F50D} Cari produk/alasan...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        )
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F5D1}\uFE0F" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada waste" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Bagus! Tidak ada produk terbuang pada periode ini." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Produk" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Qty" }),
          /* @__PURE__ */ jsx("th", { children: "Alasan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Kerugian" }),
          /* @__PURE__ */ jsx("th", { children: "Petugas" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsxs("tbody", { children: [
          filtered.map((w) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(w.tanggal) }),
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: w.nama_produk }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: w.qty_waste }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-warning", children: w.alasan || "\u2014" }) }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-danger font-bold", children: formatRupiah(w.biaya_hpp) }),
            /* @__PURE__ */ jsx("td", { className: "text-muted text-xs", children: w.petugas || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(w), children: "\u2715" }) })
          ] }, w.id)),
          /* @__PURE__ */ jsxs("tr", { style: { background: "var(--bg)" }, children: [
            /* @__PURE__ */ jsx("td", { colSpan: 2, className: "font-extrabold", children: "TOTAL" }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold", children: stat.qty }),
            /* @__PURE__ */ jsx("td", {}),
            /* @__PURE__ */ jsx("td", { className: "text-right font-extrabold text-danger", children: formatRupiah(stat.biaya) }),
            /* @__PURE__ */ jsx("td", { colSpan: 2 })
          ] })
        ] })
      ] }) })
    ] })
  ] });
}
