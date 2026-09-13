import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const formatTanggal = (v) => {
  if (!v) return "\u2014";
  const d = new Date(v);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
export default function Pelanggan() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [msg, setMsg] = useState("");
  const hapusPelanggan = async (c) => {
    if (!confirm(`Hapus pelanggan "${c.nama}"?

Riwayat transaksinya tetap tersimpan.`)) return;
    await supabase.from("customers").delete().eq("id", c.id);
    logAudit({ aksi: "hapus_pelanggan", user, sheetTarget: "customers", detail: { nama: c.nama } });
    setMsg(`\u2705 Pelanggan ${c.nama} dihapus`);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const simpanEditPelanggan = async () => {
    if (!editRow) return;
    if (!editRow.nama?.trim()) {
      alert("Nama tidak boleh kosong");
      return;
    }
    await supabase.from("customers").update({
      nama: editRow.nama.trim(),
      kontak: editRow.kontak || null,
      channel: editRow.channel || "offline"
    }).eq("id", editRow.id);
    logAudit({ aksi: "ubah_pelanggan", user, sheetTarget: "customers", detail: { nama: editRow.nama } });
    setMsg("\u2705 Data pelanggan diperbarui");
    setEditRow(null);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("customers").select("*").order("total_belanja", { ascending: false });
    if (error2) setError(error2.message);
    else setData(data2 || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const filtered = data.filter((c) => {
    const matchSearch = !search || (c.nama || "").toLowerCase().includes(search.toLowerCase()) || (c.kontak || "").toLowerCase().includes(search.toLowerCase());
    const matchChannel = !channelFilter || c.channel === channelFilter;
    return matchSearch && matchChannel;
  });
  const totalPelanggan = data.length;
  const totalBelanja = data.reduce((s, c) => s + Number(c.total_belanja || 0), 0);
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Pelanggan", subtitle: "Database pelanggan & riwayat belanja", children: [
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(2,1fr)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Pelanggan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: totalPelanggan })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Belanja" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: formatRupiah(totalBelanja) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 240 }, placeholder: "\u{1F50D} Cari nama/kontak...", value: search, onChange: (e) => setSearch(e.target.value) }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 160 }, value: channelFilter, onChange: (e) => setChannelFilter(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Channel" }),
          /* @__PURE__ */ jsx("option", { value: "offline", children: "Offline" }),
          /* @__PURE__ */ jsx("option", { value: "online", children: "Online" }),
          /* @__PURE__ */ jsx("option", { value: "reseller", children: "Reseller" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Link, { href: "/customers/tambah", className: "btn btn-primary", children: "\uFF0B Pelanggan" })
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
          " Ubah Pelanggan"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.nama, onChange: (e) => setEditRow({ ...editRow, nama: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: editRow.kontak, onChange: (e) => setEditRow({ ...editRow, kontak: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Channel" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: editRow.channel, onChange: (e) => setEditRow({ ...editRow, channel: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "offline", children: "Offline" }),
            /* @__PURE__ */ jsx("option", { value: "online", children: "Online" }),
            /* @__PURE__ */ jsx("option", { value: "reseller", children: "Reseller" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setEditRow(null), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanEditPelanggan, children: "\u{1F4BE} Simpan" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F465}" }),
          " Daftar Pelanggan"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          filtered.length,
          " pelanggan"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F464}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada pelanggan" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Pelanggan otomatis tercatat saat transaksi POS dengan nama." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          /* @__PURE__ */ jsx("th", { children: "Kontak" }),
          /* @__PURE__ */ jsx("th", { children: "Channel" }),
          /* @__PURE__ */ jsx("th", { children: "Transaksi" }),
          /* @__PURE__ */ jsx("th", { children: "Total Belanja" }),
          /* @__PURE__ */ jsx("th", { children: "Terakhir" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((c) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: c.nama }),
          /* @__PURE__ */ jsx("td", { children: c.kontak || "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${c.channel === "reseller" ? "badge-warning" : c.channel === "online" ? "badge-info" : "badge-neutral"}`, children: c.channel || "offline" }) }),
          /* @__PURE__ */ jsx("td", { children: c.total_transaksi || 0 }),
          /* @__PURE__ */ jsx("td", { className: "text-primary font-bold", children: formatRupiah(c.total_belanja) }),
          /* @__PURE__ */ jsx("td", { className: "text-muted", children: formatTanggal(c.last_order) }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "btn btn-sm btn-outline",
                onClick: () => setEditRow({ id: c.id, nama: c.nama, kontak: c.kontak || "", channel: c.channel || "offline" }),
                children: "\u270F\uFE0F"
              }
            ),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusPelanggan(c), children: "\u2715" })
          ] }) })
        ] }, c.id)) })
      ] }) })
    ] })
  ] });
}
