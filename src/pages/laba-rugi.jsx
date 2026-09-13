import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { exportCSV, exportPDF } from '../utils/export'

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const pct = (v) => `${(Number(v) || 0).toFixed(1)}%`
const toISO = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }

const BIAYA_KATEGORI = ['Operasional', 'Gaji', 'Sewa', 'Utilitas', 'Marketing', 'Lainnya']

export default function LabaRugi() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transaksi, setTransaksi] = useState([])
  const [items, setItems] = useState([])
  const [cashflow, setCashflow] = useState([])
  const [toko, setToko] = useState({})

  const now = new Date()
  const [preset, setPreset] = useState('bulan')
  const [dari, setDari] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [sampai, setSampai] = useState(toISO(now))

  useEffect(() => {
    const n = new Date()
    if (preset === 'bulan') { setDari(toISO(new Date(n.getFullYear(), n.getMonth(), 1))); setSampai(toISO(n)) }
    else if (preset === 'lalu') {
      const f = new Date(n.getFullYear(), n.getMonth() - 1, 1)
      setDari(toISO(f)); setSampai(toISO(new Date(n.getFullYear(), n.getMonth(), 0)))
    } else if (preset === '30') { setDari(toISO(new Date(n.getTime() - 29*86400000))); setSampai(toISO(n)) }
    else if (preset === '90') { setDari(toISO(new Date(n.getTime() - 89*86400000))); setSampai(toISO(n)) }
    else if (preset === 'tahun') { setDari(toISO(new Date(n.getFullYear(), 0, 1))); setSampai(toISO(n)) }
  }, [preset])

  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return
    setLoading(true); setError('')
    try {
      const [tRes, cRes, cfgRes] = await Promise.all([
        supabase.from('transactions').select('*').gte('tanggal', `${dari}T00:00:00`).lte('tanggal', `${sampai}T23:59:59`).order('tanggal'),
        supabase.from('cashflow').select('*').gte('tanggal', dari).lte('tanggal', sampai),
        supabase.from('configuration').select('key, value'),
      ])
      if (tRes.error) throw tRes.error
      const trx = tRes.data || []
      const ids = trx.map((t) => t.id)
      let it = []
      if (ids.length) {
        const { data } = await supabase.from('transaction_items').select('*').in('transaksi_id', ids)
        it = data || []
      }
      setTransaksi(trx); setItems(it); setCashflow(cRes.data || [])
      const cm = {}; (cfgRes.data || []).forEach((c) => { cm[c.key] = c.value }); setToko(cm)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [dari, sampai])

  useEffect(() => { fetchData() }, [fetchData])

  // ===== Hitung P&L =====
  const pl = useMemo(() => {
    const pendapatan = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const hpp = items.reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0)
    const labaKotor = pendapatan - hpp

    // Biaya operasional dari cashflow keluar (kecuali Pembelian Bahan & Hutang & Piutang)
    const keluar = cashflow.filter((c) => c.jenis === 'keluar')
    const perKategori = {}
    keluar.forEach((c) => {
      const k = c.kategori || 'Lainnya'
      perKategori[k] = (perKategori[k] || 0) + Number(c.jumlah || 0)
    })

    const TIDAK_DIHITUNG = ['Pembelian Bahan', 'Hutang']
    const biayaOp = Object.entries(perKategori)
      .filter(([k]) => !TIDAK_DIHITUNG.includes(k))
      .reduce((s, [, v]) => s + v, 0)

    // Pendapatan lain dari cashflow masuk di luar Penjualan
    const masukLain = cashflow.filter((c) => c.jenis === 'masuk' && !['Penjualan','Piutang'].includes(c.kategori))
      .reduce((s, c) => s + Number(c.jumlah || 0), 0)

    const labaBersih = labaKotor - biayaOp + masukLain
    return {
      pendapatan, hpp, labaKotor, biayaOp, masukLain, labaBersih,
      perKategori,
      marginKotor: pendapatan > 0 ? (labaKotor / pendapatan) * 100 : 0,
      marginBersih: pendapatan > 0 ? (labaBersih / pendapatan) * 100 : 0,
      jumlahTrx: transaksi.length,
      rataTrx: transaksi.length ? pendapatan / transaksi.length : 0,
    }
  }, [transaksi, items, cashflow])

  const kolomCSV = [
    { key: 'label', label: 'Keterangan' },
    { key: 'nilai', label: 'Nilai' },
    { key: 'persen', label: '% dari Pendapatan' },
  ]
  const barisCSV = [
    { label: 'Pendapatan Penjualan', nilai: pl.pendapatan, persen: '100%' },
    { label: 'HPP', nilai: -pl.hpp, persen: pct(-(pl.hpp / (pl.pendapatan || 1)) * 100) },
    { label: 'LABA KOTOR', nilai: pl.labaKotor, persen: pct(pl.marginKotor) },
    ...Object.entries(pl.perKategori)
      .filter(([k]) => !['Pembelian Bahan', 'Hutang'].includes(k))
      .map(([k, v]) => ({ label: `Biaya ${k}`, nilai: -v, persen: pct(-(v / (pl.pendapatan || 1)) * 100) })),
    { label: 'Total Biaya Operasional', nilai: -pl.biayaOp, persen: pct(-(pl.biayaOp / (pl.pendapatan || 1)) * 100) },
    ...(pl.masukLain ? [{ label: 'Pendapatan Lain', nilai: pl.masukLain, persen: pct((pl.masukLain / (pl.pendapatan || 1)) * 100) }] : []),
    { label: 'LABA BERSIH', nilai: pl.labaBersih, persen: pct(pl.marginBersih) },
  ]

  const Baris = ({ label, nilai, persen, bold, negatif, border }) => (
    <div className={`pl-row ${bold ? 'pl-bold' : ''} ${border ? 'pl-border' : ''}`}>
      <span>{label}</span>
      <span className={nilai < 0 ? 'text-danger' : negatif ? 'text-danger' : ''}>{rp(nilai)}</span>
      <span className="text-muted text-sm">{persen}</span>
    </div>
  )

  return (
    <AppLayout title="Laporan Laba Rugi" subtitle="Pendapatan, biaya, dan laba bersih">
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { k: 'bulan', l: 'Bulan Ini' },
            { k: 'lalu', l: 'Bulan Lalu' },
            { k: '30', l: '30 Hari' },
            { k: '90', l: '90 Hari' },
            { k: 'tahun', l: 'Tahun Ini' },
            { k: 'custom', l: 'Custom' },
          ].map((p) => (
            <button key={p.k} className={`btn btn-sm ${preset === p.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPreset(p.k)}>{p.l}</button>
          ))}
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2" style={{ width: '100%', marginTop: 8 }}>
              <input type="date" className="form-control" style={{ maxWidth: 165 }} value={dari} onChange={(e) => setDari(e.target.value)} />
              <span className="text-muted text-sm">s/d</span>
              <input type="date" className="form-control" style={{ maxWidth: 165 }} value={sampai} onChange={(e) => setSampai(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <span className="text-sm text-muted">Periode {dari} s/d {sampai}</span>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => exportCSV(barisCSV, kolomCSV, `laba-rugi_${dari}_${sampai}.csv`)}>📊 Excel/CSV</button>
            <button className="btn btn-sm btn-outline" onClick={() => exportPDF('Laporan Laba Rugi', kolomCSV, barisCSV, {
              subjudul: `${toko.nama_toko || 'Seruntul'} · ${dari} s/d ${sampai}`,
              ringkasan: [
                { label: 'Pendapatan', value: rp(pl.pendapatan) },
                { label: 'Laba Kotor', value: rp(pl.labaKotor) },
                { label: 'Laba Bersih', value: rp(pl.labaBersih) },
                { label: 'Margin Bersih', value: pct(pl.marginBersih) },
              ],
            })}>📄 PDF</button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-muted text-center py-4">Menghitung laporan...</p> : (
        <>
          <div className="metrics-grid">
            <div className="metric-card"><div className="metric-label">Pendapatan</div><div className="metric-value text-primary">{rp(pl.pendapatan)}</div></div>
            <div className="metric-card"><div className="metric-label">Laba Kotor</div><div className={`metric-value ${pl.labaKotor >= 0 ? 'text-success' : 'text-danger'}`}>{rp(pl.labaKotor)}</div></div>
            <div className="metric-card"><div className="metric-label">Biaya Operasional</div><div className="metric-value text-danger">{rp(pl.biayaOp)}</div></div>
            <div className="metric-card"><div className="metric-label">Laba Bersih</div><div className={`metric-value ${pl.labaBersih >= 0 ? 'text-success' : 'text-danger'}`}>{rp(pl.labaBersih)}</div></div>
            <div className="metric-card"><div className="metric-label">Margin Kotor</div><div className="metric-value">{pct(pl.marginKotor)}</div></div>
            <div className="metric-card"><div className="metric-label">Margin Bersih</div><div className="metric-value">{pct(pl.marginBersih)}</div></div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">📑</span> Laporan Laba Rugi</div></div>
            <Row label="PENDAPATAN PENJUALAN" nilai={pl.pendapatan} persen="100%" bold />
            <Baris label="Harga Pokok Penjualan (HPP)" nilai={-pl.hpp} persen={pct(-(pl.hpp / (pl.pendapatan || 1)) * 100)} />
            <Baris label="LABA KOTOR" nilai={pl.labaKotor} persen={pct(pl.marginKotor)} bold border />

            <div className="pl-section">BIAYA OPERASIONAL</div>
            {Object.keys(pl.perKategori).filter((k) => !['Pembelian Bahan', 'Hutang'].includes(k)).length === 0 ? (
              <p className="text-muted text-sm">Belum ada biaya operasional tercatat pada periode ini.</p>
            ) : (
              Object.entries(pl.perKategori)
                .filter(([k]) => !['Pembelian Bahan', 'Hutang'].includes(k))
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <Baris key={k} label={`  ${k}`} nilai={-v} persen={pct(-(v / (pl.pendapatan || 1)) * 100)} />
                ))
            )}
            <Baris label="TOTAL BIAYA OPERASIONAL" nilai={-pl.biayaOp} persen={pct(-(pl.biayaOp / (pl.pendapatan || 1)) * 100)} bold border />

            {pl.masukLain > 0 && <Baris label="Pendapatan Lain-lain" nilai={pl.masukLain} persen={pct((pl.masukLain / (pl.pendapatan || 1)) * 100)} />}
            <Baris label="LABA BERSIH" nilai={pl.labaBersih} persen={pct(pl.marginBersih)} bold border />

            <p className="text-xs text-muted mt-3">
              Catatan: HPP dihitung dari harga pokok per item yang tersimpan saat transaksi POS.
              Biaya operasional diambil dari Cashflow (kategori keluar kecuali Pembelian Bahan & Hutang,
              karena pembelian bahan sudah masuk HPP).
            </p>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">📊</span> Ringkasan Penjualan</div></div>
            <div className="pl-row"><span>Jumlah Transaksi</span><span>{pl.jumlahTrx}</span><span></span></div>
            <div className="pl-row"><span>Rata-rata per Transaksi</span><span>{rp(pl.rataTrx)}</span><span></span></div>
            <div className="pl-row"><span>Total Item Terjual</span><span>{items.reduce((s, i) => s + Number(i.qty || 0), 0)}</span><span></span></div>
          </div>
        </>
      )}

      <style jsx>{`
        .pl-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center;
          padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
        .pl-row > span:nth-child(2) { font-weight: 600; min-width: 110px; text-align: right; }
        .pl-row > span:nth-child(3) { min-width: 60px; text-align: right; }
        .pl-bold { font-weight: 600; }
        .pl-border { border-top: 2px solid var(--border); border-bottom: none; margin-top: 4px; padding-top: 10px; }
        .pl-section { font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: .5px;
          margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border); }
      `}</style>
    </AppLayout>
  )
}
