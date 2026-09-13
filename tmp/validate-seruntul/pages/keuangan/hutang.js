import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Hutang & Piutang", subtitle: "Catat tagihan dan kewajiban", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    kolomKurang && /* @__PURE__ */ jsxs("div", { className: "alert alert-warning", children: [
      /* @__PURE__ */ jsx("b", { children: "\u26A0\uFE0F Perlu 1 langkah di Supabase" }),
      /* @__PURE__ */ jsx("br", {}),
      "Halaman ini butuh kolom ",
      /* @__PURE__ */ jsx("code", { children: "dibayar" }),
      " pada tabel ",
      /* @__PURE__ */ jsx("code", { children: "receivables_payables" }),
      ". Buka ",
      /* @__PURE__ */ jsx("b", { children: "Supabase \u2192 SQL Editor \u2192 New query" }),
      ", tempel isi",
      /* @__PURE__ */ jsx("code", { children: " supabase/migrations/004_add_missing_columns.sql" }),
      ", lalu klik ",
      /* @__PURE__ */ jsx("b", { children: "Run" }),
      ". Setelah itu klik ",
      /* @__PURE__ */ jsx("b", { children: "Muat Ulang" }),
      ".",
      /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline mt-2", onClick: fetchData, children: "\u{1F504} Muat Ulang" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "metrics-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Piutang Belum Dibayar" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-warning", children: formatRupiah(stat.piutang.belum) }),
        /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
          stat.piutang.aktifN,
          " tagihan"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Hutang Belum Dibayar" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: formatRupiah(stat.hutang.belum) }),
        /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
          stat.hutang.aktifN,
          " kewajiban"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Posisi Bersih" }),
        /* @__PURE__ */ jsx("div", { className: `metric-value ${stat.piutang.belum - stat.hutang.belum >= 0 ? "text-success" : "text-danger"}`, children: formatRupiah(stat.piutang.belum - stat.hutang.belum) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
        /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Lewat Tempo" }),
        /* @__PURE__ */ jsx("div", { className: "metric-value text-danger", children: stat.piutang.lewatTempo + stat.hutang.lewatTempo })
      ] })
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: simpan, children: /* @__PURE__ */ jsxs("div", { className: "card", children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4DD}" }),
        " Catat Baru"
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "form-row", children: /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jenis" }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `btn ${form.jenis === "piutang" ? "btn-primary" : "btn-outline"}`,
              style: { flex: 1 },
              onClick: () => setForm({ ...form, jenis: "piutang" }),
              children: "\u{1F4E5} Piutang (orang utang ke kita)"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `btn ${form.jenis === "hutang" ? "btn-danger" : "btn-outline"}`,
              style: { flex: 1 },
              onClick: () => setForm({ ...form, jenis: "hutang" }),
              children: "\u{1F4E4} Hutang (kita utang)"
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Pelanggan / Supplier *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: form.nama_customer,
              onChange: (e) => setForm({ ...form, nama_customer: e.target.value }),
              placeholder: "Nama"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jumlah (Rp) *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: form.jumlah,
              onChange: (e) => setForm({ ...form, jumlah: e.target.value }),
              placeholder: "0"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "date",
              value: form.tanggal,
              onChange: (e) => setForm({ ...form, tanggal: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jatuh Tempo (opsional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "date",
              value: form.jatuh_tempo,
              onChange: (e) => setForm({ ...form, jatuh_tempo: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              value: form.keterangan,
              onChange: (e) => setForm({ ...form, keterangan: e.target.value }),
              placeholder: "mis. belanja tempo 7 hari"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "spinner" }),
        " Menyimpan..."
      ] }) : "\uFF0B Catat" }) })
    ] }) }),
    bayar && /* @__PURE__ */ jsxs("div", { className: "card", style: { border: "2px solid var(--primary)" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "card-header", children: [
        /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4B5}" }),
          " Bayar \u2014 ",
          bayar.row.nama_customer
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setBayar(null), children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mb-3", children: [
        bayar.row.jenis === "piutang" ? "Menerima pembayaran" : "Membayar",
        ":",
        " ",
        /* @__PURE__ */ jsx("b", { children: formatRupiah(bayar.row.jumlah) }),
        " \xB7 sisa ",
        formatRupiah(bayar.row.jumlah - (bayar.row.dibayar || 0))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jumlah Bayar" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: bayar.jumlah,
              onChange: (e) => setBayar({ ...bayar, jumlah: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Metode" }),
          /* @__PURE__ */ jsxs("select", { className: "form-control", value: bayar.metode, onChange: (e) => setBayar({ ...bayar, metode: e.target.value }), children: [
            /* @__PURE__ */ jsx("option", { value: "cash", children: "Tunai" }),
            /* @__PURE__ */ jsx("option", { value: "transfer", children: "Transfer" }),
            /* @__PURE__ */ jsx("option", { value: "qris", children: "QRIS" }),
            /* @__PURE__ */ jsx("option", { value: "ewallet", children: "E-Wallet" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "date",
              value: bayar.tanggal,
              onChange: (e) => setBayar({ ...bayar, tanggal: e.target.value })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-outline", onClick: () => setBayar({ ...bayar, jumlah: String(bayar.row.jumlah - (bayar.row.dibayar || 0)) }), children: "Lunasi Semua" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpanBayar, disabled: saving, children: saving ? "Menyimpan..." : "\u{1F4BE} Simpan Pembayaran" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxs("button", { className: `btn btn-sm ${tab === "piutang" ? "btn-primary" : "btn-outline"}`, onClick: () => setTab("piutang"), children: [
          "\u{1F4E5} Piutang (",
          stat.piutang.n,
          ")"
        ] }),
        /* @__PURE__ */ jsxs("button", { className: `btn btn-sm ${tab === "hutang" ? "btn-primary" : "btn-outline"}`, onClick: () => setTab("hutang"), children: [
          "\u{1F4E4} Hutang (",
          stat.hutang.n,
          ")"
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { style: { padding: "0 16px 12px" }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            style: { maxWidth: 220 },
            placeholder: "\u{1F50D} Cari nama/keterangan...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        ),
        /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 150 }, value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Semua Status" }),
          /* @__PURE__ */ jsx("option", { value: "aktif", children: "Aktif" }),
          /* @__PURE__ */ jsx("option", { value: "lewat_tempo", children: "Lewat Tempo" }),
          /* @__PURE__ */ jsx("option", { value: "lunas", children: "Lunas" })
        ] })
      ] }) }),
      loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : filtered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: tab === "piutang" ? "\u{1F4E5}" : "\u{1F4E4}" }),
        /* @__PURE__ */ jsxs("h3", { children: [
          "Belum ada ",
          tab
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm", children: [
          "Catat ",
          tab,
          " pelanggan atau supplier Anda."
        ] })
      ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
          /* @__PURE__ */ jsx("th", { children: "Nama" }),
          /* @__PURE__ */ jsx("th", { children: "Keterangan" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Jumlah" }),
          /* @__PURE__ */ jsx("th", { className: "text-right", children: "Sisa" }),
          /* @__PURE__ */ jsx("th", { children: "Jatuh Tempo" }),
          /* @__PURE__ */ jsx("th", { children: "Status" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: filtered.map((r) => {
          const sisaRp = r.jumlah - (r.dibayar || 0);
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { className: "text-muted text-sm", children: tglID(r.tanggal) }),
            /* @__PURE__ */ jsx("td", { className: "font-bold", children: r.nama_customer || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-sm text-muted", children: r.keterangan || "\u2014" }),
            /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(r.jumlah) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: r.status === "lunas" ? /* @__PURE__ */ jsx("span", { className: "text-success", children: "\u2705 0" }) : /* @__PURE__ */ jsx("b", { className: "text-danger", children: formatRupiah(sisaRp) }) }),
            /* @__PURE__ */ jsx("td", { className: "text-sm", children: r.jatuh_tempo ? tglID(r.jatuh_tempo) : "\u2014" }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `badge ${BADGE[r.status] || "badge-neutral"}`, children: LABEL[r.status] || r.status }) }),
            /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
              r.status !== "lunas" && /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-sm btn-primary",
                  onClick: () => setBayar({ row: r, jumlah: String(sisaRp), metode: "cash", tanggal: hariIni() }),
                  children: "\u{1F4B5}"
                }
              ),
              r.status === "lunas" && /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => ubahStatus(r, "aktif"), children: "Buka" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapus(r), children: "\u2715" })
            ] }) })
          ] }, r.id);
        }) })
      ] }) })
    ] })
  ] });
}
