import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const KATEGORI_MASUK = ["Penjualan", "Modal", "Hutang", "Piutang", "Lainnya"];
const KATEGORI_KELUAR = ["Pembelian Bahan", "Operasional", "Gaji", "Sewa", "Utilitas", "Marketing", "Lainnya"];
export default function Cashflow() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [msg, setMsg] = useState("");
  const hapusCatatan = async (d) => {
    if (!confirm(`Hapus catatan "${d.keterangan}"?`)) return;
    await supabase.from("cashflow").delete().eq("id", d.id);
    logAudit({ aksi: "hapus_cashflow", user, sheetTarget: "cashflow", detail: { keterangan: d.keterangan, jumlah: d.jumlah } });
    setMsg("\u2705 Catatan dihapus");
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const simpanEditCatatan = async () => {
    if (!editRow) return;
    const jumlah = Number(editRow.jumlah);
    if (!jumlah || jumlah <= 0) {
      alert("Jumlah harus lebih dari 0");
      return;
    }
    await supabase.from("cashflow").update({
      tanggal: editRow.tanggal,
      keterangan: editRow.keterangan,
      kategori: editRow.kategori,
      jenis: editRow.jenis,
      jumlah
    }).eq("id", editRow.id);
    logAudit({ aksi: "ubah_cashflow", user, sheetTarget: "cashflow", detail: { keterangan: editRow.keterangan } });
    setMsg("\u2705 Catatan diperbarui");
    setEditRow(null);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("cashflow").select("*").order("tanggal", { ascending: false }).order("created_at", { ascending: false });
    if (error2) setError(error2.message);
    else setData(data2 || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const totalMasuk = data.filter((d) => d.jenis === "masuk").reduce((s, d) => s + Number(d.jumlah || 0), 0);
  const totalKeluar = data.filter((d) => d.jenis === "keluar").reduce((s, d) => s + Number(d.jumlah || 0), 0);
  const saldo = totalMasuk - totalKeluar;
  const bulanList = useMemo(() => {
    const s = new Set(data.map((d) => (d.tanggal || "").slice(0, 7)));
    return [...s].sort().reverse();
  }, [data]);
  const filtered = data.filter((d) => {
    const matchJenis = !filterJenis || d.jenis === filterJenis;
    const matchBulan = !filterBulan || (d.tanggal || "").startsWith(filterBulan);
    const matchSearch = !search || (d.keterangan || "").toLowerCase().includes(search.toLowerCase()) || (d.kategori || "").toLowerCase().includes(search.toLowerCase());
    return matchJenis && matchBulan && matchSearch;
  });
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Cashflow", subtitle: "Arus kas masuk & keluar" }, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Uang Masuk"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, formatRupiah(totalMasuk))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Uang Keluar"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(totalKeluar))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Saldo"), /* @__PURE__ */ React.createElement("div", { className: `metric-value ${saldo >= 0 ? "text-primary" : "text-danger"}` }, formatRupiah(saldo)))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2", style: { flex: 1 } }, /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 150 }, value: filterJenis, onChange: (e) => setFilterJenis(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Jenis"), /* @__PURE__ */ React.createElement("option", { value: "masuk" }, "Masuk"), /* @__PURE__ */ React.createElement("option", { value: "keluar" }, "Keluar")), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 160 }, value: filterBulan, onChange: (e) => setFilterBulan(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Bulan"), bulanList.map((b) => /* @__PURE__ */ React.createElement("option", { key: b, value: b }, b)))), /* @__PURE__ */ React.createElement(Link, { href: "/cashflow/tambah", className: "btn btn-primary" }, "\uFF0B Catat Transaksi"))), msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), editRow && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u270F\uFE0F"), " Ubah Catatan"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: (editRow.tanggal || "").slice(0, 10), onChange: (e) => setEditRow({ ...editRow, tanggal: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jenis"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: editRow.jenis, onChange: (e) => setEditRow({ ...editRow, jenis: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "masuk" }, "Masuk"), /* @__PURE__ */ React.createElement("option", { value: "keluar" }, "Keluar"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jumlah (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: editRow.jumlah, onChange: (e) => setEditRow({ ...editRow, jumlah: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kategori"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.kategori || "", onChange: (e) => setEditRow({ ...editRow, kategori: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.keterangan || "", onChange: (e) => setEditRow({ ...editRow, keterangan: e.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setEditRow(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanEditCatatan }, "\u{1F4BE} Simpan"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4D2}"), " Riwayat Transaksi"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " catatan")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F4B8}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada transaksi"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catat pemasukan atau pengeluaran pertama Anda.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Keterangan"), /* @__PURE__ */ React.createElement("th", null, "Kategori"), /* @__PURE__ */ React.createElement("th", null, "Jenis"), /* @__PURE__ */ React.createElement("th", null, "Jumlah"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", null, d.tanggal), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, d.keterangan), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, d.kategori)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${d.jenis === "masuk" ? "badge-success" : "badge-danger"}` }, d.jenis === "masuk" ? "\u2191 Masuk" : "\u2193 Keluar")), /* @__PURE__ */ React.createElement("td", { className: `font-bold ${d.jenis === "masuk" ? "text-success" : "text-danger"}` }, d.jenis === "masuk" ? "+" : "\u2212", formatRupiah(d.jumlah)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-sm btn-outline",
      onClick: () => setEditRow({ id: d.id, tanggal: d.tanggal, keterangan: d.keterangan, kategori: d.kategori, jenis: d.jenis, jumlah: d.jumlah })
    },
    "\u270F\uFE0F"
  ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusCatatan(d) }, "\u2715"))))))))));
}
