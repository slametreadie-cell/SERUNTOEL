import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
const rp = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const bulanLabel = (iso) => {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
export default function TargetBudget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const now = /* @__PURE__ */ new Date();
  const [bulan, setBulan] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [riwayat, setRiwayat] = useState([]);
  const [realisasi, setRealisasi] = useState({ omset: 0, hpp: 0, biayaOp: 0, trx: 0 });
  const [form, setForm] = useState({
    m1: "",
    m2: "",
    m3: "",
    m4: "",
    target_profit: "",
    budget_op: "",
    budget_mk: ""
  });
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tRes, cRes] = await Promise.all([
        supabase.from("target_budgets").select("*").order("bulan", { ascending: false }),
        supabase.from("cashflow").select("*").gte("tanggal", bulan).lte("tanggal", toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)))
      ]);
      if (tRes.error) {
        setRiwayat([]);
      } else setRiwayat(tRes.data || []);
      const akhirBulan = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const { data: trx } = await supabase.from("transactions").select("id, total_bayar").gte("tanggal", `${bulan}T00:00:00`).lte("tanggal", `${akhirBulan}T23:59:59`);
      const t = trx || [];
      let hpp = 0;
      if (t.length) {
        const { data: it } = await supabase.from("transaction_items").select("qty, hpp_satuan").in("transaksi_id", t.map((x) => x.id));
        hpp = (it || []).reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0);
      }
      const cf = cRes.data || [];
      const biayaOp = cf.filter((c) => c.jenis === "keluar" && !["Pembelian Bahan", "Hutang"].includes(c.kategori)).reduce((s, c) => s + Number(c.jumlah || 0), 0);
      setRealisasi({
        omset: t.reduce((s, x) => s + Number(x.total_bayar || 0), 0),
        hpp,
        biayaOp,
        trx: t.length
      });
      const ada = (tRes.data || []).find((r) => (r.bulan || "").slice(0, 10) === bulan);
      if (ada) {
        setForm({
          m1: String(ada.m1 ?? ""),
          m2: String(ada.m2 ?? ""),
          m3: String(ada.m3 ?? ""),
          m4: String(ada.m4 ?? ""),
          target_profit: String(ada.target_profit ?? ""),
          budget_op: String(ada.budget_op ?? ""),
          budget_mk: String(ada.budget_mk ?? "")
        });
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [bulan]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const totalTargetOmset = (Number(form.m1) || 0) + (Number(form.m2) || 0) + (Number(form.m3) || 0) + (Number(form.m4) || 0);
  const labaReal = realisasi.omset - realisasi.hpp - realisasi.biayaOp;
  const targetProfit = Number(form.target_profit) || 0;
  const budgetOp = Number(form.budget_op) || 0;
  const progres = useMemo(() => {
    const pOmset = totalTargetOmset > 0 ? Math.min(150, realisasi.omset / totalTargetOmset * 100) : 0;
    const pProfit = targetProfit > 0 ? Math.min(150, labaReal / targetProfit * 100) : 0;
    const pOp = budgetOp > 0 ? Math.min(150, realisasi.biayaOp / budgetOp * 100) : 0;
    return { pOmset, pProfit, pOp };
  }, [realisasi, totalTargetOmset, targetProfit, budgetOp, labaReal]);
  const simpan = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        bulan,
        m1: Number(form.m1) || 0,
        m2: Number(form.m2) || 0,
        m3: Number(form.m3) || 0,
        m4: Number(form.m4) || 0,
        target_profit: Number(form.target_profit) || 0,
        budget_op: Number(form.budget_op) || 0,
        budget_mk: Number(form.budget_mk) || 0
      };
      const ada = riwayat.find((r) => (r.bulan || "").slice(0, 10) === bulan);
      if (ada) {
        const { error: error2 } = await supabase.from("target_budgets").update(payload).eq("id", ada.id);
        if (error2) throw error2;
      } else {
        const { error: error2 } = await supabase.from("target_budgets").insert(payload);
        if (error2) throw error2;
      }
      logAudit({ aksi: "simpan_target", user, sheetTarget: "target_budgets", detail: { bulan, target: totalTargetOmset } });
      setMsg("\u2705 Target & budget disimpan");
      fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3e3);
    }
  };
  const hapusTarget = async (r) => {
    if (!confirm(`Hapus target ${bulanLabel(r.bulan)}?`)) return;
    await supabase.from("target_budgets").delete().eq("id", r.id);
    logAudit({ aksi: "hapus_target", user, sheetTarget: "target_budgets", detail: { bulan: r.bulan } });
    setMsg("\u2705 Target dihapus");
    fetchData();
    setTimeout(() => setMsg(""), 3e3);
  };
  const Progres = ({ label, nilai, target, persen, warna }) => /* @__PURE__ */ jsxs("div", { className: "pg-row", children: [
    /* @__PURE__ */ jsxs("div", { className: "pg-info", children: [
      /* @__PURE__ */ jsx("span", { className: "font-bold", children: label }),
      /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
        rp(nilai),
        " / ",
        rp(target)
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "pg-bar", children: /* @__PURE__ */ jsx("div", { className: "pg-fill", style: { width: `${Math.min(100, persen)}%`, background: warna } }) }),
    /* @__PURE__ */ jsxs("div", { className: `pg-pct ${persen >= 100 ? "text-success" : persen >= 60 ? "text-warning" : "text-danger"}`, children: [
      persen.toFixed(0),
      "%"
    ] })
  ] });
  return /* @__PURE__ */ jsxs(AppLayout, { title: "Target & Budget", subtitle: "Rencana penjualan & belanja bulanan", children: [
    msg && /* @__PURE__ */ jsx("div", { className: "alert alert-success", children: msg }),
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 16 }, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "form-group", style: { marginBottom: 0, maxWidth: 220 }, children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Bulan" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-control",
            type: "month",
            value: bulan.slice(0, 7),
            onChange: (e) => setBulan(`${e.target.value}-01`)
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex-1" }),
      /* @__PURE__ */ jsx("span", { className: "text-sm text-muted", children: bulanLabel(bulan) })
    ] }) }),
    loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center py-4", children: "Memuat..." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F3AF}" }),
          " Realisasi ",
          bulanLabel(bulan)
        ] }) }),
        /* @__PURE__ */ jsx(Progres, { label: "Omset", nilai: realisasi.omset, target: totalTargetOmset, persen: progres.pOmset, warna: "var(--primary,#2563eb)" }),
        /* @__PURE__ */ jsx(Progres, { label: "Laba Bersih", nilai: labaReal, target: targetProfit, persen: progres.pProfit, warna: "var(--success,#16a34a)" }),
        /* @__PURE__ */ jsx(Progres, { label: "Biaya Operasional", nilai: realisasi.biayaOp, target: budgetOp, persen: progres.pOp, warna: "var(--danger,#dc3545)" }),
        budgetOp > 0 && realisasi.biayaOp > budgetOp && /* @__PURE__ */ jsxs("div", { className: "alert alert-warning mt-3", children: [
          "\u26A0\uFE0F Biaya operasional sudah ",
          /* @__PURE__ */ jsx("b", { children: "melebihi budget" }),
          " ",
          rp(realisasi.biayaOp - budgetOp),
          ". Tinjau pengeluaran."
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-muted mt-3", children: "Omset dihitung dari transaksi POS. Laba = omset \u2212 HPP \u2212 biaya operasional (dari Cashflow)." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", children: [
        /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
          /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4DD}" }),
          " Set Target & Budget"
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "text-sm font-bold mb-2", children: "Target Omset per Minggu" }),
        /* @__PURE__ */ jsx("div", { className: "form-row", children: [
          { k: "m1", l: "Minggu 1" },
          { k: "m2", l: "Minggu 2" },
          { k: "m3", l: "Minggu 3" },
          { k: "m4", l: "Minggu 4" }
        ].map((f) => /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: f.l }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-control",
              type: "number",
              value: form[f.k],
              onChange: (e) => setForm({ ...form, [f.k]: e.target.value }),
              placeholder: "0"
            }
          )
        ] }, f.k)) }),
        /* @__PURE__ */ jsxs("div", { className: "alert alert-info", children: [
          "Total target omset bulan ini: ",
          /* @__PURE__ */ jsx("b", { children: rp(totalTargetOmset) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Target Laba Bersih (Rp)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-control",
                type: "number",
                value: form.target_profit,
                onChange: (e) => setForm({ ...form, target_profit: e.target.value }),
                placeholder: "0"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Budget Operasional (Rp)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-control",
                type: "number",
                value: form.budget_op,
                onChange: (e) => setForm({ ...form, budget_op: e.target.value }),
                placeholder: "0"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Budget Marketing (Rp)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-control",
                type: "number",
                value: form.budget_mk,
                onChange: (e) => setForm({ ...form, budget_mk: e.target.value }),
                placeholder: "0"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: simpan, disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan Target" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "card-header", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
            /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4CB}" }),
            " Riwayat Target"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-sm text-muted", children: [
            riwayat.length,
            " bulan"
          ] })
        ] }),
        riwayat.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-muted text-sm", style: { padding: 16 }, children: "Belum ada target tersimpan." }) : /* @__PURE__ */ jsx("div", { className: "table-wrap", children: /* @__PURE__ */ jsxs("table", { className: "table", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: "Bulan" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Target Omset" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Target Laba" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Budget Op" }),
            /* @__PURE__ */ jsx("th", { className: "text-right", children: "Budget Mkt" }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: riwayat.map((r) => {
            const tot = Number(r.m1 || 0) + Number(r.m2 || 0) + Number(r.m3 || 0) + Number(r.m4 || 0);
            return /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { className: "font-bold", children: bulanLabel(r.bulan) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: rp(tot) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: rp(r.target_profit) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: rp(r.budget_op) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: rp(r.budget_mk) }),
              /* @__PURE__ */ jsx("td", { className: "text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-end", children: [
                /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setBulan((r.bulan || "").slice(0, 10)), children: "Buka" }),
                /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-danger", onClick: () => hapusTarget(r), children: "\u2715" })
              ] }) })
            ] }, r.id);
          }) })
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .pg-row { display: grid; grid-template-columns: 1fr 40px; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .pg-info { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        @media (min-width: 700px) {
          .pg-row { grid-template-columns: 260px 1fr 45px; }
          .pg-info { grid-column: auto; display: block; }
        }
        .pg-bar { height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
        .pg-fill { height: 100%; border-radius: 5px; transition: width .3s; }
        .pg-pct { text-align: right; font-weight: 800; }
      ` })
  ] });
}
