import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs(
    AppLayout,
    {
      title: "Tutup Kas",
      subtitle: "Rekap uang laci & serah terima shift",
      actions: /* @__PURE__ */ jsx(Link, { href: "/pos", className: "btn btn-outline btn-sm", children: "\u2190 Kembali ke POS" }),
      children: [
        msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
        error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
          "\u26A0\uFE0F ",
          error
        ] }),
        sudahDitutup && /* @__PURE__ */ jsxs("div", { className: "alert alert-warning", children: [
          "\u2139\uFE0F Tanggal ",
          /* @__PURE__ */ jsx("b", { children: tanggal }),
          " sudah pernah ditutup oleh ",
          sudahDitutup.user_email || "\u2014",
          " pada ",
          tglID(sudahDitutup.created_at),
          ". Menyimpan lagi akan menambah catatan baru."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "card", children: [
            /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F512}" }),
              " Hitung Uang Laci"
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: tanggal, onChange: (e) => setTanggal(e.target.value) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
              /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
                /* @__PURE__ */ jsx("label", { className: "form-label", children: "Modal Awal (Rp)" }),
                /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: modalAwal, onChange: (e) => setModalAwal(e.target.value), placeholder: "0" }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-muted mt-1", children: "Uang kembalian yang disiapkan di awal" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
                /* @__PURE__ */ jsx("label", { className: "form-label", children: "Uang Fisik di Laci (Rp)" }),
                /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: uangFisik, onChange: (e) => setUangFisik(e.target.value), placeholder: "0" }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-muted mt-1", children: "Hasil hitung uang tunai sebenarnya" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "rekap", children: [
              /* @__PURE__ */ jsxs("div", { className: "rk-row", children: [
                /* @__PURE__ */ jsx("span", { children: "Transaksi tunai hari ini" }),
                /* @__PURE__ */ jsx("b", { children: formatRupiah(rekap.cash) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "rk-row", children: [
                /* @__PURE__ */ jsx("span", { children: "+ Modal awal" }),
                /* @__PURE__ */ jsx("b", { children: formatRupiah(rekap.modal) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "rk-row sub", children: [
                /* @__PURE__ */ jsx("span", { children: "Seharusnya di laci" }),
                /* @__PURE__ */ jsx("b", { className: "text-primary", children: formatRupiah(rekap.seharusnya) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "rk-row", children: [
                /* @__PURE__ */ jsx("span", { children: "Uang fisik dihitung" }),
                /* @__PURE__ */ jsx("b", { children: formatRupiah(rekap.fisik) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: `rk-row sub ${rekap.selisih === 0 ? "" : rekap.selisih > 0 ? "text-success" : "text-danger"}`, children: [
                /* @__PURE__ */ jsx("span", { children: "Selisih" }),
                /* @__PURE__ */ jsx("b", { children: rekap.fisik > 0 ? `${rekap.selisih > 0 ? "+" : ""}${formatRupiah(rekap.selisih)}` : "\u2014" })
              ] })
            ] }),
            rekap.fisik > 0 && /* @__PURE__ */ jsx("div", { className: `alert ${rekap.selisih === 0 ? "alert-success" : "alert-warning"} mt-3`, children: rekap.selisih === 0 ? "\u2705 Kas seimbang, tidak ada selisih." : rekap.selisih > 0 ? `\u26A0\uFE0F Uang fisik LEBIH ${formatRupiah(rekap.selisih)} dari seharusnya.` : `\u26A0\uFE0F Uang fisik KURANG ${formatRupiah(Math.abs(rekap.selisih))} dari seharusnya.` }),
            /* @__PURE__ */ jsxs("div", { className: "form-group mt-3", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Catatan (opsional)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  className: "form-control",
                  value: catatan,
                  onChange: (e) => setCatatan(e.target.value),
                  placeholder: "mis. ada kembalian ke pelanggan yang salah"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-block", style: { padding: 13 }, onClick: simpan, disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "spinner" }),
              " Menyimpan..."
            ] }) : "\u{1F512} Simpan Tutup Kas" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "card", children: [
            /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CA}" }),
              " Penjualan ",
              tanggal
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "metrics-grid", style: { gridTemplateColumns: "repeat(2,1fr)", marginBottom: 0 }, children: [
              /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
                /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Total Penjualan" }),
                /* @__PURE__ */ jsx("div", { className: "metric-value text-primary", style: { fontSize: 18 }, children: formatRupiah(rekap.penjualan) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "metric-card", children: [
                /* @__PURE__ */ jsx("div", { className: "metric-label", children: "Jumlah Transaksi" }),
                /* @__PURE__ */ jsx("div", { className: "metric-value", style: { fontSize: 18 }, children: rekap.jumlah })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
              /* @__PURE__ */ jsx("div", { className: "text-sm font-bold mb-2", children: "Rincian per Metode" }),
              Object.keys(rekap.perMetode).length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", children: "Belum ada transaksi pada tanggal ini." }) : Object.entries(rekap.perMetode).map(([m, v]) => /* @__PURE__ */ jsxs("div", { className: "rk-row", children: [
                /* @__PURE__ */ jsx("span", { className: "capitalize", children: m }),
                /* @__PURE__ */ jsx("b", { children: formatRupiah(v) })
              ] }, m)),
              rekap.nonCash > 0 && /* @__PURE__ */ jsxs("div", { className: "rk-row sub", children: [
                /* @__PURE__ */ jsx("span", { children: "Non-tunai (tidak masuk laci)" }),
                /* @__PURE__ */ jsx("b", { className: "text-muted", children: formatRupiah(rekap.nonCash) })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4DC}" }),
              " Riwayat Tutup Kas"
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
              riwayat.length,
              " catatan"
            ] })
          ] }),
          loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : riwayat.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
            /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F512}" }),
            /* @__PURE__ */ jsx("h3", { children: "Belum ada tutup kas" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Lakukan tutup kas setiap akhir shift." })
          ] }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "Tanggal" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Penjualan" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Trx" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Seharusnya" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Fisik" }),
              /* @__PURE__ */ jsx("th", { className: "text-right", children: "Selisih" }),
              /* @__PURE__ */ jsx("th", { children: "Kasir" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: riwayat.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: r.tanggal }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(r.penjualan_hari_ini) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: r.trx_hari_ini }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: formatRupiah(r.saldo_sistem) }),
              /* @__PURE__ */ jsx("td", { className: "text-right font-bold", children: formatRupiah(r.uang_fisik) }),
              /* @__PURE__ */ jsx("td", { className: `text-right font-bold ${Number(r.selisih) === 0 ? "text-success" : "text-danger"}`, children: Number(r.selisih) === 0 ? "\u2705 0" : formatRupiah(r.selisih) }),
              /* @__PURE__ */ jsx("td", { className: "text-muted text-xs", children: r.user_email || "\u2014" })
            ] }, r.id)) })
          ] }) })
        ] }),
        /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .rekap { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); }
        .rk-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .rk-row span { color: var(--muted); }
        .rk-row.sub { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px; font-weight: 700; }
      ` })
      ]
    }
  );
}
