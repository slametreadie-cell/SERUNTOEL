import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const rp = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const LEGAL_FIELDS = [
  { k: "nama_usaha", l: "Nama Usaha" },
  { k: "bentuk_usaha", l: "Bentuk Usaha (PT/CV/UMKM)" },
  { k: "nib", l: "NIB" },
  { k: "npwp", l: "NPWP" },
  { k: "pirt", l: "Nomor PIRT" },
  { k: "halal", l: "Sertifikat Halal" },
  { k: "bpom", l: "Nomor BPOM / MD" },
  { k: "izin_lain", l: "Izin Lainnya" }
];
const NOTIF_FIELDS = [
  { k: "wa_aktif", l: "Aktifkan Notifikasi WhatsApp", tipe: "bool" },
  { k: "fonnte_token", l: "Token API Fonnte", tipe: "pass", ket: "Ambil di fonnte.com \u2192 Device \u2192 Token" },
  { k: "wa_admin", l: "Nomor WA Admin", tipe: "text", ket: "Format 08xxxxxxxxxx" },
  { k: "notif_stok_minimum", l: "Kirim Notif Stok Menipis", tipe: "bool" },
  { k: "notif_kadaluarsa", l: "Kirim Notif Produk Kadaluarsa", tipe: "bool" },
  { k: "notif_target", l: "Kirim Notif Target Tercapai", tipe: "bool" }
];
const KIRIM_CONFIG = [
  { k: "biaya_kirim", l: "Biaya Kirim Default (Rp)" },
  { k: "biaya_kirim_gratis_min", l: "Gratis Ongkir Mulai (Rp)" },
  { k: "radius_kirim_km", l: "Radius Kirim (km)" }
];
export default function PengaturanLanjutan() {
  const { user } = useAuth();
  const [tab, setTab] = useState("legal");
  const [config, setConfig] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tesStatus, setTesStatus] = useState("");
  const [userBaru, setUserBaru] = useState({ email: "", password: "", nama: "", role: "kasir", lihat: false });
  const [editUser, setEditUser] = useState(null);
  const [authUsers, setAuthUsers] = useState(null);
  const [prosesUser, setProsesUser] = useState(false);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, lg, nt, us] = await Promise.all([
        supabase.from("configuration").select("*"),
        supabase.from("legal_config").select("*"),
        supabase.from("notification_config").select("*"),
        supabase.from("users").select("*").order("created_at")
      ]);
      const map = {};
      (cfg.data || []).forEach((c) => {
        map[c.key] = c;
      });
      (lg.data || []).forEach((c) => {
        map[`legal.${c.key}`] = c;
      });
      (nt.data || []).forEach((c) => {
        map[`notif.${c.key}`] = c;
      });
      setConfig(map);
      setUsers(us.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const muatAkunLogin = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const r = await fetch("/api/admin/users?aksi=list", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const d = await r.json();
      if (!r.ok) {
        setAuthUsers({ error: d.error });
        return;
      }
      setAuthUsers(d.users || []);
    } catch (e) {
      setAuthUsers({ error: e.message });
    }
  }, []);
  useEffect(() => {
    muatAkunLogin();
  }, [muatAkunLogin]);
  const apiAdmin = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify(payload)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Gagal menghubungi server.");
    return d;
  };
  const tambahAkunLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!userBaru.email.trim() || !userBaru.password) {
      setError("Email dan password wajib diisi");
      return;
    }
    setProsesUser(true);
    try {
      await apiAdmin({
        aksi: "create",
        email: userBaru.email,
        password: userBaru.password,
        nama: userBaru.nama,
        role: userBaru.role
      });
      logAudit({ aksi: "tambah_user", user, sheetTarget: "users", detail: { email: userBaru.email, role: userBaru.role } });
      setMsg(`\u2705 Akun ${userBaru.email.trim().toLowerCase()} dibuat & bisa langsung login`);
      setUserBaru({ email: "", password: "", nama: "", role: "kasir", lihat: false });
      await muatAkunLogin();
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProsesUser(false);
      setTimeout(() => setMsg(""), 5e3);
    }
  };
  const simpanEditUser = async () => {
    if (!editUser) return;
    setError("");
    setMsg("");
    setProsesUser(true);
    try {
      await apiAdmin({
        aksi: "update",
        id: editUser.id,
        email: editUser.email,
        password: editUser.password || void 0,
        nama: editUser.nama
      });
      logAudit({ aksi: "ubah_user", user, sheetTarget: "users", detail: { email: editUser.email } });
      setMsg("\u2705 Akun diperbarui" + (editUser.password ? " (password diganti)" : ""));
      setEditUser(null);
      await muatAkunLogin();
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setProsesUser(false);
      setTimeout(() => setMsg(""), 5e3);
    }
  };
  const hapusAkunLogin = async (u) => {
    if (!confirm(`Hapus akun ${u.email}?

Akun ini tidak akan bisa login lagi.`)) return;
    setError("");
    setMsg("");
    try {
      await apiAdmin({ aksi: "delete", id: u.id, email: u.email });
      logAudit({ aksi: "hapus_user", user, sheetTarget: "users", detail: { email: u.email } });
      setMsg(`\u2705 Akun ${u.email} dihapus`);
      await muatAkunLogin();
      fetchData();
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setMsg(""), 4e3);
  };
  const val = (key) => config[key]?.value ?? "";
  const simpanKey = async (tabel, key, value, keterangan) => {
    const full = `${tabel === "configuration" ? "" : tabel === "legal_config" ? "legal." : "notif."}${key}`;
    const row = config[full];
    if (row) {
      await supabase.from(tabel).update({ value: String(value) }).eq("id", row.id);
    } else {
      await supabase.from(tabel).insert({ key, value: String(value), keterangan: keterangan || null });
    }
  };
  const simpanSemua = async (tabel, fields) => {
    setSaving(true);
    setError("");
    try {
      for (const f of fields) {
        const key = tabel === "configuration" ? f.k : f.k;
        await simpanKey(tabel, key, val(`${tabel === "configuration" ? "" : tabel === "legal_config" ? "legal." : "notif."}${key}`), f.ket);
      }
      logAudit({ aksi: `simpan_${tabel}`, user, sheetTarget: tabel, detail: { jumlah: fields.length } });
      setMsg("\u2705 Tersimpan");
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const setLokal = (prefix, key, value) => {
    const full = `${prefix}${key}`;
    setConfig((prev) => ({ ...prev, [full]: { ...prev[full] || {}, key, value, id: prev[full]?.id } }));
  };
  const tesWA = async () => {
    const token = val("notif.fonnte_token");
    const nomor = val("notif.wa_admin").replace(/^0/, "62").replace(/\D/g, "");
    if (!token) {
      setTesStatus("\u274C Token Fonnte belum diisi");
      return;
    }
    if (!nomor) {
      setTesStatus("\u274C Nomor WA admin belum diisi");
      return;
    }
    setTesStatus("\u23F3 Mengirim...");
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: token },
        body: new URLSearchParams({
          target: nomor,
          message: `\u2705 Tes notifikasi dari Seruntul

Kalau Anda menerima pesan ini, integrasi WhatsApp sudah berfungsi.
Waktu: ${(/* @__PURE__ */ new Date()).toLocaleString("id-ID")}`
        })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j.status === true || j.status === "true")) setTesStatus("\u2705 Berhasil! Cek WhatsApp Anda.");
      else setTesStatus(`\u274C Gagal: ${j.reason || j.detail || res.status}`);
    } catch (e) {
      setTesStatus(`\u274C Error: ${e.message} (bisa jadi CORS \u2014 kirim pesan dari server tidak didukung browser)`);
    }
  };
  const tambahUser = async (e) => {
    e.preventDefault();
    if (!userBaru.email.trim()) {
      setError("Email wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("users").insert({
        email: userBaru.email.trim().toLowerCase(),
        nama: userBaru.nama || null,
        role: userBaru.role
      });
      if (error2) throw error2;
      logAudit({ aksi: "tambah_user", user, sheetTarget: "users", detail: { email: userBaru.email, role: userBaru.role } });
      setMsg("\u2705 User ditambahkan");
      setUserBaru({ email: "", nama: "", role: "kasir" });
      fetchData();
    } catch (err) {
      setError(err.message.includes("duplicate") ? "Email sudah terdaftar" : err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const ubahRole = async (u, role) => {
    const ada = users.find((x) => x.email === u.email);
    if (ada) {
      await supabase.from("users").update({ role }).eq("id", ada.id);
    } else {
      await supabase.from("users").insert({ id: u.id, email: u.email, role });
    }
    logAudit({ aksi: "ubah_role", user, sheetTarget: "users", detail: { email: u.email, role } });
    setMsg(`\u2705 Role ${u.email} \u2192 ${role}`);
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const ROLE_BADGE = { owner: "badge-danger", admin: "badge-warning", produksi: "badge-info", kasir: "badge-success", user: "badge-neutral" };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Pengaturan Lanjutan", subtitle: "Legal, pengiriman, notifikasi, dan user" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, [
    { k: "legal", l: "\u{1F4DC} Legalitas Usaha" },
    { k: "kirim", l: "\u{1F69A} Biaya Kirim" },
    { k: "notif", l: "\u{1F4AC} Notifikasi WhatsApp" },
    { k: "user", l: "\u{1F464} Manajemen User" },
    { k: "sistem", l: "\u{1F6E0}\uFE0F Sistem & Sinkron" }
  ].map((t) => /* @__PURE__ */ React.createElement("button", { key: t.k, className: `btn btn-sm ${tab === t.k ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.k) }, t.l)))), tab === "legal" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DC}"), " Legalitas Usaha")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mb-3" }, "Data ini dipakai untuk keperluan administrasi, label produk, dan pengajuan izin."), /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, LEGAL_FIELDS.map((f) => /* @__PURE__ */ React.createElement("div", { className: "form-group", key: f.k }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, f.l), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: val(`legal.${f.k}`),
      placeholder: "belum diisi",
      onChange: (e) => setLokal("legal.", f.k, e.target.value)
    }
  )))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: () => simpanSemua("legal_config", LEGAL_FIELDS), disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan"))), tab === "kirim" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F69A}"), " Biaya Kirim / Ongkir")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, KIRIM_CONFIG.map((f) => /* @__PURE__ */ React.createElement("div", { className: "form-group", key: f.k }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, f.l), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: val(f.k),
      placeholder: "0",
      onChange: (e) => setLokal("", f.k, e.target.value)
    }
  )))), val("biaya_kirim") !== "" && /* @__PURE__ */ React.createElement("div", { className: "alert alert-info" }, "Contoh: pesan ", rp(5e4), ", ongkir ", rp(val("biaya_kirim")), ".", " ", Number(val("biaya_kirim_gratis_min")) > 0 && Number(val("biaya_kirim_gratis_min")) <= 5e4 ? "Belanja Rp50.000 sudah GRATIS ONGKIR." : `Gratis ongkir mulai ${rp(val("biaya_kirim_gratis_min"))}.`), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: () => simpanSemua("configuration", KIRIM_CONFIG), disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan"))), tab === "notif" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4AC}"), " Notifikasi WhatsApp (Fonnte)")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mb-3" }, "Kirim notifikasi otomatis ke WhatsApp Anda: stok menipis, produk mendekati kedaluwarsa, atau target tercapai. Layanan pihak ketiga ", /* @__PURE__ */ React.createElement("b", null, "Fonnte"), " dipakai untuk pengiriman."), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Status Notifikasi"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: val("notif.wa_aktif") || "false", onChange: (e) => setLokal("notif.", "wa_aktif", e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "true" }, "Aktif"), /* @__PURE__ */ React.createElement("option", { value: "false" }, "Nonaktif"))), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Token API Fonnte"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "password",
      value: val("notif.fonnte_token"),
      placeholder: "token dari fonnte.com",
      onChange: (e) => setLokal("notif.", "fonnte_token", e.target.value)
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Login fonnte.com \u2192 Device \u2192 salin Token")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nomor WA Admin"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: val("notif.wa_admin"),
      placeholder: "08xxxxxxxxxx",
      onChange: (e) => setLokal("notif.", "wa_admin", e.target.value)
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, NOTIF_FIELDS.filter((f) => f.k.startsWith("notif_")).map((f) => /* @__PURE__ */ React.createElement("div", { className: "form-group", key: f.k }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, f.l), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: val(`notif.${f.k}`) || "false", onChange: (e) => setLokal("notif.", f.k, e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "true" }, "Aktif"), /* @__PURE__ */ React.createElement("option", { value: "false" }, "Nonaktif"))))), tesStatus && /* @__PURE__ */ React.createElement("div", { className: "alert alert-info" }, tesStatus), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: tesWA }, "\u{1F514} Tes Kirim WA"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: () => simpanSemua("notification_config", NOTIF_FIELDS), disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan"))), tab === "user" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("form", { onSubmit: tambahAkunLogin }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F464}"), " Tambah Akun Login")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mb-3" }, "Akun yang dibuat di sini ", /* @__PURE__ */ React.createElement("b", null, "langsung bisa login"), " \u2014 tidak perlu buka Supabase lagi."), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Email *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "email",
      value: userBaru.email,
      onChange: (e) => setUserBaru({ ...userBaru, email: e.target.value }),
      placeholder: "kasir@toko.com"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { flex: 2 } }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Password *"), /* @__PURE__ */ React.createElement("div", { className: "pw-wrap" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: userBaru.lihat ? "text" : "password",
      value: userBaru.password,
      onChange: (e) => setUserBaru({ ...userBaru, password: e.target.value }),
      placeholder: "min. 6 karakter"
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "pw-toggle",
      tabIndex: -1,
      onClick: () => setUserBaru({ ...userBaru, lihat: !userBaru.lihat })
    },
    userBaru.lihat ? "\u{1F648}" : "\u{1F441}\uFE0F"
  )))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: userBaru.nama, onChange: (e) => setUserBaru({ ...userBaru, nama: e.target.value }), placeholder: "Nama karyawan" })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Role"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: userBaru.role, onChange: (e) => setUserBaru({ ...userBaru, role: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "owner" }, "Owner \u2014 akses penuh"), /* @__PURE__ */ React.createElement("option", { value: "admin" }, "Admin"), /* @__PURE__ */ React.createElement("option", { value: "kasir" }, "Kasir"), /* @__PURE__ */ React.createElement("option", { value: "produksi" }, "Produksi"), /* @__PURE__ */ React.createElement("option", { value: "user" }, "User")))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: prosesUser }, prosesUser ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Membuat...") : "\uFF0B Buat Akun")))), editUser && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u270F\uFE0F"), " Ubah Akun \u2014 ", editUser.email), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setEditUser(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Email"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "email",
      value: editUser.email,
      onChange: (e) => setEditUser({ ...editUser, email: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: editUser.nama || "",
      onChange: (e) => setEditUser({ ...editUser, nama: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Password Baru (biarkan kosong kalau tidak diganti)"), /* @__PURE__ */ React.createElement("div", { className: "pw-wrap" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: editUser.lihat ? "text" : "password",
      value: editUser.password || "",
      onChange: (e) => setEditUser({ ...editUser, password: e.target.value }),
      placeholder: "kosongkan jika tidak diubah"
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "pw-toggle",
      tabIndex: -1,
      onClick: () => setEditUser({ ...editUser, lihat: !editUser.lihat })
    },
    editUser.lihat ? "\u{1F648}" : "\u{1F441}\uFE0F"
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setEditUser(null) }, "Batal"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanEditUser, disabled: prosesUser }, prosesUser ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Perubahan"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F511}"), " Akun Login"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, Array.isArray(authUsers) ? `${authUsers.length} akun` : "\u2014"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: muatAkunLogin }, "\u{1F504} Muat Ulang"))), authUsers?.error ? /* @__PURE__ */ React.createElement("div", { className: "alert alert-warning", style: { margin: 16 } }, "\u26A0\uFE0F ", authUsers.error, /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { className: "text-xs" }, "Pastikan ", /* @__PURE__ */ React.createElement("code", null, "SUPABASE_SERVICE_ROLE_KEY"), " sudah diset di Vercel \u2192 Settings \u2192 Environment Variables.")) : !Array.isArray(authUsers) ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat akun...") : authUsers.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F464}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada akun")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Email"), /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Role"), /* @__PURE__ */ React.createElement("th", null, "Login Terakhir"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, authUsers.map((u) => {
    const info = users.find((x) => x.email === u.email);
    const diriSendiri = u.email === user?.email;
    return /* @__PURE__ */ React.createElement("tr", { key: u.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, u.email, diriSendiri && /* @__PURE__ */ React.createElement("span", { className: "badge badge-info", style: { marginLeft: 6 } }, "Anda")), /* @__PURE__ */ React.createElement("td", null, u.nama || info?.nama || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-control",
        style: { maxWidth: 120, padding: "4px 8px" },
        value: info?.role || "user",
        onChange: (e) => ubahRole({ email: u.email, id: u.id, role: info?.role }, e.target.value)
      },
      ["owner", "admin", "kasir", "produksi", "user"].map((r) => /* @__PURE__ */ React.createElement("option", { key: r, value: r }, r))
    )), /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, u.login_terakhir ? new Date(u.login_terakhir).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "belum pernah"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${u.terkonfirmasi ? "badge-success" : "badge-warning"}` }, u.terkonfirmasi ? "Aktif" : "Belum aktif")), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn btn-sm btn-outline",
        onClick: () => setEditUser({ id: u.id, email: u.email, nama: u.nama || info?.nama || "", password: "", lihat: false })
      },
      "\u270F\uFE0F"
    ), !diriSendiri && /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusAkunLogin(u) }, "\u2715"))));
  })))))), tab === "sistem" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F6E0}\uFE0F"), " Sistem & Sinkronisasi")), /* @__PURE__ */ React.createElement("div", { className: "sys-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "\u2601\uFE0F Penyimpanan Cloud"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Semua data tersimpan otomatis di Supabase (cloud), bukan di laptop. Laptop mati atau ganti perangkat tidak menghilangkan data \u2014 cukup login dengan akun yang sama.")), /* @__PURE__ */ React.createElement("span", { className: "badge badge-success" }, "Aktif")), /* @__PURE__ */ React.createElement("div", { className: "sys-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "\u{1F510} Keamanan Data"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Akses database dikunci dengan Row Level Security: hanya pengguna yang sudah login yang bisa membaca & menulis.")), /* @__PURE__ */ React.createElement("span", { className: "badge badge-success" }, "Aktif")), /* @__PURE__ */ React.createElement("div", { className: "sys-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "\u{1F4BE} Backup Manual"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Unduh salinan data penting (produk, transaksi, pelanggan) dalam format Excel untuk arsip pribadi.")), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => exportBackup() }, "\u2B07\uFE0F Unduh Backup")), /* @__PURE__ */ React.createElement("div", { className: "sys-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "\u{1F4F1} Akses Mobile"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Buka ", /* @__PURE__ */ React.createElement("b", null, "seruntoel.vercel.app"), ' di HP, lalu pilih "Tambahkan ke Home Screen" agar seperti aplikasi.')), /* @__PURE__ */ React.createElement("span", { className: "badge badge-info" }, "Siap")), /* @__PURE__ */ React.createElement("div", { className: "sys-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "\u{1F504} Versi Aplikasi"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted" }, "Seruntul Advanced \xB7 Next.js + Supabase")), /* @__PURE__ */ React.createElement("span", { className: "badge badge-neutral" }, "v1.0"))), /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .sys-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 12px 0; border-bottom: 1px solid var(--border); }
      `));
  async function exportBackup() {
    const [p, t, c, i] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("ingredients").select("*")
    ]);
    const bagian = { Produk: p.data, Transaksi: t.data, Pelanggan: c.data, Bahan: i.data };
    const { exportCSV } = await import("../utils/export");
    let out = "";
    for (const [nama, rows] of Object.entries(bagian)) {
      if (!rows?.length) {
        out += `
=== ${nama.toUpperCase()} ===
(tidak ada data)
`;
        continue;
      }
      out += `
=== ${nama.toUpperCase()} (${rows.length}) ===
`;
      const keys = Object.keys(rows[0]);
      out += keys.join(";") + "\n";
      out += rows.map((r) => keys.map((k) => String(r[k] ?? "").replace(/[;\n]/g, " ")).join(";")).join("\n") + "\n";
    }
    const blob = new Blob(["\uFEFF" + out], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-seruntul_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
