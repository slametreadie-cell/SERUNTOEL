import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
import { logAudit } from "../../utils/audit";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const tglID = (v) => new Date(v).toLocaleString("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
const hariIni = () => {
  const d = /* @__PURE__ */ new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export default function TutupKas() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [modalAwal, setModalAwal] = useState("");
  const [uangFisik, setUangFisik] = useState("");
  const [catatan, setCatatan] = useState("");
  const [trxHari, setTrxHari] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const gte = `${tanggal}T00:00:00`;
      const lte = `${tanggal}T23:59:59`;
      const [tRes, rRes] = await Promise.all([
        supabase.from("transactions").select("*").gte("tanggal", gte).lte("tanggal", lte).order("tanggal", { ascending: true }),
        supabase.from("cash_closings").select("*").order("tanggal", { ascending: false }).limit(20)
      ]);
      if (tRes.error) throw tRes.error;
      setTrxHari(tRes.data || []);
      setRiwayat(rRes.data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [tanggal]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const rekap = useMemo(() => {
    const penjualan = trxHari.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const cash = trxHari.filter((t) => t.metode_pembayaran === "cash").reduce((s, t) => s + Number(t.total_bayar || 0), 0);
    const nonCash = penjualan - cash;
    const perMetode = {};
    trxHari.forEach((t) => {
      const m = t.metode_pembayaran || "lainnya";
      perMetode[m] = (perMetode[m] || 0) + Number(t.total_bayar || 0);
    });
    const modal = Number(modalAwal) || 0;
    const fisik = Number(uangFisik) || 0;
    const seharusnya = modal + cash;
    const selisih = fisik > 0 ? fisik - seharusnya : 0;
    return { penjualan, cash, nonCash, perMetode, jumlah: trxHari.length, modal, fisik, seharusnya, selisih };
  }, [trxHari, modalAwal, uangFisik]);
  const sudahDitutup = riwayat.find((r) => r.tanggal === tanggal);
  const simpan = async () => {
    if (Number(uangFisik) <= 0) {
      setError("Isi jumlah uang fisik di laci dulu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: error2 } = await supabase.from("cash_closings").insert({
        tanggal,
        saldo_sistem: rekap.seharusnya,
        uang_fisik: Number(uangFisik) || 0,
        selisih: rekap.selisih,
        penjualan_hari_ini: rekap.penjualan,
        trx_hari_ini: rekap.jumlah,
        modal_awal: Number(modalAwal) || 0,
        catatan: catatan || null,
        user_email: user?.email || null,
        user_id: user?.id || null
      });
      if (error2) throw error2;
      logAudit({
        aksi: "tutup_kas",
        user,
        sheetTarget: "cash_closings",
        detail: {
          tanggal,
          penjualan: rekap.penjualan,
          trx: rekap.jumlah,
          seharusnya: rekap.seharusnya,
          fisik: Number(uangFisik) || 0,
          selisih: rekap.selisih
        }
      });
      setMsg(rekap.selisih === 0 ? "\u2705 Kas seimbang!" : `\u26A0\uFE0F Tersimpan \u2014 selisih ${formatRupiah(Math.abs(rekap.selisih))} (${rekap.selisih > 0 ? "lebih" : "kurang"})`);
      setUangFisik("");
      setCatatan("");
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 6e3);
    }
  };
  return /* @__PURE__ */ React.createElement(
    AppLayout,
    {
      title: "Tutup Kas",
      subtitle: "Rekap uang laci & serah terima shift",
      actions: /* @__PURE__ */ React.createElement(Link, { href: "/pos", className: "btn btn-outline btn-sm" }, "\u2190 Kembali ke POS")
    },
    msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg),
    error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error),
    sudahDitutup && /* @__PURE__ */ React.createElement("div", { className: "alert alert-warning" }, "\u2139\uFE0F Tanggal ", /* @__PURE__ */ React.createElement("b", null, tanggal), " sudah pernah ditutup oleh ", sudahDitutup.user_email || "\u2014", " pada ", tglID(sudahDitutup.created_at), ". Menyimpan lagi akan menambah catatan baru."),
    /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F512}"), " Hitung Uang Laci")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: tanggal, onChange: (e) => setTanggal(e.target.value) })), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Modal Awal (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: modalAwal, onChange: (e) => setModalAwal(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Uang kembalian yang disiapkan di awal")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Uang Fisik di Laci (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: uangFisik, onChange: (e) => setUangFisik(e.target.value), placeholder: "0" }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Hasil hitung uang tunai sebenarnya"))), /* @__PURE__ */ React.createElement("div", { className: "rekap" }, /* @__PURE__ */ React.createElement("div", { className: "rk-row" }, /* @__PURE__ */ React.createElement("span", null, "Transaksi tunai hari ini"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rekap.cash))), /* @__PURE__ */ React.createElement("div", { className: "rk-row" }, /* @__PURE__ */ React.createElement("span", null, "+ Modal awal"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rekap.modal))), /* @__PURE__ */ React.createElement("div", { className: "rk-row sub" }, /* @__PURE__ */ React.createElement("span", null, "Seharusnya di laci"), /* @__PURE__ */ React.createElement("b", { className: "text-primary" }, formatRupiah(rekap.seharusnya))), /* @__PURE__ */ React.createElement("div", { className: "rk-row" }, /* @__PURE__ */ React.createElement("span", null, "Uang fisik dihitung"), /* @__PURE__ */ React.createElement("b", null, formatRupiah(rekap.fisik))), /* @__PURE__ */ React.createElement("div", { className: `rk-row sub ${rekap.selisih === 0 ? "" : rekap.selisih > 0 ? "text-success" : "text-danger"}` }, /* @__PURE__ */ React.createElement("span", null, "Selisih"), /* @__PURE__ */ React.createElement("b", null, rekap.fisik > 0 ? `${rekap.selisih > 0 ? "+" : ""}${formatRupiah(rekap.selisih)}` : "\u2014"))), rekap.fisik > 0 && /* @__PURE__ */ React.createElement("div", { className: `alert ${rekap.selisih === 0 ? "alert-success" : "alert-warning"} mt-3` }, rekap.selisih === 0 ? "\u2705 Kas seimbang, tidak ada selisih." : rekap.selisih > 0 ? `\u26A0\uFE0F Uang fisik LEBIH ${formatRupiah(rekap.selisih)} dari seharusnya.` : `\u26A0\uFE0F Uang fisik KURANG ${formatRupiah(Math.abs(rekap.selisih))} dari seharusnya.`), /* @__PURE__ */ React.createElement("div", { className: "form-group mt-3" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Catatan (opsional)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        value: catatan,
        onChange: (e) => setCatatan(e.target.value),
        placeholder: "mis. ada kembalian ke pelanggan yang salah"
      }
    )), /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary btn-block", style: { padding: 13 }, onClick: simpan, disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F512} Simpan Tutup Kas")), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4CA}"), " Penjualan ", tanggal)), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(2,1fr)", marginBottom: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Penjualan"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary", style: { fontSize: 18 } }, formatRupiah(rekap.penjualan))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Jumlah Transaksi"), /* @__PURE__ */ React.createElement("div", { className: "metric-value", style: { fontSize: 18 } }, rekap.jumlah))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold mb-2" }, "Rincian per Metode"), Object.keys(rekap.perMetode).length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm" }, "Belum ada transaksi pada tanggal ini.") : Object.entries(rekap.perMetode).map(([m, v]) => /* @__PURE__ */ React.createElement("div", { key: m, className: "rk-row" }, /* @__PURE__ */ React.createElement("span", { className: "capitalize" }, m), /* @__PURE__ */ React.createElement("b", null, formatRupiah(v)))), rekap.nonCash > 0 && /* @__PURE__ */ React.createElement("div", { className: "rk-row sub" }, /* @__PURE__ */ React.createElement("span", null, "Non-tunai (tidak masuk laci)"), /* @__PURE__ */ React.createElement("b", { className: "text-muted" }, formatRupiah(rekap.nonCash)))))),
    /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DC}"), " Riwayat Tutup Kas"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, riwayat.length, " catatan")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : riwayat.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F512}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada tutup kas"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Lakukan tutup kas setiap akhir shift.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Penjualan"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Trx"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Seharusnya"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Fisik"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Selisih"), /* @__PURE__ */ React.createElement("th", null, "Kasir"))), /* @__PURE__ */ React.createElement("tbody", null, riwayat.map((r) => /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", null, r.tanggal), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(r.penjualan_hari_ini)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, r.trx_hari_ini), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(r.saldo_sistem)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold" }, formatRupiah(r.uang_fisik)), /* @__PURE__ */ React.createElement("td", { className: `text-right font-bold ${Number(r.selisih) === 0 ? "text-success" : "text-danger"}` }, Number(r.selisih) === 0 ? "\u2705 0" : formatRupiah(r.selisih)), /* @__PURE__ */ React.createElement("td", { className: "text-muted text-xs" }, r.user_email || "\u2014"))))))),
    /* @__PURE__ */ React.createElement("style", { jsx: true }, `
        .rekap { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); }
        .rk-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .rk-row span { color: var(--muted); }
        .rk-row.sub { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px; font-weight: 600; }
      `)
  );
}
