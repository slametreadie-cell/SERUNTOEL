import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const toISO = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }
const bulanLabel = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function TargetBudget() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const now = new Date()
  const [bulan, setBulan] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [riwayat, setRiwayat] = useState([])
  const [realisasi, setRealisasi] = useState({ omset: 0, hpp: 0, biayaOp: 0, trx: 0 })

  const [form, setForm] = useState({
    m1: '', m2: '', m3: '', m4: '',
    target_profit: '', budget_op: '', budget_mk: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tRes, cRes] = await Promise.all([
        supabase.from('target_budgets').select('*').order('bulan', { ascending: false }),
        supabase.from('cashflow').select('*')
          .gte('tanggal', bulan).lte('tanggal', toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))),
      ])
      if (tRes.error) {
        // tabel mungkin belum ada kolom ini -> tetap tampilkan halaman
        setRiwayat([])
      } else setRiwayat(tRes.data || [])

      // realisasi bulan berjalan
      const akhirBulan = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      const { data: trx } = await supabase.from('transactions').select('id, total_bayar')
        .gte('tanggal', `${bulan}T00:00:00`).lte('tanggal', `${akhirBulan}T23:59:59`)
      const t = trx || []
      let hpp = 0
      if (t.length) {
        const { data: it } = await supabase.from('transaction_items').select('qty, hpp_satuan').in('transaksi_id', t.map((x) => x.id))
        hpp = (it || []).reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0)
      }
      const cf = cRes.data || []
      const biayaOp = cf.filter((c) => c.jenis === 'keluar' && !['Pembelian Bahan','Hutang'].includes(c.kategori))
        .reduce((s, c) => s + Number(c.jumlah || 0), 0)

      setRealisasi({
        omset: t.reduce((s, x) => s + Number(x.total_bayar || 0), 0),
        hpp, biayaOp, trx: t.length,
      })

      // isi form dari data bulan terpilih kalau ada
      const ada = (tRes.data || []).find((r) => (r.bulan || '').slice(0, 10) === bulan)
      if (ada) {
        setForm({
          m1: String(ada.m1 ?? ''), m2: String(ada.m2 ?? ''), m3: String(ada.m3 ?? ''), m4: String(ada.m4 ?? ''),
          target_profit: String(ada.target_profit ?? ''), budget_op: String(ada.budget_op ?? ''), budget_mk: String(ada.budget_mk ?? ''),
        })
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [bulan])

  useEffect(() => { fetchData() }, [fetchData])

  const totalTargetOmset = (Number(form.m1) || 0) + (Number(form.m2) || 0) + (Number(form.m3) || 0) + (Number(form.m4) || 0)
  const labaReal = realisasi.omset - realisasi.hpp - realisasi.biayaOp
  const targetProfit = Number(form.target_profit) || 0
  const budgetOp = Number(form.budget_op) || 0

  const progres = useMemo(() => {
    const pOmset = totalTargetOmset > 0 ? Math.min(150, (realisasi.omset / totalTargetOmset) * 100) : 0
    const pProfit = targetProfit > 0 ? Math.min(150, (labaReal / targetProfit) * 100) : 0
    const pOp = budgetOp > 0 ? Math.min(150, (realisasi.biayaOp / budgetOp) * 100) : 0
    return { pOmset, pProfit, pOp }
  }, [realisasi, totalTargetOmset, targetProfit, budgetOp, labaReal])

  const simpan = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        bulan,
        m1: Number(form.m1) || 0, m2: Number(form.m2) || 0, m3: Number(form.m3) || 0, m4: Number(form.m4) || 0,
        target_profit: Number(form.target_profit) || 0,
        budget_op: Number(form.budget_op) || 0,
        budget_mk: Number(form.budget_mk) || 0,
      }
      const ada = riwayat.find((r) => (r.bulan || '').slice(0, 10) === bulan)
      if (ada) {
        const { error } = await supabase.from('target_budgets').update(payload).eq('id', ada.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('target_budgets').insert(payload)
        if (error) throw error
      }
      logAudit({ aksi: 'simpan_target', user, sheetTarget: 'target_budgets', detail: { bulan, target: totalTargetOmset } })
      setMsg('✅ Target & budget disimpan')
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const hapusTarget = async (r) => {
    if (!confirm(`Hapus target ${bulanLabel(r.bulan)}?`)) return
    await supabase.from('target_budgets').delete().eq('id', r.id)
    logAudit({ aksi: 'hapus_target', user, sheetTarget: 'target_budgets', detail: { bulan: r.bulan } })
    setMsg('✅ Target dihapus')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const Progres = ({ label, nilai, target, persen, warna }) => (
    <div className="pg-row">
      <div className="pg-info">
        <span className="font-bold">{label}</span>
        <span className="text-sm text-muted">{rp(nilai)} / {rp(target)}</span>
      </div>
      <div className="pg-bar"><div className="pg-fill" style={{ width: `${Math.min(100, persen)}%`, background: warna }} /></div>
      <div className={`pg-pct ${persen >= 100 ? 'text-success' : persen >= 60 ? 'text-warning' : 'text-danger'}`}>{persen.toFixed(0)}%</div>
    </div>
  )

  return (
    <AppLayout title="Target & Budget" subtitle="Rencana penjualan & belanja bulanan">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
            <label className="form-label">Bulan</label>
            <input className="form-control" type="month" value={bulan.slice(0, 7)}
              onChange={(e) => setBulan(`${e.target.value}-01`)} />
          </div>
          <div className="flex-1"></div>
          <span className="text-sm text-muted">{bulanLabel(bulan)}</span>
        </div>
      </div>

      {loading ? <p className="text-muted text-center py-4">Memuat...</p> : (
        <>
          {/* Progres realisasi */}
          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">🎯</span> Realisasi {bulanLabel(bulan)}</div></div>
            <Progres label="Omset" nilai={realisasi.omset} target={totalTargetOmset} persen={progres.pOmset} warna="var(--primary,#2563eb)" />
            <Progres label="Laba Bersih" nilai={labaReal} target={targetProfit} persen={progres.pProfit} warna="var(--success,#16a34a)" />
            <Progres label="Biaya Operasional" nilai={realisasi.biayaOp} target={budgetOp} persen={progres.pOp} warna="var(--danger,#dc3545)" />

            {budgetOp > 0 && realisasi.biayaOp > budgetOp && (
              <div className="alert alert-warning mt-3">
                ⚠️ Biaya operasional sudah <b>melebihi budget</b> {rp(realisasi.biayaOp - budgetOp)}. Tinjau pengeluaran.
              </div>
            )}
            <p className="text-xs text-muted mt-3">
              Omset dihitung dari transaksi POS. Laba = omset − HPP − biaya operasional (dari Cashflow).
            </p>
          </div>

          {/* Form target */}
          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">📝</span> Set Target & Budget</div></div>

            <div className="text-sm font-bold mb-2">Target Omset per Minggu</div>
            <div className="form-row">
              {[
                { k: 'm1', l: 'Minggu 1' }, { k: 'm2', l: 'Minggu 2' },
                { k: 'm3', l: 'Minggu 3' }, { k: 'm4', l: 'Minggu 4' },
              ].map((f) => (
                <div className="form-group" key={f.k}>
                  <label className="form-label">{f.l}</label>
                  <input className="form-control" type="number" value={form[f.k]}
                    onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} placeholder="0" />
                </div>
              ))}
            </div>
            <div className="alert alert-info">
              Total target omset bulan ini: <b>{rp(totalTargetOmset)}</b>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target Laba Bersih (Rp)</label>
                <input className="form-control" type="number" value={form.target_profit}
                  onChange={(e) => setForm({ ...form, target_profit: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Budget Operasional (Rp)</label>
                <input className="form-control" type="number" value={form.budget_op}
                  onChange={(e) => setForm({ ...form, budget_op: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Budget Marketing (Rp)</label>
                <input className="form-control" type="number" value={form.budget_mk}
                  onChange={(e) => setForm({ ...form, budget_mk: e.target.value })} placeholder="0" />
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={simpan} disabled={saving}>
                {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan Target'}
              </button>
            </div>
          </div>

          {/* Riwayat */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><span className="nav-icon">📋</span> Riwayat Target</div>
              <span className="text-sm text-muted">{riwayat.length} bulan</span>
            </div>
            {riwayat.length === 0 ? (
              <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada target tersimpan.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Bulan</th><th className="text-right">Target Omset</th><th className="text-right">Target Laba</th><th className="text-right">Budget Op</th><th className="text-right">Budget Mkt</th><th></th></tr></thead>
                  <tbody>
                    {riwayat.map((r) => {
                      const tot = Number(r.m1||0)+Number(r.m2||0)+Number(r.m3||0)+Number(r.m4||0)
                      return (
                        <tr key={r.id}>
                          <td className="font-bold">{bulanLabel(r.bulan)}</td>
                          <td className="text-right">{rp(tot)}</td>
                          <td className="text-right">{rp(r.target_profit)}</td>
                          <td className="text-right">{rp(r.budget_op)}</td>
                          <td className="text-right">{rp(r.budget_mk)}</td>
                          <td className="text-right">
                            <div className="flex gap-1 justify-end">
                              <button className="btn btn-sm btn-outline" onClick={() => setBulan((r.bulan||'').slice(0,10))}>Buka</button>
                              <button className="btn btn-sm btn-danger" onClick={() => hapusTarget(r)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .pg-row { display: grid; grid-template-columns: 1fr 40px; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .pg-info { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        @media (min-width: 700px) {
          .pg-row { grid-template-columns: 260px 1fr 45px; }
          .pg-info { grid-column: auto; display: block; }
        }
        .pg-bar { height: 10px; background: var(--border); border-radius: 5px; overflow: hidden; }
        .pg-fill { height: 100%; border-radius: 5px; transition: width .3s; }
        .pg-pct { text-align: right; font-weight: 800; }
      `}</style>
    </AppLayout>
  )
}
