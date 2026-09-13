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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Karyawan & Absensi", subtitle: "Data tim dan kehadiran" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Karyawan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Aktif"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, stat.aktif)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Payroll / Bulan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, formatRupiah(stat.payroll))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Hadir ", tglID(tanggalAbsen)), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.hadirHariIni))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, [{ k: "karyawan", l: "\u{1F464} Data Karyawan" }, { k: "absensi", l: "\u{1F4C5} Absensi Hari Ini" }, { k: "rekap", l: "\u{1F4CA} Rekap 30 Hari" }].map((t) => /* @__PURE__ */ React.createElement("button", { key: t.k, className: `btn btn-sm ${tab === t.k ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.k) }, t.l)))), tab === "karyawan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("form", { onSubmit: simpanKaryawan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F464}"), " ", editId ? "Ubah Karyawan" : "Tambah Karyawan"), editId && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => {
    setEditId(null);
    setForm({ nama: "", kontak: "", jabatan: JABATAN[0], gaji: "", tgl_masuk: hariIni(), shift: "", catatan: "" });
  } }, "Batal")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama *"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.nama, onChange: (e) => setForm({ ...form, nama: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kontak"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.kontak, onChange: (e) => setForm({ ...form, kontak: e.target.value }), placeholder: "No. HP" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jabatan"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.jabatan, onChange: (e) => setForm({ ...form, jabatan: e.target.value }) }, JABATAN.map((j) => /* @__PURE__ */ React.createElement("option", { key: j, value: j }, j))))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Gaji / Bulan (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: form.gaji, onChange: (e) => setForm({ ...form, gaji: e.target.value }), placeholder: "0" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal Masuk"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tgl_masuk, onChange: (e) => setForm({ ...form, tgl_masuk: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Shift"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.shift, onChange: (e) => setForm({ ...form, shift: e.target.value }), placeholder: "mis. Pagi / Sore" }))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : editId ? "\u{1F4BE} Perbarui" : "\uFF0B Tambah Karyawan")))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CB}"), " Daftar Karyawan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", style: { maxWidth: 220 }, placeholder: "\u{1F50D} Cari...", value: search, onChange: (e) => setSearch(e.target.value) })), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F464}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada karyawan"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Tambahkan data tim Anda.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Kontak"), /* @__PURE__ */ React.createElement("th", null, "Jabatan"), /* @__PURE__ */ React.createElement("th", null, "Shift"), /* @__PURE__ */ React.createElement("th", null, "Masuk"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Gaji"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((k) => /* @__PURE__ */ React.createElement("tr", { key: k.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, k.nama), /* @__PURE__ */ React.createElement("td", null, k.kontak || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, k.jabatan || "\u2014")), /* @__PURE__ */ React.createElement("td", { className: "text-sm" }, k.shift || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, tglID(k.tgl_masuk)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(k.gaji)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => editKaryawan(k) }, "\u270F\uFE0F"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusKaryawan(k) }, "\u2715")))))))))), tab === "absensi" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4C5}"), " Absensi"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", style: { maxWidth: 180 }, value: tanggalAbsen, onChange: (e) => setTanggalAbsen(e.target.value) })), karyawan.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm" }, "Belum ada karyawan. Tambahkan dulu di tab Data Karyawan.") : /* @__PURE__ */ React.createElement("div", { className: "absen-list" }, karyawan.map((k) => {
    const a = absenHari(k);
    return /* @__PURE__ */ React.createElement("div", { key: k.id, className: "absen-row" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, k.nama), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, k.jabatan || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "absen-btns" }, Object.entries(STATUS_ABSEN).map(([key, v]) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key,
        type: "button",
        className: `btn btn-sm ${a?.status === key ? "btn-primary" : "btn-outline"}`,
        onClick: () => tandaiAbsen(k, key)
      },
      v.l
    ))));
  }))), tab === "rekap" && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CA}"), " Rekap Absensi (30 hari terakhir)")), karyawan.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada data.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Jabatan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Hadir"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Izin"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Sakit"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Alpa"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Total"))), /* @__PURE__ */ React.createElement("tbody", null, karyawan.map((k) => {
    const r = rekapAbsen[k.id] || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    const total = r.hadir + r.izin + r.sakit + r.alpa;
    return /* @__PURE__ */ React.createElement("tr", { key: k.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, k.nama), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, k.jabatan || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right text-success font-bold" }, r.hadir), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.izin), /* @__PURE__ */ React.createElement("td", { className: "text-right text-warning" }, r.sakit), /* @__PURE__ */ React.createElement("td", { className: "text-right text-danger font-bold" }, r.alpa), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, total));
  }))))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .absen-list { display: flex; flex-direction: column; gap: 8px; }
        .absen-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .absen-btns { display: flex; gap: 4px; flex-wrap: wrap; }
      `));
}
