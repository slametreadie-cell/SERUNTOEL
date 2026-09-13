import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
const STATUS_ABSEN = {
  hadir: { l: "Hadir", cls: "badge-success" },
  izin: { l: "Izin", cls: "badge-info" },
  sakit: { l: "Sakit", cls: "badge-warning" },
  alpa: { l: "Alpa", cls: "badge-danger" }
};
const JABATAN = ["Kasir", "Produksi", "Packing", "Marketing", "Gudang", "Admin", "Kurir", "Lainnya"];
export default function Karyawan() {
  const { user } = useAuth();
  const [tab, setTab] = useState("karyawan");
  const [karyawan, setKaryawan] = useState([]);
  const [absen, setAbsen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nama: "", kontak: "", jabatan: JABATAN[0], gaji: "", tgl_masuk: hariIni(), shift: "", catatan: "" });
  const [tanggalAbsen, setTanggalAbsen] = useState(hariIni());
  const [editId, setEditId] = useState(null);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [kRes, aRes] = await Promise.all([
      supabase.from("employees").select("*").order("nama"),
      supabase.from("attendance").select("*").gte("tanggal", new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)).order("tanggal", { ascending: false })
    ]);
    if (kRes.error) setError(kRes.error.message);
    setKaryawan(kRes.data || []);
    setAbsen(aRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const simpanKaryawan = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        nama: form.nama.trim(),
        kontak: form.kontak || null,
        jabatan: form.jabatan || null,
        gaji: Number(form.gaji) || 0,
        tgl_masuk: form.tgl_masuk || null,
        shift: form.shift || null,
        catatan: form.catatan || null,
        status: "aktif"
      };
      if (editId) {
        const { error: error2 } = await supabase.from("employees").update(payload).eq("id", editId);
        if (error2) throw error2;
      } else {
        const { error: error2 } = await supabase.from("employees").insert(payload);
        if (error2) throw error2;
      }
      logAudit({
        aksi: editId ? "ubah_karyawan" : "tambah_karyawan",
        user,
        sheetTarget: "employees",
        detail: { nama: payload.nama, jabatan: payload.jabatan }
      });
      setMsg(editId ? "\u2705 Data karyawan diperbarui" : "\u2705 Karyawan ditambahkan");
      setForm({ nama: "", kontak: "", jabatan: JABATAN[0], gaji: "", tgl_masuk: hariIni(), shift: "", catatan: "" });
      setEditId(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const editKaryawan = (k) => {
    setEditId(k.id);
    setForm({
      nama: k.nama || "",
      kontak: k.kontak || "",
      jabatan: k.jabatan || JABATAN[0],
      gaji: String(k.gaji ?? ""),
      tgl_masuk: k.tgl_masuk ? k.tgl_masuk.slice(0, 10) : hariIni(),
      shift: k.shift || "",
      catatan: k.catatan || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hapusKaryawan = async (k) => {
    if (!confirm(`Hapus karyawan ${k.nama}? Absensinya juga terhapus.`)) return;
    await supabase.from("employees").delete().eq("id", k.id);
    fetchData();
  };
  const tandaiAbsen = async (k, status) => {
    const tgl = tanggalAbsen;
    const { data: ada } = await supabase.from("attendance").select("id").eq("karyawan_id", k.id).eq("tanggal", tgl).limit(1).maybeSingle();
    if (ada) {
      await supabase.from("attendance").update({ status, nama: k.nama }).eq("id", ada.id);
    } else {
      await supabase.from("attendance").insert({
        tanggal: tgl,
        karyawan_id: k.id,
        nama: k.nama,
        status
      });
    }
    logAudit({ aksi: "absen", user, sheetTarget: "attendance", detail: { nama: k.nama, tanggal: tgl, status } });
    fetchData();
  };
  const absenHari = (k) => absen.find((a) => a.karyawan_id === k.id && a.tanggal === tanggalAbsen);
  const filtered = karyawan.filter((k) => !search || (k.nama || "").toLowerCase().includes(search.toLowerCase()) || (k.jabatan || "").toLowerCase().includes(search.toLowerCase()));
  const stat = useMemo(() => {
    const aktif = karyawan.filter((k) => k.status !== "nonaktif");
    return {
      total: karyawan.length,
      aktif: aktif.length,
      payroll: aktif.reduce((s, k) => s + Number(k.gaji || 0), 0),
      hadirHariIni: absen.filter((a) => a.tanggal === tanggalAbsen && a.status === "hadir").length
    };
  }, [karyawan, absen, tanggalAbsen]);
  const rekapAbsen = useMemo(() => {
    const m = {};
    absen.forEach((a) => {
      if (!m[a.karyawan_id]) m[a.karyawan_id] = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      m[a.karyawan_id][a.status] = (m[a.karyawan_id][a.status] || 0) + 1;
    });
    return m;
  }, [absen]);
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Karyawan & Absensi", subtitle: "Data tim dan kehadiran", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Karyawan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", children: stat.total })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Aktif" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-success", children: stat.aktif })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Payroll / Bulan" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: formatRupiah(stat.payroll) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsxs("div", { className: "metric-label", children: [
          "Hadir ",
          tglID(tanggalAbsen)
        ] }),
        /* @__PURE__ */ jsx("div", { className: "metric-value", children: stat.hadirHariIni })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 8 }, children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: [{ k: "karyawan", l: "\u{1F464} Data Karyawan" }, { k: "absensi", l: "\u{1F4C5} Absensi Hari Ini" }, { k: "rekap", l: "\u{1F4CA} Rekap 30 Hari" }].map((t) => /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${tab === t.k ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.k), children: t.l }, t.k)) }) }),
    tab === "karyawan" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("form", { onSubmit: simpanKaryawan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F464}" }),
            " ",
            editId ? "Ubah Karyawan" : "Tambah Karyawan"
          ] }),
          editId && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => {
            setEditId(null);
            setForm({ nama: "", kontak: "", jabatan: JABATAN[0], gaji: "", tgl_masuk: hariIni(), shift: "", catatan: "" });
          }, children: "Batal" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama *" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kontak" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jabatan" }),
            /* @__PURE__ */ jsx("select", { className: "form-control", value: form.jabatan, onChange: (e) => setForm({ ...form, jabatan: e.target.value }), children: JABATAN.map((j) => /* @__PURE__ */ jsx("option", { value: j, children: j }, j)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Gaji / Bulan (Rp)" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: form.gaji, onChange: (e) => setForm({ ...form, gaji: e.target.value }), placeholder: "0" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal Masuk" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tgl_masuk, onChange: (e) => setForm({ ...form, tgl_masuk: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Shift" }),
            /* @__PURE__ */ jsx("input", { className: "form-control", value: form.shift, onChange: (e) => setForm({ ...form, shift: e.target.value }), placeholder: "mis. Pagi / Sore" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : editId ? "\u{1F4BE} Perbarui" : "\uFF0B Tambah Karyawan" }) })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
            " Daftar Karyawan"
          ] }),
          /* @__PURE__ */ jsx("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) })
        ] }),
        loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F464}" }),
          /* @__PURE__ */ jsx("h3", { children: "Belum ada karyawan" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan data tim Anda." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Nama" }),
            /* @__PURE__ */ jsx("th", { children: "Kontak" }),
            /* @__PURE__ */ jsx("th", { children: "Jabatan" }),
            /* @__PURE__ */ jsx("th", { children: "Shift" }),
            /* @__PURE__ */ jsx("th", { children: "Masuk" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Gaji" }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: filtered.map((k) => /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: k.nama }),
            /* @__PURE__ */ jsx("td", { children: k.kontak || "\u2014" }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "badge badge-neutral", children: k.jabatan || "\u2014" }) }),
            /* @__PURE__ */ jsx("td", { className: "text-sm", children: k.shift || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-sm text-muted", children: tglID(k.tgl_masuk) }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(k.gaji) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => editKaryawan(k), children: "\u270F\uFE0F" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusKaryawan(k), children: "\u2715" })
            ] }) })
          ] }, k.id)) })
        ] }) })
      ] })
    ] }),
    tab === "absensi" && /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4C5}" }),
          " Absensi"
        ] }),
        /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", style: { maxWidth: 180 }, value: tanggalAbsen, onChange: (e) => setTanggalAbsen(e.target.value) })
      ] }),
      karyawan.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", children: "Belum ada karyawan. Tambahkan dulu di tab Data Karyawan." }) : /* @__PURE__ */ jsx("div", { className: "absen-list", children: karyawan.map((k) => {
        const a = absenHari(k);
        return /* @__PURE__ */ jsxs("div", { className: "absen-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold", children: k.nama }),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-muted", children: k.jabatan || "\u2014" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "absen-btns", children: Object.entries(STATUS_ABSEN).map(([key, v]) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `btn btn-sm ${a?.status === key ? "btn-primary" : "btn-outline"}`,
              onClick: () => tandaiAbsen(k, key),
              children: v.l
            },
            key
          )) })
        ] }, k.id);
      }) })
    ] }),
    tab === "rekap" && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CA}" }),
        " Rekap Absensi (30 hari terakhir)"
      ] }) }),
      karyawan.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada data." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          /* @__PURE__ */ jsx("th", { children: "Jabatan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Hadir" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Izin" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Sakit" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Alpa" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Total" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: karyawan.map((k) => {
          const r = rekapAbsen[k.id] || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
          const total = r.hadir + r.izin + r.sakit + r.alpa;
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: k.nama }),
            /* @__PURE__ */ jsx("td", { className: "text-sm text-muted", children: k.jabatan || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-success font-bold", children: r.hadir }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: r.izin }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-warning", children: r.sakit }),
            /* @__PURE__ */ jsx("td", { className: "text-right text-danger font-bold", children: r.alpa }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: total })
          ] }, k.id);
        }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .absen-list { display: flex; flex-direction: column; gap: 8px; }
        .absen-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .absen-btns { display: flex; gap: 4px; flex-wrap: wrap; }
      ` })
  ] });
}
