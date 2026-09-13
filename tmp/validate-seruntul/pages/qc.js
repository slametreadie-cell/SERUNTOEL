import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const ITEM_DEFAULT = [
  "Kebersihan area & alat",
  "Bahan baku segar / tidak rusak",
  "Suhu penyimpanan sesuai",
  "Berat/ukuran produk konsisten",
  "Kemasan bersih & tersegel",
  "Label & tanggal produksi terpasang",
  "Rasa & tekstur sesuai standar",
  "Petugas pakai APD (masker/sarung tangan)"
];
const JENIS = ["Produksi Harian", "Sanitasi", "Bahan Baku", "Kemasan", "Pengiriman", "Lainnya"];
const RESULT_OPT = [
  { k: "ok", l: "\u2713", cls: "ok" },
  { k: "no", l: "\u2715", cls: "no" },
  { k: "na", l: "\u2013", cls: "na" }
];
export default function QC() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ tanggal: hariIni(), jenis: JENIS[0], petugas: "" });
  const [items, setItems] = useState(ITEM_DEFAULT.map((label) => ({ label, hasil: "ok", catatan: "" })));
  const [catatanAkhir, setCatatanAkhir] = useState("");
  const [itemBaru, setItemBaru] = useState("");
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("qc_checklists").select("*").order("tanggal", { ascending: false });
    if (error2) setError(error2.message);
    else setData(data2 || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const setHasil = (idx, hasil) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, hasil } : it));
  const setCatatanItem = (idx, catatan) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, catatan } : it));
  const hapusItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const tambahItem = () => {
    if (!itemBaru.trim()) return;
    setItems((prev) => [...prev, { label: itemBaru.trim(), hasil: "ok", catatan: "" }]);
    setItemBaru("");
  };
  const ringkas = useMemo(() => {
    const ok = items.filter((i) => i.hasil === "ok").length;
    const no = items.filter((i) => i.hasil === "no").length;
    const na = items.filter((i) => i.hasil === "na").length;
    const dinilai = ok + no;
    return { ok, no, na, total: items.length, persen: dinilai ? Math.round(ok / dinilai * 100) : 0 };
  }, [items]);
  const simpan = async () => {
    if (ringkas.total === 0) {
      setError("Tambahkan minimal 1 item pemeriksaan");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const itemsObj = {};
      items.forEach((it, i) => {
        itemsObj[`item_${i + 1}`] = { label: it.label, hasil: it.hasil, catatan: it.catatan };
      });
      const payload = {
        tanggal: form.tanggal || hariIni(),
        petugas: form.petugas || user?.email || null,
        jenis: form.jenis,
        items_json: { items: itemsObj, ringkasan: ringkas },
        status: ringkas.no === 0 ? "lulus" : "perlu_perbaikan",
        catatan: catatanAkhir || null
      };
      const { error: error2 } = editId ? await supabase.from("qc_checklists").update(payload).eq("id", editId) : await supabase.from("qc_checklists").insert(payload);
      if (error2) throw error2;
      logAudit({
        aksi: "qc_checklist",
        user,
        sheetTarget: "qc_checklists",
        detail: { jenis: form.jenis, ok: ringkas.ok, gagal: ringkas.no, persen: ringkas.persen }
      });
      setMsg(editId ? "\u2705 Pemeriksaan diperbarui" : ringkas.no === 0 ? `\u2705 QC LULUS (${ringkas.persen}% sesuai)` : `\u26A0\uFE0F Tersimpan \u2014 ${ringkas.no} item perlu perbaikan`);
      setEditId(null);
      setItems(ITEM_DEFAULT.map((label) => ({ label, hasil: "ok", catatan: "" })));
      setCatatanAkhir("");
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 5e3);
    }
  };
  const mulaiEdit = (row) => {
    const list = ambilItems(row);
    setEditId(row.id);
    setForm({ tanggal: (row.tanggal || "").slice(0, 10), jenis: row.jenis || JENIS[0], petugas: row.petugas || "" });
    setItems(list.length ? list.map((it) => ({ label: it.label, hasil: it.hasil || "ok", catatan: it.catatan || "" })) : []);
    setCatatanAkhir(row.catatan || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hapus = async (row) => {
    if (!confirm("Hapus catatan QC ini?")) return;
    await supabase.from("qc_checklists").delete().eq("id", row.id);
    fetchData();
  };
  const ambilItems = (row) => {
    const raw = row.items_json || {};
    const list = raw.items ? Object.values(raw.items) : [];
    return list.length ? list : Object.entries(raw).filter(([k]) => k !== "ringkasan").map(([, v]) => typeof v === "object" ? v : { label: String(v), hasil: "ok" });
  };
  return /* @__PURE__ */ jsxs(AppLayout, { title: "QC Checklist", subtitle: "Kontrol kualitas produksi", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u2705" }),
          " ",
          editId ? "Ubah Pemeriksaan" : "Pemeriksaan Baru"
        ] }),
        editId && /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => {
          setEditId(null);
          setItems(ITEM_DEFAULT.map((label) => ({ label, hasil: "ok", catatan: "" })));
          setCatatanAkhir("");
        }, children: "Batal Edit" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tanggal, onChange: (e) => setForm({ ...form, tanggal: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jenis Pemeriksaan" }),
          /* @__PURE__ */ jsx("select", { className: "form-control", value: form.jenis, onChange: (e) => setForm({ ...form, jenis: e.target.value }), children: JENIS.map((j) => /* @__PURE__ */ jsx("option", { value: j, children: j }, j)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Petugas" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.petugas, onChange: (e) => setForm({ ...form, petugas: e.target.value }), placeholder: user?.email || "Nama petugas" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "score-bar", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: "Skor Kepatuhan" }),
          /* @__PURE__ */ jsxs("div", { className: `score-val ${ringkas.no === 0 ? "text-success" : ringkas.persen >= 70 ? "text-warning" : "text-danger"}`, children: [
            ringkas.persen,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2 flex-wrap", children: [
          /* @__PURE__ */ jsxs("span", { className: "badge badge-success", children: [
            "\u2713 ",
            ringkas.ok,
            " sesuai"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "badge badge-danger", children: [
            "\u2715 ",
            ringkas.no,
            " gagal"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "badge badge-neutral", children: [
            "\u2013 ",
            ringkas.na,
            " n/a"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "qc-list", children: items.map((it, idx) => /* @__PURE__ */ jsxs("div", { className: `qc-item ${it.hasil === "no" ? "qc-no" : ""}`, children: [
        /* @__PURE__ */ jsx("div", { className: "qc-label", children: it.label }),
        /* @__PURE__ */ jsx("div", { className: "qc-btns", children: RESULT_OPT.map((o) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `qc-btn ${o.cls} ${it.hasil === o.k ? "sel" : ""}`,
            onClick: () => setHasil(idx, o.k),
            children: o.l
          },
          o.k
        )) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control qc-note",
            placeholder: "catatan",
            value: it.catatan,
            onChange: (e) => setCatatanItem(idx, e.target.value)
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-danger", onClick: () => hapusItem(idx), children: "\u2715" })
      ] }, idx)) }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            placeholder: "Tambah item pemeriksaan baru...",
            value: itemBaru,
            onChange: (e) => setItemBaru(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tambahItem();
              }
            }
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: tambahItem, children: "\uFF0B Tambah" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group mt-3", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Catatan Akhir" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            value: catatanAkhir,
            onChange: (e) => setCatatanAkhir(e.target.value),
            placeholder: "mis. perlu perbaikan kebersihan alat"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpan, disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : editId ? "\u{1F4BE} Perbarui" : "\u{1F4BE} Simpan Pemeriksaan" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
          " Riwayat Pemeriksaan"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
          data.length,
          " catatan"
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : data.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u2705" }),
        /* @__PURE__ */ jsx("h3", { children: "Belum ada pemeriksaan QC" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Lakukan pemeriksaan rutin untuk menjaga kualitas." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Jenis" }),
          /* @__PURE__ */ jsx("th", { children: "Petugas" }),
          /* @__PURE__ */ jsx("th", { children: "Hasil" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: data.map((row) => {
          const rk = row.items_json?.ringkasan || {};
          const no = rk.no || 0;
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(row.tanggal) }),
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: row.jenis || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-sm", children: row.petugas || "\u2014" }),
            /* @__PURE__ */ jsxs("td", { children: [
              /* @__PURE__ */ jsxs("span", { className: "badge badge-success", children: [
                rk.ok || 0,
                " \u2713"
              ] }),
              " ",
              no > 0 && /* @__PURE__ */ jsxs("span", { className: "badge badge-danger", children: [
                no,
                " \u2715"
              ] }),
              /* @__PURE__ */ jsxs("span", { className: "badge badge-neutral ml-1", children: [
                rk.persen || 0,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${row.status === "lulus" ? "badge-success" : "badge-warning"}`, children: row.status === "lulus" ? "Lulus" : "Perlu Perbaikan" }) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setDetail(detail?.id === row.id ? null : row), children: detail?.id === row.id ? "Tutup" : "Lihat" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => mulaiEdit(row), children: "\u270F\uFE0F" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(row), children: "\u2715" })
            ] }) })
          ] }, row.id);
        }) })
      ] }) }),
      detail && /* @__PURE__ */ jsxs("div", { style: { padding: 16, borderTop: "1px solid var(--border)" }, children: [
        /* @__PURE__ */ jsxs("div", { className: "font-bold mb-2", children: [
          "Detail: ",
          detail.jenis,
          " \u2014 ",
          tglID(detail.tanggal)
        ] }),
        ambilItems(detail).map((it, i) => /* @__PURE__ */ jsxs("div", { className: "detail-row", children: [
          /* @__PURE__ */ jsx("span", { className: `badge ${it.hasil === "ok" ? "badge-success" : it.hasil === "no" ? "badge-danger" : "badge-neutral"}`, children: it.hasil === "ok" ? "\u2713" : it.hasil === "no" ? "\u2715" : "\u2013" }),
          /* @__PURE__ */ jsx("span", { className: "flex-1", children: it.label }),
          it.catatan && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted", children: it.catatan })
        ] }, i)),
        detail.catatan && /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mt-2", children: [
          "Catatan: ",
          detail.catatan
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .score-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); margin-bottom: 12px; }
        .score-val { font-size: 26px; font-weight: 800; }
        .qc-list { display: flex; flex-direction: column; gap: 6px; }
        .qc-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
          padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .qc-no { border-color: var(--danger); background: rgba(220,53,69,.05); }
        .qc-label { font-size: 13px; grid-column: 1 / -1; }
        @media (min-width: 760px) { .qc-item { grid-template-columns: 1fr auto 180px auto; } .qc-label { grid-column: auto; } }
        .qc-btns { display: flex; gap: 4px; }
        .qc-btn { width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid var(--border);
          font-weight: 800; background: var(--card); transition: all .15s; }
        .qc-btn.sel.ok { border-color: var(--success, #16a34a); background: rgba(22,163,74,.12); color: var(--success, #16a34a); }
        .qc-btn.sel.no { border-color: var(--danger); background: rgba(220,53,69,.12); color: var(--danger); }
        .qc-btn.sel.na { border-color: var(--muted); background: var(--bg); }
        .qc-note { font-size: 12px; padding: 6px 8px; }
        .detail-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--border); font-size: 13px; }
      ` })
  ] });
}
