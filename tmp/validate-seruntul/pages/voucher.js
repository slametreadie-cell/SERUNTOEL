import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
export default function Voucher() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    kode: "",
    tipe: "persen",
    nilai: "",
    kategori: "",
    deskripsi: "",
    tanggal_mulai: hariIni(),
    tanggal_berakhir: "",
    aktif: true
  });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [vRes, uRes] = await Promise.all([
      supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      supabase.from("voucher_usages").select("*").order("tanggal_pakai", { ascending: false }).limit(200)
    ]);
    if (vRes.error) setError(vRes.error.message);
    else setData(vRes.data || []);
    setUsage(uRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const statusVoucher = (v) => {
    if (!v.aktif) return { label: "Nonaktif", cls: "badge-neutral" };
    const t = hariIni();
    if (v.tanggal_mulai && t < v.tanggal_mulai) return { label: "Belum mulai", cls: "badge-info" };
    if (v.tanggal_berakhir && t > v.tanggal_berakhir) return { label: "Kedaluwarsa", cls: "badge-danger" };
    return { label: "Aktif", cls: "badge-success" };
  };
  const simpan = async (e) => {
    e.preventDefault();
    const kode = (form.kode || "").trim().toUpperCase();
    if (!kode) {
      setError("Kode voucher wajib diisi");
      return;
    }
    const nilai = Number(form.nilai) || 0;
    if (nilai <= 0) {
      setError("Nilai diskon harus lebih dari 0");
      return;
    }
    if (form.tipe === "persen" && nilai > 100) {
      setError("Diskon persen maksimal 100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("vouchers").insert({
        kode,
        tipe: form.tipe,
        nilai,
        kategori: form.kategori || null,
        deskripsi: form.deskripsi || null,
        tanggal_mulai: form.tanggal_mulai || null,
        tanggal_berakhir: form.tanggal_berakhir || null,
        aktif: form.aktif,
        total_dipakai: 0
      });
      if (error2) throw error2;
      logAudit({ aksi: "tambah_voucher", user, sheetTarget: "vouchers", detail: { kode, tipe: form.tipe, nilai } });
      setMsg("\u2705 Voucher dibuat");
      setForm({ kode: "", tipe: "persen", nilai: "", kategori: "", deskripsi: "", tanggal_mulai: hariIni(), tanggal_berakhir: "", aktif: true });
      fetchData();
    } catch (err) {
      setError(err.message.includes("duplicate") ? "Kode voucher sudah dipakai" : err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const toggleAktif = async (v) => {
    await supabase.from("vouchers").update({ aktif: !v.aktif }).eq("id", v.id);
    fetchData();
  };
  const hapus = async (v) => {
    if (!confirm(`Hapus voucher ${v.kode}?`)) return;
    await supabase.from("vouchers").delete().eq("id", v.id);
    logAudit({ aksi: "hapus_voucher", user, sheetTarget: "vouchers", detail: { kode: v.kode } });
    fetchData();
  };
  const filtered = data.filter(
    (v) => !search || (v.kode || "").toLowerCase().includes(search.toLowerCase()) || (v.kategori || "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPemakaian = data.reduce((s, v) => s + (v.total_dipakai || 0), 0);
  const totalDiskon = usage.reduce((s, u) => s + Number(u.diskon || 0), 0);
  const aktifCount = data.filter((v) => statusVoucher(v).label === "Aktif").length;
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Voucher & Promo", subtitle: "Kelola kode diskon untuk pelanggan", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Voucher Aktif" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: aktifCount })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Pemakaian" }),
        /* @__PURE__ */ jsxs("div", { className: "metric-value", children: [
          totalPemakaian,
          "\xD7"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Diskon Diberikan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(totalDiskon) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F39F}\uFE0F" }),
        " Buat Voucher Baru"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kode Voucher *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: form.kode,
              placeholder: "mis. PROMO10",
              onChange: (e) => setForm({ ...form, kode: e.target.value.toUpperCase() })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tipe Diskon" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: form.tipe, onChange: (e) => setForm({ ...form, tipe: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "persen", children: "Persen (%)" }),
            /* @__PURE__ */ jsx("option", { value: "nominal", children: "Nominal (Rp)" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nilai *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: form.nilai,
              placeholder: form.tipe === "persen" ? "10" : "5000",
              onChange: (e) => setForm({ ...form, nilai: e.target.value })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kategori (opsional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: form.kategori,
              placeholder: "mis. Makanan",
              onChange: (e) => setForm({ ...form, kategori: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Mulai" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "date",
              value: form.tanggal_mulai,
              onChange: (e) => setForm({ ...form, tanggal_mulai: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Berakhir (opsional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "date",
              value: form.tanggal_berakhir,
              onChange: (e) => setForm({ ...form, tanggal_berakhir: e.target.value })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            value: form.deskripsi,
            placeholder: "mis. Promo akhir bulan",
            onChange: (e) => setForm({ ...form, deskripsi: e.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex gap-2 justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\uFF0B Buat Voucher" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
          " Daftar Voucher"
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 220 },
            placeholder: "\u{1F50D} Cari kode...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        )
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F39F}\uFE0F" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada voucher" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Buat voucher untuk menarik pelanggan." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Kode" }),
          /* @__PURE__ */ jsx("th", { children: "Diskon" }),
          /* @__PURE__ */ jsx("th", { children: "Periode" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Dipakai" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((v) => {
          const st = statusVoucher(v);
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsxs("td", { children: [
              /* @__PURE__ */ jsx("div", { className: "font-extrabold", children: v.kode }),
              v.deskripsi && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: v.deskripsi })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "font-bold text-danger", children: v.tipe === "persen" ? `${v.nilai}%` : formatRupiah(v.nilai) }),
            /* @__PURE__ */ jsxs("td", { className: "text-sm text-muted", children: [
              v.tanggal_mulai || "\u2014",
              " ",
              /* @__PURE__ */ jsx("br", {}),
              "s/d ",
              v.tanggal_berakhir || "\u221E"
            ] }),
            /* @__PURE__ */ jsxs("td", { className: "text-right font-bold", children: [
              v.total_dipakai || 0,
              "\xD7"
            ] }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${st.cls}`, children: st.label }) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => toggleAktif(v), children: v.aktif ? "Nonaktifkan" : "Aktifkan" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(v), children: "\u2715" })
            ] }) })
          ] }, v.id);
        }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4DC}" }),
          " Riwayat Pemakaian"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          usage.length,
          " catatan"
        ] })
      ] }),
      usage.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada voucher yang dipakai." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Kode" }),
          /* @__PURE__ */ jsx("th", { children: "Pelanggan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Diskon" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: usage.map((u) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: new Date(u.tanggal_pakai).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }),
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: u.kode_voucher }),
          /* @__PURE__ */ jsx("td", { children: u.customer || "\u2014" }),
          /* @__PURE__ */ jsxs("td", { className: "text-right text-danger font-bold", children: [
            "\u2212",
            formatRupiah(u.diskon)
          ] })
        ] }, u.id)) })
      ] }) })
    ] })
  ] });
}
