import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
const formatWaktu = (v) => {
  if (!v) return "\u2014";
  const d = new Date(v);
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const AKSI_BADGE = {
  transaksi: "badge-success",
  tambah_produk: "badge-info",
  ubah_produk: "badge-warning",
  hapus_produk: "badge-danger",
  tambah_bahan: "badge-info",
  pembelian: "badge-warning",
  cashflow: "badge-neutral"
};
export default function Audit() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [aksiFilter, setAksiFilter] = useState("");
  const hapusLog = async (d) => {
    if (!confirm("Hapus catatan aktivitas ini?")) return;
    await supabase.from("audit_logs").delete().eq("id", d.id);
    fetchData();
  };
  const bersihkanLog = async () => {
    if (!confirm("Hapus SEMUA log lebih dari 30 hari?\n\nTindakan ini tidak bisa dibatalkan.")) return;
    const batas = new Date(Date.now() - 30 * 864e5).toISOString();
    await supabase.from("audit_logs").delete().lt("tanggal", batas);
    alert("\u2705 Log lama dibersihkan");
    fetchData();
  };
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("audit_logs").select("*").order("tanggal", { ascending: false }).limit(500);
    if (error2) setError(error2.message);
    else setData(data2 || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const aksiList = useMemo(() => {
    const s = new Set(data.map((d) => d.aksi).filter(Boolean));
    return [...s].sort();
  }, [data]);
  const filtered = data.filter((d) => {
    const matchAksi = !aksiFilter || d.aksi === aksiFilter;
    const hay = `${d.aksi || ""} ${d.user_email || ""} ${JSON.stringify(d.detail_json || {})}`.toLowerCase();
    const matchSearch = !search || hay.includes(search.toLowerCase());
    return matchAksi && matchSearch;
  });
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Audit Log", subtitle: "Riwayat aktivitas sistem" }, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2", style: { flex: 1 } }, /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 240 }, placeholder: "\u{1F50D} Cari aktivitas...", value: search, onChange: (e) => setSearch(e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 190 }, value: aksiFilter, onChange: (e) => setAksiFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Aksi"), aksiList.map((a) => /* @__PURE__ */ React.createElement("option", { key: a, value: a }, a)))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: fetchData }, "\u{1F504} Muat Ulang"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: bersihkanLog }, "\u{1F9F9} Bersihkan >30 hari")))), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F510}"), " Aktivitas"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " catatan")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F510}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada aktivitas"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catatan muncul saat ada transaksi, produk, atau pembelian baru.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Waktu"), /* @__PURE__ */ React.createElement("th", null, "Aksi"), /* @__PURE__ */ React.createElement("th", null, "Pengguna"), /* @__PURE__ */ React.createElement("th", null, "Detail"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((d) => /* @__PURE__ */ React.createElement("tr", { key: d.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted", style: { whiteSpace: "nowrap" } }, formatWaktu(d.tanggal)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${AKSI_BADGE[d.aksi] || "badge-neutral"}` }, d.aksi)), /* @__PURE__ */ React.createElement("td", null, d.user_email || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-xs text-muted", style: { maxWidth: 340, wordBreak: "break-word" } }, d.detail_json && Object.keys(d.detail_json).length ? JSON.stringify(d.detail_json).slice(0, 160) : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusLog(d) }, "\u2715")))))))));
}
