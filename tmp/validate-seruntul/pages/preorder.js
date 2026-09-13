import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const STATUS = {
  pending: { label: "Pending", cls: "badge-neutral" },
  dp: { label: "DP", cls: "badge-warning" },
  lunas: { label: "Lunas", cls: "badge-info" },
  selesai: { label: "Selesai", cls: "badge-success" },
  batal: { label: "Batal", cls: "badge-danger" }
};
export default function PreOrder() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    nama_customer: "",
    kontak: "",
    produk: "",
    qty: "1",
    harga: "",
    dp: "0",
    tgl_target: "",
    tgl_order: hariIni()
  });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [oRes, pRes] = await Promise.all([
      supabase.from("pre_orders").select("*").order("tgl_order", { ascending: false }),
      supabase.from("products").select("id, nama_produk, harga_jual").order("nama_produk")
    ]);
    if (oRes.error) setError(oRes.error.message);
    setData(oRes.data || []);
    setProduk(pRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const pilihProduk = (val) => {
    const p = produk.find((x) => x.nama_produk === val);
    setForm((f) => ({
      ...f,
      produk: val,
      harga: p ? String(p.harga_jual || "") : f.harga
    }));
  };
  const totalForm = (Number(form.qty) || 0) * (Number(form.harga) || 0);
  const sisaForm = Math.max(0, totalForm - (Number(form.dp) || 0));
  const simpan = async (e) => {
    e.preventDefault();
    if (!form.nama_customer.trim()) {
      setError("Nama pelanggan wajib diisi");
      return;
    }
    if (!form.produk.trim()) {
      setError("Produk wajib diisi");
      return;
    }
    const qty = Number(form.qty) || 0;
    const harga = Number(form.harga) || 0;
    if (qty <= 0 || harga <= 0) {
      setError("Qty dan harga harus lebih dari 0");
      return;
    }
    const total = qty * harga;
    const dp = Number(form.dp) || 0;
    if (dp > total) {
      setError("DP tidak boleh melebihi total");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("pre_orders").insert({
        tgl_order: form.tgl_order || hariIni(),
        nama_customer: form.nama_customer.trim(),
        kontak: form.kontak || null,
        produk: form.produk.trim(),
        qty,
        harga,
        total,
        dp,
        sisa: total - dp,
        status: dp >= total && total > 0 ? "lunas" : dp > 0 ? "dp" : "pending",
        tgl_target: form.tgl_target || null
      });
      if (error2) throw error2;
      logAudit({
        aksi: "tambah_preorder",
        user,
        sheetTarget: "pre_orders",
        detail: { customer: form.nama_customer, produk: form.produk, qty, total }
      });
      setMsg("\u2705 Pre-order dicatat");
      setForm({ nama_customer: "", kontak: "", produk: "", qty: "1", harga: "", dp: "0", tgl_target: "", tgl_order: hariIni() });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const [bayar, setBayar] = useState(null);
  const simpanBayar = async () => {
    if (!bayar) return;
    const nominal = Number(bayar.jumlah) || 0;
    if (nominal <= 0) {
      setError("Jumlah harus lebih dari 0");
      return;
    }
    setSaving(true);
    try {
      const row = bayar.row;
      const dpBaru = Math.min(row.total, (Number(row.dp) || 0) + nominal);
      const sisa = row.total - dpBaru;
      const { error: error2 } = await supabase.from("pre_orders").update({
        dp: dpBaru,
        sisa,
        status: sisa <= 0 ? "lunas" : "dp"
      }).eq("id", row.id);
      if (error2) throw error2;
      await supabase.from("cashflow").insert({
        tanggal: hariIni(),
        keterangan: `Pembayaran pre-order \u2014 ${row.nama_customer || "-"} (${row.produk})`,
        kategori: "Penjualan",
        jenis: "masuk",
        jumlah: nominal,
        saldo: 0
      });
      logAudit({ aksi: "bayar_preorder", user, sheetTarget: "pre_orders", detail: { customer: row.nama_customer, nominal } });
      setMsg(sisa <= 0 ? "\u2705 Pre-order lunas!" : `\u2705 Pembayaran dicatat (sisa ${formatRupiah(sisa)})`);
      setBayar(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  const ubahStatus = async (row, status) => {
    await supabase.from("pre_orders").update({ status }).eq("id", row.id);
    logAudit({ aksi: "ubah_preorder", user, sheetTarget: "pre_orders", detail: { customer: row.nama_customer, status } });
    fetchData();
  };
  const hapus = async (row) => {
    if (!confirm(`Hapus pre-order ${row.nama_customer}?`)) return;
    await supabase.from("pre_orders").delete().eq("id", row.id);
    fetchData();
  };
  const filtered = data.filter((d) => {
    const okS = !statusFilter || d.status === statusFilter;
    const okQ = !search || (d.nama_customer || "").toLowerCase().includes(search.toLowerCase()) || (d.produk || "").toLowerCase().includes(search.toLowerCase());
    return okS && okQ;
  });
  const stat = useMemo(() => {
    const aktif = data.filter((d) => ["pending", "dp"].includes(d.status));
    return {
      total: data.length,
      aktif: aktif.length,
      belumLunas: aktif.reduce((s, d) => s + Number(d.sisa || 0), 0),
      omzet: data.filter((d) => d.status !== "batal").reduce((s, d) => s + Number(d.total || 0), 0)
    };
  }, [data]);
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Pre-Order", subtitle: "Pesanan pelanggan sebelum produksi", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Pre-Order" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Masih Aktif" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-warning", children: stat.aktif })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Belum Dibayar" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(stat.belumLunas) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Nilai Pesanan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-success", children: formatRupiah(stat.omzet) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C5}" }),
        " Catat Pre-Order"
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Pelanggan *" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.nama_customer, onChange: (e) => setForm({ ...form, nama_customer: e.target.value }), placeholder: "Nama" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP / WA" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Target Ambil" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tgl_target, onChange: (e) => setForm({ ...form, tgl_target: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 2 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Produk *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              list: "daftar-produk",
              value: form.produk,
              onChange: (e) => pilihProduk(e.target.value),
              placeholder: "Ketik atau pilih produk"
            }
          ),
          /* @__PURE__ */ jsx("datalist", { id: "daftar-produk", children: produk.map((p) => /* @__PURE__ */ jsx("option", { value: p.nama_produk }, p.id)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Qty *" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.qty, onChange: (e) => setForm({ ...form, qty: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Harga Satuan *" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.harga, onChange: (e) => setForm({ ...form, harga: e.target.value }), placeholder: "0" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "DP (Rp)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.dp, onChange: (e) => setForm({ ...form, dp: e.target.value }) })
        ] })
      ] }),
      totalForm > 0 && /* @__PURE__ */ jsxs("div", { className: "alert alert-info", children: [
        "Total ",
        /* @__PURE__ */ jsx("b", { children: formatRupiah(totalForm) }),
        " \xB7 DP ",
        /* @__PURE__ */ jsx("b", { children: formatRupiah(Number(form.dp) || 0) }),
        " \xB7 Sisa ",
        /* @__PURE__ */ jsx("b", { className: "text-danger", children: formatRupiah(sisaForm) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\uFF0B Catat Pre-Order" }) })
    ] }) }),
    bayar && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4B5}" }),
          " Pembayaran \u2014 ",
          bayar.row.nama_customer
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setBayar(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mb-3", children: [
        "Sisa tagihan: ",
        /* @__PURE__ */ jsx("b", { children: formatRupiah(bayar.row.sisa) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "form-row", children: /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jumlah Bayar" }),
        /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: bayar.jumlah, onChange: (e) => setBayar({ ...bayar, jumlah: e.target.value }) })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setBayar({ ...bayar, jumlah: String(bayar.row.sisa) }), children: "Lunasi Semua" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanBayar, disabled: saving, children: "\u{1F4BE} Simpan" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
          " Daftar Pre-Order"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 200 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 140 }, value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Semua Status" }),
            Object.entries(STATUS).map(([k, v]) => /* @__PURE__ */ jsx("option", { value: k, children: v.label }, k))
          ] })
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4C5}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada pre-order" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Catat pesanan pelanggan sebelum produksi." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Order" }),
          /* @__PURE__ */ jsx("th", { children: "Pelanggan" }),
          /* @__PURE__ */ jsx("th", { children: "Produk" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Qty" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "DP" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Sisa" }),
          /* @__PURE__ */ jsx("th", { children: "Target" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(d.tgl_order) }),
          /* @__PURE__ */ jsxs("td", { children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold", children: d.nama_customer }),
            d.kontak && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: d.kontak })
          ] }),
          /* @__PURE__ */ jsx("td", { children: d.produk }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: d.qty }),
          /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(d.total) }),
          /* @__PURE__ */ jsx("td", { className: "text-right text-success", children: formatRupiah(d.dp) }),
          /* @__PURE__ */ jsx("td", { className: "text-right text-danger font-bold", children: formatRupiah(d.sisa) }),
          /* @__PURE__ */ jsx("td", { className: "text-sm", children: tglID(d.tgl_target) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${STATUS[d.status]?.cls || "badge-neutral"}`, children: STATUS[d.status]?.label || d.status }) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
            Number(d.sisa) > 0 && d.status !== "batal" && /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-primary", onClick: () => setBayar({ row: d, jumlah: String(d.sisa) }), children: "\u{1F4B5}" }),
            d.status === "lunas" && /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(d, "selesai"), children: "\u2713 Selesai" }),
            d.status !== "batal" && d.status !== "selesai" && /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(d, "batal"), children: "Batal" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d), children: "\u2715" })
          ] }) })
        ] }, d.id)) })
      ] }) })
    ] })
  ] });
}
