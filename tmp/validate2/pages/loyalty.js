import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
import { LOYALTY_DEFAULT, TIER_DEFAULT, TIER_EMOJI, ORDER_TIER, tierDari } from "../utils/loyalty";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const tglID = (v) => v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "\u2014";
export default function Loyalty() {
  const { user } = useAuth();
  const [tab, setTab] = useState("member");
  const [members, setMembers] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [tiers, setTiers] = useState(TIER_DEFAULT);
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [mRes, hRes, tRes, cRes] = await Promise.all([
      supabase.from("loyalty_members").select("*").order("total_belanja", { ascending: false }),
      supabase.from("loyalty_history").select("*").order("tanggal", { ascending: false }).limit(300),
      supabase.from("tier_config").select("*").order("target_bulanan"),
      supabase.from("loyalty_config").select("*").order("key")
    ]);
    if (mRes.error) setError(mRes.error.message);
    setMembers(mRes.data || []);
    setRiwayat(hRes.data || []);
    setTiers(tRes.data && tRes.data.length ? tRes.data : TIER_DEFAULT);
    setConfig(cRes.data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const cfgVal = (k) => {
    const row = config.find((c) => c.key === k);
    return row?.value ?? LOYALTY_DEFAULT[k];
  };
  const setCfg = async (k, v) => {
    const row = config.find((c) => c.key === k);
    if (row) await supabase.from("loyalty_config").update({ value: String(v) }).eq("id", row.id);
    else await supabase.from("loyalty_config").insert({ key: k, value: String(v) });
  };
  const simpanConfig = async () => {
    setSaving(true);
    try {
      await setCfg("aktif", String(cfgAktif));
      await setCfg("poin_per_rupiah", String(poinPer));
      await setCfg("nilai_poin", String(nilaiPoin));
      await setCfg("min_tukar", String(minTukar));
      logAudit({ aksi: "ubah_loyalty_config", user, sheetTarget: "loyalty_config", detail: { poin_per_rupiah: poinPer, nilai_poin: nilaiPoin, min_tukar: minTukar } });
      setMsg("\u2705 Konfigurasi poin disimpan");
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const [cfgAktif, setCfgAktif] = useState(true);
  const [poinPer, setPoinPer] = useState(LOYALTY_DEFAULT.poin_per_rupiah);
  const [nilaiPoin, setNilaiPoin] = useState(LOYALTY_DEFAULT.nilai_poin);
  const [minTukar, setMinTukar] = useState(LOYALTY_DEFAULT.min_tukar);
  useEffect(() => {
    if (!config.length) return;
    setCfgAktif(String(cfgVal("aktif")) !== "false");
    setPoinPer(cfgVal("poin_per_rupiah"));
    setNilaiPoin(cfgVal("nilai_poin"));
    setMinTukar(cfgVal("min_tukar"));
  }, [config]);
  const simpanTier = async (t) => {
    const row = tiers.find((x) => x.tier === t.tier);
    if (row?.id) {
      await supabase.from("tier_config").update({
        diskon_persen: Number(t.diskon_persen) || 0,
        target_bulanan: Number(t.target_bulanan) || 0,
        keterangan: t.keterangan || null
      }).eq("id", row.id);
    } else {
      await supabase.from("tier_config").insert({
        tier: t.tier,
        diskon_persen: Number(t.diskon_persen) || 0,
        target_bulanan: Number(t.target_bulanan) || 0,
        keterangan: t.keterangan || null
      });
    }
    setMsg("\u2705 Tier diperbarui");
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const seedTier = async () => {
    setSaving(true);
    for (const t of TIER_DEFAULT) {
      const row = tiers.find((x) => x.tier === t.tier);
      if (!row) await supabase.from("tier_config").insert(t);
    }
    setSaving(false);
    setMsg("\u2705 Tier default dibuat");
    fetchData();
  };
  const editTier = (tier, field, val) => {
    setTiers((prev) => prev.map((x) => x.tier === tier ? { ...x, [field]: val } : x));
  };
  const hapusMember = async (m) => {
    if (!confirm(`Hapus member ${m.nama}?`)) return;
    await supabase.from("loyalty_members").delete().eq("id", m.id);
    logAudit({ aksi: "hapus_member", user, sheetTarget: "loyalty_members", detail: { nama: m.nama } });
    fetchData();
  };
  const sinkronTier = async () => {
    setSaving(true);
    for (const m of members) {
      const t = tierDari(m.total_belanja, tiers);
      if (t !== m.tier) {
        await supabase.from("loyalty_members").update({ tier: t }).eq("id", m.id);
      }
    }
    setSaving(false);
    setMsg("\u2705 Tier semua member disinkronkan");
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const filtered = members.filter((m) => {
    const okS = !search || (m.nama || "").toLowerCase().includes(search.toLowerCase()) || (m.kontak || "").includes(search);
    const okT = !tierFilter || m.tier === tierFilter;
    return okS && okT;
  });
  const stat = useMemo(() => ({
    total: members.length,
    totalPoin: members.reduce((s, m) => s + (m.poin || 0), 0),
    totalBelanja: members.reduce((s, m) => s + Number(m.total_belanja || 0), 0),
    perTier: ORDER_TIER.map((t) => ({ tier: t, n: members.filter((m) => m.tier === t).length }))
  }), [members]);
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Loyalty & Member", subtitle: "Poin, tier, dan pelanggan setia" }, msg && /* @__PURE__ */ React.createElement("div", { className: "alert alert-success" }, msg), error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Member"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-primary" }, stat.total)), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Poin Beredar"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, stat.totalPoin.toLocaleString("id-ID"))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Nilai Poin"), /* @__PURE__ */ React.createElement("div", { className: "metric-value text-success" }, formatRupiah(stat.totalPoin * (Number(nilaiPoin) || 0)))), /* @__PURE__ */ React.createElement("div", { className: "metric-card" }, /* @__PURE__ */ React.createElement("div", { className: "metric-label" }, "Total Belanja Member"), /* @__PURE__ */ React.createElement("div", { className: "metric-value" }, formatRupiah(stat.totalBelanja)))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, [
    { k: "member", l: "\u{1F465} Member" },
    { k: "riwayat", l: "\u{1F4DC} Riwayat Poin" },
    { k: "tier", l: "\u{1F3C5} Tier & Diskon" },
    { k: "config", l: "\u2699\uFE0F Aturan Poin" }
  ].map((t) => /* @__PURE__ */ React.createElement("button", { key: t.k, className: `btn btn-sm ${tab === t.k ? "btn-primary" : "btn-outline"}`, onClick: () => setTab(t.k) }, t.l)))), tab === "member" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2", style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "form-control",
      style: { maxWidth: 220 },
      placeholder: "\u{1F50D} Cari nama/kontak...",
      value: search,
      onChange: (e) => setSearch(e.target.value)
    }
  ), /* @__PURE__ */ React.createElement("select", { className: "form-control", style: { maxWidth: 160 }, value: tierFilter, onChange: (e) => setTierFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Semua Tier"), ORDER_TIER.map((t) => /* @__PURE__ */ React.createElement("option", { key: t, value: t }, TIER_EMOJI[t], " ", t)))), /* @__PURE__ */ React.createElement("button", { className: "btn btn-outline", onClick: sinkronTier, disabled: saving }, "\u{1F504} Sinkron Tier")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-3 mt-3" }, stat.perTier.map((p) => /* @__PURE__ */ React.createElement("span", { key: p.tier, className: "badge badge-neutral" }, TIER_EMOJI[p.tier], " ", p.tier, ": ", /* @__PURE__ */ React.createElement("b", null, p.n))))), /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F465}"), " Daftar Member"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, filtered.length, " member")), loading ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-center py-4" }, "Memuat...") : filtered.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "nav-icon", style: { fontSize: 40 } }, "\u{1F465}"), /* @__PURE__ */ React.createElement("h3", null, "Belum ada member"), /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, "Member otomatis terdaftar saat transaksi POS dengan nama pelanggan.")) : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Nama"), /* @__PURE__ */ React.createElement("th", null, "Kontak"), /* @__PURE__ */ React.createElement("th", null, "Tier"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Poin"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Belanja"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Trx"), /* @__PURE__ */ React.createElement("th", null, "Terakhir"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, filtered.map((m) => /* @__PURE__ */ React.createElement("tr", { key: m.id }, /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, m.nama), /* @__PURE__ */ React.createElement("td", null, m.kontak || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "badge badge-warning" }, TIER_EMOJI[m.tier] || "", " ", m.tier)), /* @__PURE__ */ React.createElement("td", { className: "text-right font-bold text-primary" }, m.poin || 0), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, formatRupiah(m.total_belanja)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, m.total_transaksi || 0), /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(m.last_visit)), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-danger", onClick: () => hapusMember(m) }, "\u2715"))))))))), tab === "riwayat" && /* @__PURE__ */ React.createElement("div", { className: "card", style: { padding: 0 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header", style: { padding: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4DC}"), " Riwayat Poin"), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-muted" }, riwayat.length, " catatan")), riwayat.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-muted text-sm", style: { padding: 16 } }, "Belum ada riwayat poin.") : /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tanggal"), /* @__PURE__ */ React.createElement("th", null, "Member"), /* @__PURE__ */ React.createElement("th", null, "Jenis"), /* @__PURE__ */ React.createElement("th", { className: "text-right" }, "Poin"), /* @__PURE__ */ React.createElement("th", null, "Keterangan"))), /* @__PURE__ */ React.createElement("tbody", null, riwayat.map((r) => {
    const m = members.find((x) => x.id === r.member_id);
    return /* @__PURE__ */ React.createElement("tr", { key: r.id }, /* @__PURE__ */ React.createElement("td", { className: "text-muted text-sm" }, tglID(r.tanggal)), /* @__PURE__ */ React.createElement("td", { className: "font-bold" }, m?.nama || "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `badge ${r.jenis === "tambah" ? "badge-success" : "badge-danger"}` }, r.jenis === "tambah" ? "\u2191 Tambah" : "\u2193 Tukar")), /* @__PURE__ */ React.createElement("td", { className: `text-right font-bold ${r.jenis === "tambah" ? "text-success" : "text-danger"}` }, r.jenis === "tambah" ? "+" : "\u2212", r.poin), /* @__PURE__ */ React.createElement("td", { className: "text-sm text-muted" }, r.keterangan || "\u2014"));
  }))))), tab === "tier" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F3C5}"), " Tier & Diskon Otomatis"), /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-outline", onClick: seedTier, disabled: saving }, "\uFF0B Buat Tier Default")), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-muted mb-3" }, "Tier naik otomatis berdasarkan total belanja member. Diskon diterapkan saat member belanja."), /* @__PURE__ */ React.createElement("div", { className: "table-wrap" }, /* @__PURE__ */ React.createElement("table", { className: "table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Tier"), /* @__PURE__ */ React.createElement("th", null, "Diskon (%)"), /* @__PURE__ */ React.createElement("th", null, "Min. Total Belanja (Rp)"), /* @__PURE__ */ React.createElement("th", null, "Keterangan"), /* @__PURE__ */ React.createElement("th", null))), /* @__PURE__ */ React.createElement("tbody", null, ORDER_TIER.map((t) => {
    const row = tiers.find((x) => x.tier === t) || { tier: t, diskon_persen: 0, target_bulanan: 0, keterangan: "" };
    return /* @__PURE__ */ React.createElement("tr", { key: t }, /* @__PURE__ */ React.createElement("td", { className: "font-extrabold" }, TIER_EMOJI[t], " ", t), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        type: "number",
        style: { maxWidth: 100, padding: "6px 8px" },
        value: row.diskon_persen,
        onChange: (e) => editTier(t, "diskon_persen", e.target.value)
      }
    )), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        type: "number",
        style: { maxWidth: 160, padding: "6px 8px" },
        value: row.target_bulanan,
        onChange: (e) => editTier(t, "target_bulanan", e.target.value)
      }
    )), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "form-control",
        style: { padding: "6px 8px" },
        value: row.keterangan || "",
        onChange: (e) => editTier(t, "keterangan", e.target.value)
      }
    )), /* @__PURE__ */ React.createElement("td", { className: "text-right" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-sm btn-primary", onClick: () => simpanTier(row) }, "\u{1F4BE}")));
  }))))), tab === "config" && /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u2699\uFE0F"), " Aturan Poin")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Status Loyalitas"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: cfgAktif ? "true" : "false", onChange: (e) => setCfgAktif(e.target.value === "true") }, /* @__PURE__ */ React.createElement("option", { value: "true" }, "Aktif"), /* @__PURE__ */ React.createElement("option", { value: "false" }, "Nonaktif"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Belanja per 1 Poin (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: poinPer, onChange: (e) => setPoinPer(e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Contoh: 10000 \u2192 setiap Rp10.000 dapat 1 poin"))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Nilai 1 Poin (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: nilaiPoin, onChange: (e) => setNilaiPoin(e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-muted mt-1" }, "Contoh: 100 \u2192 1 poin bernilai Rp100 saat ditukar")), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Minimal Poin Bisa Ditukar"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", value: minTukar, onChange: (e) => setMinTukar(e.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "alert alert-info" }, "Simulasi: belanja ", formatRupiah(1e5), " \u2192 dapat ", /* @__PURE__ */ React.createElement("b", null, Math.floor(1e5 / (Number(poinPer) || 1)), " poin"), " senilai", " ", /* @__PURE__ */ React.createElement("b", null, formatRupiah(Math.floor(1e5 / (Number(poinPer) || 1)) * (Number(nilaiPoin) || 0))), "."), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end" }, /* @__PURE__ */ React.createElement("button", { className: "btn btn-primary", onClick: simpanConfig, disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan Aturan"))));
}
