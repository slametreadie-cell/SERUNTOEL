import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const hariIni = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
export default function HutangPiutang() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("piutang");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    jenis: "piutang",
    nama_customer: "",
    jumlah: "",
    jatuh_tempo: "",
    keterangan: "",
    tanggal: hariIni()
  });
  const [bayar, setBayar] = useState(null);
  const [kolomKurang, setKolomKurang] = useState(false);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: data2, error: error2 } = await supabase.from("receivables_payables").select("*").order("tanggal", { ascending: false });
    if (error2) {
      if (/dibayar/.test(error2.message) || error2.code === "42703") {
        setKolomKurang(true);
        setError("");
      } else {
        setError(error2.message);
      }
      setData([]);
    } else {
      setKolomKurang(false);
      setData(data2 || []);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    const now = hariIni();
    const lewat = data.filter((d) => d.status === "aktif" && d.jatuh_tempo && d.jatuh_tempo < now);
    lewat.forEach((d) => supabase.from("receivables_payables").update({ status: "lewat_tempo" }).eq("id", d.id));
    if (lewat.length) setTimeout(fetchData, 600);
  }, [data]);
  const sisa = (row) => Math.max(0, Number(row.jumlah || 0) - Number(row.dibayar || 0));
  const daftar = data.filter((d) => d.jenis === tab);
  const filtered = daftar.filter((d) => {
    const okS = !statusFilter || d.status === statusFilter;
    const okQ = !search || (d.nama_customer || "").toLowerCase().includes(search.toLowerCase()) || (d.keterangan || "").toLowerCase().includes(search.toLowerCase());
    return okS && okQ;
  });
  const stat = useMemo(() => {
    const hitung = (jenis) => {
      const rows = data.filter((d) => d.jenis === jenis);
      const total = rows.reduce((s, r) => s + Number(r.jumlah || 0), 0);
      const lunas = rows.filter((r) => r.status === "lunas");
      const aktif = rows.filter((r) => r.status !== "lunas");
      return {
        total,
        n: rows.length,
        sudahLunas: lunas.reduce((s, r) => s + Number(r.jumlah || 0), 0),
        belum: aktif.reduce((s, r) => s + Number(r.jumlah || 0), 0),
        aktifN: aktif.length,
        lewatTempo: rows.filter((r) => r.status === "lewat_tempo").length
      };
    };
    return { piutang: hitung("piutang"), hutang: hitung("hutang") };
  }, [data]);
  const simpan = async (e) => {
    e.preventDefault();
    if (!form.nama_customer.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    const jumlah = Number(form.jumlah);
    if (!jumlah || jumlah <= 0) {
      setError("Jumlah harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("receivables_payables").insert({
        jenis: form.jenis,
        nama_customer: form.nama_customer.trim(),
        jumlah,
        jatuh_tempo: form.jatuh_tempo || null,
        keterangan: form.keterangan || null,
        tanggal: form.tanggal || hariIni(),
        status: "aktif"
      });
      if (error2) throw error2;
      logAudit({
        aksi: form.jenis === "piutang" ? "tambah_piutang" : "tambah_hutang",
        user,
        sheetTarget: "receivables_payables",
        detail: { nama: form.nama_customer, jumlah }
      });
      setMsg(`\u2705 ${form.jenis === "piutang" ? "Piutang" : "Hutang"} dicatat`);
      setForm({ ...form, nama_customer: "", jumlah: "", jatuh_tempo: "", keterangan: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const simpanBayar = async () => {
    if (!bayar) return;
    const nominal = Number(bayar.jumlah) || 0;
    if (nominal <= 0) {
      setError("Jumlah bayar harus lebih dari 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const row = bayar.row;
      const sudah = Number(row.dibayar || 0);
      const total = Number(row.jumlah || 0);
      const baru = Math.min(total, sudah + nominal);
      const lunas = baru >= total;
      const { error: error2 } = await supabase.from("receivables_payables").update({
        dibayar: baru,
        status: lunas ? "lunas" : "aktif",
        tgl_lunas: lunas ? bayar.tanggal || hariIni() : null,
        metode_bayar: bayar.metode || null
      }).eq("id", row.id);
      if (error2) throw error2;
      const masuk = row.jenis === "piutang";
      await supabase.from("cashflow").insert({
        tanggal: bayar.tanggal || hariIni(),
        keterangan: `${masuk ? "Terima piutang" : "Bayar hutang"} \u2014 ${row.nama_customer || "-"}`,
        kategori: masuk ? "Piutang" : "Hutang",
        jenis: masuk ? "masuk" : "keluar",
        jumlah: nominal,
        saldo: 0
      });
      logAudit({
        aksi: "bayar_" + row.jenis,
        user,
        sheetTarget: "receivables_payables",
        detail: { nama: row.nama_customer, bayar: nominal, lunas }
      });
      setMsg(lunas ? "\u2705 Lunas!" : `\u2705 Pembayaran dicatat (sisa ${formatRupiah(total - baru)})`);
      setBayar(null);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 4e3);
    }
  };
  const ubahStatus = async (row, status) => {
    await supabase.from("receivables_payables").update({
      status,
      tgl_lunas: status === "lunas" ? hariIni() : null
    }).eq("id", row.id);
    logAudit({ aksi: "ubah_status_" + row.jenis, user, sheetTarget: "receivables_payables", detail: { nama: row.nama_customer, status } });
    fetchData();
  };
  const hapus = async (row) => {
    if (!confirm(`Hapus catatan ${row.nama_customer}?`)) return;
    await supabase.from("receivables_payables").delete().eq("id", row.id);
    fetchData();
  };
  const BADGE = { aktif: "badge-info", lunas: "badge-success", lewat_tempo: "badge-danger" };
  const LABEL = { aktif: "Aktif", lunas: "Lunas", lewat_tempo: "Lewat Tempo" };
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Hutang & Piutang", subtitle: "Catat tagihan dan kewajiban" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), kolomKurang && /* @__PURE__ */ React.createElement("div", { className: "alert alert-warning" }, /* @__PURE__ */ React.createElement("b", null, "\u26A0\uFE0F Perlu 1 langkah di Supabase"), /* @__PURE__ */ React.createElement("br", null), "Halaman ini butuh kolom ", /* @__PURE__ */ React.createElement("code", null, "dibayar"), " pada tabel ", /* @__PURE__ */ React.createElement("code", null, "receivables_payables"), ". Buka ", /* @__PURE__ */ React.createElement("b", null, "Supabase \u2192 SQL Editor \u2192 New query"), ", tempel isi", /* @__PURE__ */ React.createElement("code", null, " supabase/migrations/004_add_missing_columns.sql"), ", lalu klik ", /* @__PURE__ */ React.createElement("b", null, "Run"), ". Setelah itu klik ", /* @__PURE__ */ React.createElement("b", null, "Muat Ulang"), ".", /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline mt-2", onClick: fetchData }, "\u{1F504} Muat Ulang")), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Piutang Belum Dibayar"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-warning" }, formatRupiah(stat.piutang.belum)), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, stat.piutang.aktifN, " tagihan")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Hutang Belum Dibayar"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, formatRupiah(stat.hutang.belum)), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted" }, stat.hutang.aktifN, " kewajiban")), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Posisi Bersih"), /* @__PURE__ */ React.createElement("div", { className: `metric-value ${stat.piutang.belum - stat.hutang.belum >= 0 ? "text-success" : "text-danger"}` }, formatRupiah(stat.piutang.belum - stat.hutang.belum))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Lewat Tempo"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-danger" }, stat.piutang.lewatTempo + stat.hutang.lewatTempo))), /* @__PURE__ */ React.createElement("form", { onSubmit: simpan }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DD}"), " Catat Baru")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jenis"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: `btn ${form.jenis === "piutang" ? "btn-primary" : "btn-outline"}`,
      style: { flex: 1 },
      onClick: () => setForm({ ...form, jenis: "piutang" })
    },
    "\u{1F4E5} Piutang (orang utang ke kita)"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: `btn ${form.jenis === "hutang" ? "btn-danger" : "btn-outline"}`,
      style: { flex: 1 },
      onClick: () => setForm({ ...form, jenis: "hutang" })
    },
    "\u{1F4E4} Hutang (kita utang)"
  )))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nama Pelanggan / Supplier *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.nama_customer,
      onChange: (e) => setForm({ ...form, nama_customer: e.target.value }),
      placeholder: "Nama"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jumlah (Rp) *"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: form.jumlah,
      onChange: (e) => setForm({ ...form, jumlah: e.target.value }),
      placeholder: "0"
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "date",
      value: form.tanggal,
      onChange: (e) => setForm({ ...form, tanggal: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jatuh Tempo (opsional)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "date",
      value: form.jatuh_tempo,
      onChange: (e) => setForm({ ...form, jatuh_tempo: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      value: form.keterangan,
      onChange: (e) => setForm({ ...form, keterangan: e.target.value }),
      placeholder: "mis. belanja tempo 7 hari"
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\uFF0B Catat")))), bayar && /* @__PURE__ */ React.createElement("div", { className: "card", style: { border: "2px solid var(--primary)" } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4B5}"), " Bayar \u2014 ", bayar.row.nama_customer), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => setBayar(null) }, "\u2715")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-muted mb-3" }, bayar.row.jenis === "piutang" ? "Menerima pembayaran" : "Membayar", ":", " ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(bayar.row.jumlah)), " \xB7 sisa ", formatRupiah(bayar.row.jumlah - (bayar.row.dibayar || 0))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jumlah Bayar"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "number",
      value: bayar.jumlah,
      onChange: (e) => setBayar({ ...bayar, jumlah: e.target.value })
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Metode"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: bayar.metode, onChange: (e) => setBayar({ ...bayar, metode: e.target.value }) }, /* @__PURE__ */ React.createElement("option", { value: "cash" }, "Tunai"), /* @__PURE__ */ React.createElement("option", { value: "transfer" }, "Transfer"), /* @__PURE__ */ React.createElement("option", { value: "qris" }, "QRIS"), /* @__PURE__ */ React.createElement("option", { value: "ewallet" }, "E-Wallet"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      type: "date",
      value: bayar.tanggal,
      onChange: (e) => setBayar({ ...bayar, tanggal: e.target.value })
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: () => setBayar({ ...bayar, jumlah: String(bayar.row.jumlah - (bayar.row.dibayar || 0)) }) }, "Lunasi Semua"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanBayar, disabled: saving }, saving ? "Menyimpan..." : "\u{1F4BE} Simpan Pembayaran"))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${tab === "piutang" ? "btn-primary" : "btn-outline"}`, onClick: () => setTab("piutang") }, "\u{1F4E5} Piutang (", stat.piutang.n, ")"), /* @__PURE__ */ React.createElement("button", { className: `btn btn-sm ${tab === "hutang" ? "btn-primary" : "btn-outline"}`, onClick: () => setTab("hutang") }, "\u{1F4E4} Hutang (", stat.hutang.n, ")"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "0 16px 12px" } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 220 },
      placeholder: "\u{1F50D} Cari nama/keterangan...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  ), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 150 }, value: statusFilter, onChange: (e) => setStatusFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Status"), /* @__PURE__ */ React.createElement("option", { value: "aktif" }, "Aktif"), /* @__PURE__ */ React.createElement("option", { value: "lewat_tempo" }, "Lewat Tempo"), /* @__PURE__ */ React.createElement("option", { value: "lunas" }, "Lunas")))), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, tab === "piutang" ? "\u{1F4E5}" : "\u{1F4E4}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada ", tab), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Catat ", tab, " pelanggan atau supplier Anda.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Keterangan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Jumlah"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Sisa"), /* @__PURE__ */ React.createElement("th", null, "Jatuh Tempo"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((r) => {
    const sisaRp = r.jumlah - (r.dibayar || 0);
    return /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(r.tanggal)), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, r.nama_customer || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, r.keterangan || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(r.jumlah)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.status === "lunas" ? /* @__PURE__ */ React.createElement("span", { className: "text-success" }, "\u2705 0") : /* @__PURE__ */ React.createElement("b", { className: "text-danger" }, formatRupiah(sisaRp))), /* @__PURE__ */ React.createElement("td", { className: "text-sm" }, r.jatuh_tempo ? tglID(r.jatuh_tempo) : "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${BADGE[r.status] || "badge-neutral"}` }, LABEL[r.status] || r.status)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 justify-end" }, r.status !== "lunas" && /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn btn-sm btn-primary",
        onClick: () => setBayar({ row: r, jumlah: String(sisaRp), metode: "cash", tanggal: hariIni() })
      },
      "\u{1F4B5}"
    ), r.status === "lunas" && /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(r, "aktif") }, "Buka"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(r) }, "\u2715"))));
  }))))));
}
