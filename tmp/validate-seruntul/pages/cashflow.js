import { jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Cashflow", subtitle: "Arus kas masuk & keluar", children: [
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(3,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Uang Masuk" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-success", children: formatRupiah(totalMasuk) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Uang Keluar" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(totalKeluar) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Saldo" }),
        /* @__PURE__ */ jsx("div", { className: `metric-value ${saldo >= 0 ? "text-primary" : "text-danger"}`, children: formatRupiah(saldo) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 150 }, value: filterJenis, onChange: (e) => setFilterJenis(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Jenis" }),
          /* @__PURE__ */ jsx("option", { value: "masuk", children: "Masuk" }),
          /* @__PURE__ */ jsx("option", { value: "keluar", children: "Keluar" })
        ] }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 160 }, value: filterBulan, onChange: (e) => setFilterBulan(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Bulan" }),
          bulanList.map((b) => /* @__PURE__ */ jsx("option", { value: b, children: b }, b))
        ] })
      ] }),
      /* @__PURE__ */ jsx(Link, { href: "/cashflow/tambah", className: "btn btn-primary", children: "\uFF0B Catat Transaksi" })
    ] }) }),
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    editRow && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u270F\uFE0F" }),
          " Ubah Catatan"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: (editRow.tanggal || "").slice(0, 10), onChange: (e) => setEditRow({ ...editRow, tanggal: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jenis" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: editRow.jenis, onChange: (e) => setEditRow({ ...editRow, jenis: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "masuk", children: "Masuk" }),
            /* @__PURE__ */ jsx("option", { value: "keluar", children: "Keluar" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jumlah (Rp)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: editRow.jumlah, onChange: (e) => setEditRow({ ...editRow, jumlah: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kategori" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.kategori || "", onChange: (e) => setEditRow({ ...editRow, kategori: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.keterangan || "", onChange: (e) => setEditRow({ ...editRow, keterangan: e.target.value }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setEditRow(null), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanEditCatatan, children: "\u{1F4BE} Simpan" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4D2}" }),
          " Riwayat Transaksi"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          filtered.length,
          " catatan"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4B8}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada transaksi" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Catat pemasukan atau pengeluaran pertama Anda." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Keterangan" }),
          /* @__PURE__ */ jsx("th", { children: "Kategori" }),
          /* @__PURE__ */ jsx("th", { children: "Jenis" }),
          /* @__PURE__ */ jsx("th", { children: "Jumlah" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: d.tanggal }),
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: d.keterangan }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: d.kategori }) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${d.jenis === "masuk" ? "badge-success" : "badge-danger"}`, children: d.jenis === "masuk" ? "\u2191 Masuk" : "\u2193 Keluar" }) }),
          /* @__PURE__ */ jsxs("td", { className: `font-bold ${d.jenis === "masuk" ? "text-success" : "text-danger"}`, children: [
            d.jenis === "masuk" ? "+" : "\u2212",
            formatRupiah(d.jumlah)
          ] }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "btn btn-sm btn-outline",
                onClick: () => setEditRow({ id: d.id, tanggal: d.tanggal, keterangan: d.keterangan, kategori: d.kategori, jenis: d.jenis, jumlah: d.jumlah }),
                children: "\u270F\uFE0F"
              }
            ),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusCatatan(d), children: "\u2715" })
          ] }) })
        ] }, d.id)) })
      ] }) })
    ] })
  ] });
}
