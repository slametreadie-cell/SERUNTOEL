import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
export default function StokOpname() {
  const { user } = useAuth();
  const [tab, setTab] = useState("bahan");
  const [bahan, setBahan] = useState([]);
  const [produk, setProduk] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [opname, setOpname] = useState(null);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [bRes, pRes, rRes] = await Promise.all([
      supabase.from("ingredients").select("*").order("nama_bahan"),
      supabase.from("products").select("id, nama_produk, kategori, stok_produk").order("nama_produk"),
      supabase.from("stock_cards").select("*").order("created_at", { ascending: false }).limit(300)
    ]);
    if (bRes.error) setError(bRes.error.message);
    setBahan(bRes.data || []);
    setProduk(pRes.data || []);
    setRiwayat(rRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const daftar = tab === "bahan" ? bahan.map((b) => ({ id: b.id, nama: b.nama_bahan, satuan: b.satuan || "pcs", stok: b.stok_sisa || 0, min: b.stok_minimum || 0, kategori: null })) : produk.map((p) => ({ id: p.id, nama: p.nama_produk, satuan: "pcs", stok: p.stok_produk || 0, min: 0, kategori: p.kategori }));
  const filtered = daftar.filter((d) => !search || (d.nama || "").toLowerCase().includes(search.toLowerCase()));
  const stat = useMemo(() => {
    const kritis = daftar.filter((d) => d.min > 0 && d.stok <= d.min);
    const habis = daftar.filter((d) => d.stok <= 0);
    return {
      total: daftar.length,
      kritis: kritis.length,
      habis: habis.length,
      nilai: bahan.reduce((s, b) => s + (b.stok_sisa || 0), 0)
    };
  }, [daftar, bahan]);
  const mulaiOpname = (item) => {
    setOpname({ item, jenis: opname?.jenis || tab, stokFisik: String(item.stok), alasan: "" });
  };
  const simpanOpname = async () => {
    if (!opname) return;
    const fisik = Number(opname.stokFisik);
    if (Number.isNaN(fisik) || fisik < 0) {
      setError("Stok fisik tidak valid");
      return;
    }
    const { item } = opname;
    const selisih = fisik - item.stok;
    setSaving(true);
    setError("");
    try {
      if (tab === "bahan") {
        await supabase.from("ingredients").update({ stok_sisa: fisik }).eq("id", item.id);
        await supabase.from("stock_cards").insert({
          bahan_id: item.id,
          nama_bahan: item.nama,
          satuan: item.satuan,
          stok_awal: item.stok,
          masuk: selisih > 0 ? selisih : 0,
          keluar: selisih < 0 ? Math.abs(selisih) : 0,
          stok_sisa: fisik,
          status: "opname"
        });
      } else {
        await supabase.from("products").update({ stok_produk: fisik }).eq("id", item.id);
      }
      logAudit({
        aksi: "stok_opname",
        user,
        sheetTarget: tab === "bahan" ? "ingredients" : "products",
        detail: { nama: item.nama, stok_lama: item.stok, stok_fisik: fisik, selisih, alasan: opname.alasan || null }
      });
      setMsg(selisih === 0 ? `\u2705 ${item.nama}: stok sudah sesuai` : `\u2705 ${item.nama}: dikoreksi ${selisih > 0 ? "+" : ""}${selisih} ${item.satuan}`);
      setOpname(null);
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Stok & Opname", subtitle: "Cek fisik stok dan koreksi selisih", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Item" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Stok Kritis" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-warning", children: stat.kritis })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Stok Habis" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: stat.habis })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Catatan Opname" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: riwayat.length })
      ] })
    ] }),
    opname && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
          " Opname \u2014 ",
          opname.item.nama
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setOpname(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mb-3", children: [
        "Stok tercatat sistem: ",
        /* @__PURE__ */ jsxs("b", { children: [
          opname.item.stok,
          " ",
          opname.item.satuan
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stok Fisik Hasil Hitung" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              autoFocus: true,
              value: opname.stokFisik,
              onChange: (e) => setOpname({ ...opname, stokFisik: e.target.value })
            }
          ),
          opname.stokFisik !== "" && /* @__PURE__ */ jsxs("div", { className: `text-sm mt-1 ${Number(opname.stokFisik) - opname.item.stok === 0 ? "text-success" : "text-danger"}`, children: [
            "Selisih: ",
            /* @__PURE__ */ jsxs("b", { children: [
              Number(opname.stokFisik) - opname.item.stok > 0 ? "+" : "",
              Number(opname.stokFisik) - opname.item.stok,
              " ",
              opname.item.satuan
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Alasan Selisih (opsional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: opname.alasan,
              onChange: (e) => setOpname({ ...opname, alasan: e.target.value }),
              placeholder: "mis. tumpah, salah catat, susut"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanOpname, disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\u{1F4BE} Simpan Koreksi" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${tab === "bahan" ? "btn-primary" : "btn-outline"}`, onClick: () => {
            setTab("bahan");
            setOpname(null);
          }, children: "\u{1F9C2} Bahan Baku" }),
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${tab === "produk" ? "btn-primary" : "btn-outline"}`, onClick: () => {
            setTab("produk");
            setOpname(null);
          }, children: "\u{1F4E6} Produk Jadi" })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 220 },
            placeholder: "\u{1F50D} Cari...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        )
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F4CB}" }),
        /* @__PURE__ */ jsxs("h3", { children: [
          "Belum ada ",
          tab === "bahan" ? "bahan baku" : "produk"
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm", children: [
          "Tambahkan ",
          tab === "bahan" ? "bahan di menu Inventory" : "produk di menu Produk & HPP",
          "."
        ] })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          tab === "produk" && /* @__PURE__ */ jsx("th", { children: "Kategori" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Stok Sistem" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Stok Min" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((d) => {
          const kritis = d.min > 0 && d.stok <= d.min;
          const habis = d.stok <= 0;
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: d.nama }),
            tab === "produk" && /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: d.kategori || "\u2014" }) }),
            /* @__PURE__ */ jsxs("td", { className: "text-right font-bold", children: [
              d.stok,
              " ",
              /* @__PURE__ */ jsx("span", { className: "text-muted text-xs", children: d.satuan })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-muted", children: d.min || "\u2014" }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${habis ? "badge-danger" : kritis ? "badge-warning" : "badge-success"}`, children: habis ? "Habis" : kritis ? "Kritis" : "Aman" }) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => mulaiOpname(d), children: "\u{1F4CB} Opname" }) })
          ] }, d.id);
        }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F5C2}\uFE0F" }),
          " Kartu Stok (Mutasi Bahan)"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          riwayat.length,
          " catatan"
        ] })
      ] }),
      riwayat.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada mutasi stok. Catatan muncul setelah opname atau pembelian bahan." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Bahan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Awal" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Masuk" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Keluar" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Sisa" }),
          /* @__PURE__ */ jsx("th", { children: "Ket" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: riwayat.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(r.created_at) }),
          /* @__PURE__ */ jsx("td", { className: "font-bold", children: r.nama_bahan }),
          /* @__PURE__ */ jsx("td", { className: "text-right text-muted", children: r.stok_awal }),
          /* @__PURE__ */ jsx("td", { className: "text-right text-success font-bold", children: r.masuk ? `+${r.masuk}` : "\u2014" }),
          /* @__PURE__ */ jsx("td", { className: "text-right text-danger font-bold", children: r.keluar ? `\u2212${r.keluar}` : "\u2014" }),
          /* @__PURE__ */ jsxs("td", { className: "text-right font-bold", children: [
            r.stok_sisa,
            " ",
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: r.satuan })
          ] }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: r.status || "\u2014" }) })
        ] }, r.id)) })
      ] }) })
    ] })
  ] });
}
