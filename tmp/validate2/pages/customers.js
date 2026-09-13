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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Pelanggan", subtitle: "Database pelanggan & riwayat belanja" }, /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(2,1fr)" } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Pelanggan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, totalPelanggan)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Belanja"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, formatRupiah(totalBelanja)))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2", style: { flex: 1 } }, /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 240 }, placeholder: "\u{1F50D} Cari nama/kontak...", value: search, onChange: (e) => setSearch(e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 160 }, value: channelFilter, onChange: (e) => setChannelFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Channel"), /* @__PURE__ */ React.createElement("option", { value: "offline" }, "Offline"), /* @__PURE__ */ React.createElement("option", { value: "online" }, "Online"), /* @__PURE__ */ React.createElement("option", { value: "reseller" }, "Reseller"))), /* @__PURE__ */ React.createElement(Link, { href: "/customers/tambah", className: "btn btn-primary" }, "\uFF0B Pelanggan"))), msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), editRow && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u270F\uFE0F"), " Ubah Pelanggan"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setEditRow(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.nama, onChange: (e) => setEditRow({ ...editRow, nama: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: editRow.kontak, onChange: (e) => setEditRow({ ...editRow, kontak: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Channel"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: editRow.channel, onChange: (e) => setEditRow({ ...editRow, channel: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "offline" }, "Offline"), /* @__PURE__ */ React.createElement("option", { value: "online" }, "Online"), /* @__PURE__ */ React.createElement("option", { value: "reseller" }, "Reseller")))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setEditRow(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanEditPelanggan }, "\u{1F4BE} Simpan"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F465}"), " Daftar Pelanggan"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " pelanggan")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F464}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada pelanggan"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Pelanggan otomatis tercatat saat transaksi POS dengan nama.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Kontak"), /* @__PURE__ */ React.createElement("th", null, "Channel"), /* @__PURE__ */ React.createElement("th", null, "Transaksi"), /* @__PURE__ */ React.createElement("th", null, "Total Belanja"), /* @__PURE__ */ React.createElement("th", null, "Terakhir"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((c) => /* @__PURE__ */ React.createElement("tr", { key: c.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, c.nama), /* @__PURE__ */ React.createElement("td", null, c.kontak || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${c.channel === "reseller" ? "badge-warning" : c.channel === "online" ? "badge-info" : "badge-neutral"}` }, c.channel || "offline")), /* @__PURE__ */ React.createElement("td", null, c.total_transaksi || 0), /* @__PURE__ */ React.createElement("td", { className: "text-primary font-bold" }, formatRupiah(c.total_belanja)), /* @__PURE__ */ React.createElement("td", { className: "text-muted" }, formatTanggal(c.last_order)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn btn-sm btn-outline",
      onClick: () => setEditRow({ id: c.id, nama: c.nama, kontak: c.kontak || "", channel: c.channel || "offline" })
    },
    "\u270F\uFE0F"
  ), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusPelanggan(c) }, "\u2715"))))))))));
}
