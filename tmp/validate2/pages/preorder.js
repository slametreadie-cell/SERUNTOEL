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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Pre-Order", subtitle: "Pesanan pelanggan sebelum produksi" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Pre-Order"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Masih Aktif"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, stat.aktif)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Belum Dibayar"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(stat.belumLunas))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Nilai Pesanan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, formatRupiah(stat.omzet)))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C5}"), " Catat Pre-Order")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Pelanggan *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.nama_customer, onChange: (e) => setForm({ ...form, nama_customer: e.target.value }), placeholder: "Nama" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP / WA" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Target Ambil"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tgl_target, onChange: (e) => setForm({ ...form, tgl_target: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Produk *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      list: "daftar-produk",
      value: form.produk,
      onChange: (e) => pilihProduk(e.target.value),
      placeholder: "Ketik atau pilih produk"
    }
  ), /* @__PURE__ */ React.createElement("datalist", { id: "daftar-produk" }, produk.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.nama_produk })))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Qty *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.qty, onChange: (e) => setForm({ ...form, qty: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Harga Satuan *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.harga, onChange: (e) => setForm({ ...form, harga: e.target.value }), placeholder: "0" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "DP (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.dp, onChange: (e) => setForm({ ...form, dp: e.target.value }) }))), totalForm > 0 && /* @__PURE__ */ React.createElement("div", { className: "alert alert-info" }, "Total ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(totalForm)), " \xB7 DP ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(Number(form.dp) || 0)), " \xB7 Sisa ", /* @__PURE__ */ React.createElement("b", { className: "text-danger" }, formatRupiah(sisaForm))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\uFF0B Catat Pre-Order")))), bayar && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4B5}"), " Pembayaran \u2014 ", bayar.row.nama_customer), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setBayar(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mb-3" }, "Sisa tagihan: ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(bayar.row.sisa))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jumlah Bayar"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: bayar.jumlah, onChange: (e) => setBayar({ ...bayar, jumlah: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setBayar({ ...bayar, jumlah: String(bayar.row.sisa) }) }, "Lunasi Semua"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanBayar, disabled: saving }, "\u{1F4BE} Simpan"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Daftar Pre-Order"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 200 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 140 }, value: statusFilter, onChange: (e) => setStatusFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Status"), Object.entries(STATUS).map(([k, v]) => /* @__PURE__ */ React.createElement("option", { key: k, value: k }, v.label))))), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4C5}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada pre-order"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catat pesanan pelanggan sebelum produksi.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Order"), /* @__PURE__ */ React.createElement("th", null, "Pelanggan"), /* @__PURE__ */ React.createElement("th", null, "Produk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Qty"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "DP"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Sisa"), /* @__PURE__ */ React.createElement("th", null, "Target"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(d.tgl_order)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, d.nama_customer), d.kontak && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, d.kontak)), /* @__PURE__ */ React.createElement("td", null, d.produk), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, d.qty), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(d.total)), /* @__PURE__ */ React.createElement("td", { className: "text-right text-success" }, formatRupiah(d.dp)), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger font-bold" }, formatRupiah(d.sisa)), /* @__PURE__ */ React.createElement("td", { className: "text-sm" }, tglID(d.tgl_target)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${STATUS[d.status]?.cls || "badge-neutral"}` }, STATUS[d.status]?.label || d.status)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, Number(d.sisa) > 0 && d.status !== "batal" && /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-primary", onClick: () => setBayar({ row: d, jumlah: String(d.sisa) }) }, "\u{1F4B5}"), d.status === "lunas" && /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(d, "selesai") }, "\u2713 Selesai"), d.status !== "batal" && d.status !== "selesai" && /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(d, "batal") }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(d) }, "\u2715"))))))))));
}
