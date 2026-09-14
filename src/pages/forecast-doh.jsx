import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { exportCSV } from '../utils/export'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const toISO = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }

export default function ForecastDOH() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [produk, setProduk] = useState([])
  const [items, setItems] = useState([])
  const [trx, setTrx] = useState([])
  const [hariAnalisis, setHariAnalisis] = useState('30')
  const [targetHari, setTargetHari] = useState('7')

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const n = new Date()
      const awal = toISO(new Date(n.getTime() - (Number(hariAnalisis) - 1) * 86400000))
      const akhir = toISO(n)
      const [pRes, tRes] = await Promise.all([
        supabase.from('products').select('id, nama_produk, kategori, stok_produk, hpp_per_unit, harga_jual'),
        supabase.from('transactions').select('id, tanggal').gte('tanggal', `${awal}T00:00:00`).lte('tanggal', `${akhir}T23:59:59`),
      ])
      if (pRes.error) throw pRes.error
      setProduk(pRes.data || [])
      const t = tRes.data || []
      setTrx(t)
      const ids = t.map((x) => x.id)
      if (ids.length) {
        const { data } = await supabase.from('transaction_items').select('produk_id, nama_produk, qty').in('transaksi_id', ids)
        setItems(data || [])
      } else setItems([])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [hariAnalisis])

  useEffect(() => { fetchData() }, [fetchData])

  // ===== Hitung DOH per produk =====
  const analisis = useMemo(() => {
    const hari = Number(hariAnalisis) || 30
    const target = Number(targetHari) || 7

    const terjual = {}
    items.forEach((i) => {
      const key = i.produk_id || i.nama_produk
      terjual[key] = (terjual[key] || 0) + Number(i.qty || 0)
    })

    const rows = produk.map((p) => {
      const qty = terjual[p.id] || 0
      const perHari = qty / hari
      const stok = Number(p.stok_produk || 0)
      const doh = perHari > 0 ? stok / perHari : (stok > 0 ? Infinity : 0)
      const targetStok = Math.ceil(perHari * target)
      const saranProduksi = Math.max(0, targetStok - stok)

      let status = 'aman'
      if (qty === 0 && stok > 0) status = 'mati'
      else if (stok <= 0) status = 'habis'
      else if (doh < target * 0.5) status = 'kritis'
      else if (doh < target) status = 'menipis'
      else if (doh > target * 3) status = 'menumpuk'

      return {
        id: p.id, nama: p.nama_produk, kategori: p.kategori,
        stok, terjual: qty, perHari, doh, targetStok, saranProduksi, status,
        nilaiStok: stok * Number(p.hpp_per_unit || 0),
        estimasiHariHabis: doh === Infinity ? null : Math.floor(doh),
      }
    })

    return {
      rows: rows.sort((a, b) => (a.doh === Infinity ? 1 : b.doh === Infinity ? -1 : a.doh - b.doh)),
      totalNilaiStok: rows.reduce((s, r) => s + r.nilaiStok, 0),
      perluProduksi: rows.filter((r) => r.saranProduksi > 0),
      totalSaran: rows.reduce((s, r) => s + r.saranProduksi, 0),
    }
  }, [produk, items, hariAnalisis, targetHari])

  const BADGE = { habis: 'badge-danger', kritis: 'badge-danger', menipis: 'badge-warning', aman: 'badge-success', menumpuk: 'badge-info', mati: 'badge-neutral' }
  const LABEL = { habis: 'Habis', kritis: 'Kritis', menipis: 'Menipis', aman: 'Aman', menumpuk: 'Menumpuk', mati: 'Tidak Laku' }

  const kolom = [
    { key: 'nama', label: 'Produk' }, { key: 'stok', label: 'Stok' },
    { key: 'terjual', label: `Terjual ${hariAnalisis}hr` },
    { key: 'perHari', label: 'Rata/hari' }, { key: 'doh', label: 'DOH (hari)' },
    { key: 'targetStok', label: 'Stok Ideal' }, { key: 'saranProduksi', label: 'Saran Produksi' },
    { key: 'statusLabel', label: 'Status' },
  ]
  const barisCSV = analisis.rows.map((r) => ({
    ...r,
    perHari: Number(r.perHari.toFixed(2)),
    doh: r.doh === Infinity ? '∞' : Number(r.doh.toFixed(1)),
    statusLabel: LABEL[r.status],
  }))

  return (
    <AppLayout title="Forecast & DOH" subtitle="Days on Hand & rekomendasi produksi">
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="form-group" style={{ marginBottom: 0, maxWidth: 200 }}>
            <label className="form-label">Periode Analisis</label>
            <select className="form-control" value={hariAnalisis} onChange={(e) => setHariAnalisis(e.target.value)}>
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="30">30 hari</option>
              <option value="60">60 hari</option>
              <option value="90">90 hari</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, maxWidth: 200 }}>
            <label className="form-label">Target Stok (hari)</label>
            <input className="form-control" type="number" value={targetHari} onChange={(e) => setTargetHari(e.target.value)} />
          </div>
          <div className="flex-1"></div>
          <button className="btn btn-outline" onClick={() => exportCSV(barisCSV, kolom, `forecast-doh_${toISO(new Date())}.csv`)}> Excel/CSV</button>
        </div>
        <p className="text-xs text-muted mt-2">
          <b>DOH (Days on Hand)</b> = berapa hari stok sekarang akan bertahan berdasarkan rata-rata penjualan.
          DOH kecil = segera habis (perlu produksi), DOH besar = stok menumpuk (modal menganggur).
        </p>
      </div>

      {loading ? <p className="text-muted text-center py-4">Menghitung forecast...</p> : (
        <>
          <div className="metrics-grid">
            <StatCard label="Produk Dianalisis" value={analisis.rows.length} icon="box" tone="primary" />
            <StatCard label="Perlu Produksi" value={analisis.perluProduksi.length} icon="box" tone="warning" />
            <StatCard label="Total Saran Produksi" value={`${analisis.totalSaran} pcs`} icon="box" />
            <StatCard label="Nilai Stok Tersimpan" value={rp(analisis.totalNilaiStok)} icon="inbox" tone="primary" />
          </div>

          {analisis.perluProduksi.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title"><Icon name="truck" size={16} /> Rencana Produksi</div></div>
              <p className="text-sm text-muted mb-2">Produk berikut perlu diproduksi agar stok mencapai target {targetHari} hari:</p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Produk</th><th className="text-right">Stok</th><th className="text-right">Rata/hari</th><th className="text-right">DOH</th><th className="text-right">Produksi</th></tr></thead>
                  <tbody>
                    {analisis.perluProduksi.map((r) => (
                      <tr key={r.id}>
                        <td className="font-bold">{r.nama}</td>
                        <td className="text-right">{r.stok}</td>
                        <td className="text-right text-muted">{r.perHari.toFixed(1)}</td>
                        <td className="text-right">{r.doh === Infinity ? '∞' : r.doh.toFixed(1)}</td>
                        <td className="text-right"><b className="text-primary">+{r.saranProduksi}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><Icon name="trendingUp" size={16} /> Analisis DOH per Produk</div>
              <span className="text-sm text-muted">diurutkan dari paling mendesak</span>
            </div>
            {analisis.rows.length === 0 ? (
              <EmptyBlock icon="box" title="Belum ada produk" message="Tambahkan produk untuk melihat forecast." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Produk</th><th className="text-right">Stok</th><th className="text-right">Terjual</th><th className="text-right">Rata/hari</th><th>DOH</th><th className="text-right">Saran</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {analisis.rows.map((r) => {
                      const pctBar = r.doh === Infinity ? 100 : Math.min(100, (r.doh / (Number(targetHari) * 3)) * 100)
                      return (
                        <tr key={r.id}>
                          <td className="font-bold">{r.nama}</td>
                          <td className="text-right">{r.stok}</td>
                          <td className="text-right text-muted">{r.terjual}</td>
                          <td className="text-right">{r.perHari.toFixed(1)}</td>
                          <td style={{ minWidth: 130 }}>
                            <div className="doh-bar">
                              <div className="doh-fill" style={{
                                width: `${pctBar}%`,
                                background: ['habis','kritis'].includes(r.status) ? 'var(--danger,#dc3545)'
                                  : r.status === 'menipis' ? 'var(--warning,#d97706)'
                                  : r.status === 'aman' ? 'var(--success,#16a34a)' : 'var(--primary,#2563eb)',
                              }} />
                            </div>
                            <div className="text-xs text-muted">
                              {r.doh === Infinity ? '∞ (tidak terjual)' : `${r.doh.toFixed(1)} hari`}
                            </div>
                          </td>
                          <td className="text-right">{r.saranProduksi > 0 ? <b className="text-primary">+{r.saranProduksi}</b> : '—'}</td>
                          <td><span className={`badge ${BADGE[r.status]}`}>{LABEL[r.status]}</span></td>
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
        .doh-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 3px; }
        .doh-fill { height: 100%; border-radius: 3px; }
      `}</style>
    </AppLayout>
  )
}
