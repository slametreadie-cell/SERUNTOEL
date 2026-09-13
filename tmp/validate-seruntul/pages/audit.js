import { jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Audit Log", subtitle: "Riwayat aktivitas sistem", children: [
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", style: { flex: 1 }, children: [
        /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 240 }, placeholder: "\u{1F50D} Cari aktivitas...", value: search, onChange: (e) => setSearch(e.target.value) }),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 190 }, value: aksiFilter, onChange: (e) => setAksiFilter(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Aksi" }),
          aksiList.map((a) => /* @__PURE__ */ jsx("option", { value: a, children: a }, a))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: fetchData, children: "\u{1F504} Muat Ulang" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: bersihkanLog, children: "\u{1F9F9} Bersihkan >30 hari" })
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F510}" }),
          " Aktivitas"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          filtered.length,
          " catatan"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F510}" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada aktivitas" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Catatan muncul saat ada transaksi, produk, atau pembelian baru." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Waktu" }),
          /* @__PURE__ */ jsx("th", { children: "Aksi" }),
          /* @__PURE__ */ jsx("th", { children: "Pengguna" }),
          /* @__PURE__ */ jsx("th", { children: "Detail" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "text-muted", style: { whiteSpace: "nowrap" }, children: formatWaktu(d.tanggal) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${AKSI_BADGE[d.aksi] || "badge-neutral"}`, children: d.aksi }) }),
          /* @__PURE__ */ jsx("td", { children: d.user_email || "\u2014" }),
          /* @__PURE__ */ jsx("td", { className: "text-xs text-muted", style: { maxWidth: 340, wordBreak: "break-word" }, children: d.detail_json && Object.keys(d.detail_json).length ? JSON.stringify(d.detail_json).slice(0, 160) : "\u2014" }),
          /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusLog(d), children: "\u2715" }) })
        ] }, d.id)) })
      ] }) })
    ] })
  ] });
}
