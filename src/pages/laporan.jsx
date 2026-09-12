import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const formatRupiahShort = (v) => {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

const formatTanggal = (v) => {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const toISO = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const PRESETS = [
  { id: 'hari', label: 'Hari Ini' },
  { id: '7', label: '7 Hari' },
  { id: '30', label: '30 Hari' },
  { id: 'bulan', label: 'Bulan Ini' },
  { id: 'custom', label: 'Custom' },
]

export default function Laporan() {
  const { user } = useAuth()
  const [transaksi, setTransaksi] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date()
  const [preset, setPreset] = useState('30')
  const [dari, setDari] = useState(toISO(new Date(today.getTime() - 29 * 86400000)))
  const [sampai, setSampai] = useState(toISO(today))

  // Hitung rentang tanggal dari preset
  useEffect(() => {
    const now = new Date()
    if (preset === 'hari') {
      setDari(toISO(now)); setSampai(toISO(now))
    } else if (preset === 'bulan') {
      setDari(toISO(new Date(now.getFullYear(), now.getMonth(), 1))); setSampai(toISO(now))
    } else if (preset !== 'custom') {
      const n = Number(preset)
      setDari(toISO(new Date(now.getTime() - (n - 1) * 86400000))); setSampai(toISO(now))
    }
  }, [preset])

  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return
    setLoading(true); setError('')
    try {
      const gte = `${dari}T00:00:00`
      const lte = `${sampai}T23:59:59`

      const { data: trx, error: e1 } = await supabase
        .from('transactions')
        .select('*')
        .gte('tanggal', gte)
        .lte('tanggal', lte)
        .order('tanggal', { ascending: true })
      if (e1) throw e1

      const ids = (trx || []).map((t) => t.id)
      let items = []
      if (ids.length) {
        const { data: it, error: e2 } = await supabase
          .from('transaction_items')
          .select('*')
          .in('transaksi_id', ids)
        if (e2) throw e2
        items = it || []
      }

      setTransaksi((trx || []).map((t) => ({ ...t, items: items.filter((i) => i.transaksi_id === t.id) })))
    } catch (err) {
      setError(err.message || 'Gagal memuat laporan')
      setTransaksi([])
    }
    setLoading(false)
  }, [dari, sampai])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Agregasi ──────────────────────────────────────────────────
  const ringkas = useMemo(() => {
    const omset = transaksi.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const jumlah = transaksi.length
    let hpp = 0
    const perProduk = {}
    const perMetode = {}
    const perHari = {}
    const perChannel = {}

    transaksi.forEach((t) => {
      const tgl = (t.tanggal || '').slice(0, 10)
      if (!perHari[tgl]) perHari[tgl] = { omset: 0, jumlah: 0 }
      perHari[tgl].omset += Number(t.total_bayar || 0)
      perHari[tgl].jumlah += 1

      const m = t.metode_pembayaran || 'lainnya'
      if (!perMetode[m]) perMetode[m] = { total: 0, jumlah: 0 }
      perMetode[m].total += Number(t.total_bayar || 0)
      perMetode[m].jumlah += 1

      const c = t.channel || 'offline'
      if (!perChannel[c]) perChannel[c] = { total: 0, jumlah: 0 }
      perChannel[c].total += Number(t.total_bayar || 0)
      perChannel[c].jumlah += 1

      ;(t.items || []).forEach((i) => {
        const nama = i.nama_produk || 'Tanpa nama'
        const qty = Number(i.qty || 0)
        const sub = Number(i.subtotal || 0)
        const h = Number(i.hpp_satuan || 0) * qty
        hpp += h
        if (!perProduk[nama]) perProduk[nama] = { qty: 0, omset: 0, hpp: 0 }
        perProduk[nama].qty += qty
        perProduk[nama].omset += sub
        perProduk[nama].hpp += h
      })
    })

    const labaKotor = omset - hpp
    return {
      omset, jumlah, hpp, labaKotor,
      marginPersen: omset > 0 ? (labaKotor / omset) * 100 : 0,
      rataRata: jumlah > 0 ? omset / jumlah : 0,
      perProduk: Object.entries(perProduk).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.qty - a.qty),
      perMetode: Object.entries(perMetode).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.total - a.total),
      perChannel: Object.entries(perChannel).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.total - a.total),
      perHari: Object.entries(perHari).map(([tgl, v]) => ({ tgl, ...v })).sort((a, b) => a.tgl.localeCompare(b.tgl)),
    }
  }, [transaksi])

  const maxHarian = Math.max(1, ...ringkas.perHari.map((d) => d.omset))

  return (
    <AppLayout title="Laporan" subtitle="Analisis penjualan & laba">
      {/* Filter periode */}
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2" style={{ width: '100%', marginTop: 8 }}>
              <input type="date" className="form-control" style={{ maxWidth: 170 }} value={dari} onChange={(e) => setDari(e.target.value)} />
              <span className="text-muted text-sm">s/d</span>
              <input type="date" className="form-control" style={{ maxWidth: 170 }} value={sampai} onChange={(e) => setSampai(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-sm text-muted mt-2">{formatTanggal(dari)} — {formatTanggal(sampai)}</p>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {loading ? (
        <p className="text-muted text-center py-4">Memuat laporan...</p>
      ) : (
        <>
          {/* Metrics utama */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Total Omset</div>
              <div className="metric-value text-primary">{formatRupiah(ringkas.omset)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total HPP</div>
              <div className="metric-value text-danger">{formatRupiah(ringkas.hpp)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Laba Kotor</div>
              <div className={`metric-value ${ringkas.labaKotor >= 0 ? 'text-success' : 'text-danger'}`}>{formatRupiah(ringkas.labaKotor)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Margin</div>
              <div className="metric-value">{ringkas.marginPersen.toFixed(1)}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Jumlah Transaksi</div>
              <div className="metric-value">{ringkas.jumlah}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Rata-rata / Transaksi</div>
              <div className="metric-value">{formatRupiah(ringkas.rataRata)}</div>
            </div>
          </div>

          {/* Grafik harian */}
          <div className="card">
            <div className="card-header"><div className="card-title"><span className="nav-icon">📈</span> Omset Harian</div></div>
            {ringkas.perHari.length === 0 ? (
              <p className="text-muted text-sm">Tidak ada data pada periode ini.</p>
            ) : (
              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 160, minWidth: ringkas.perHari.length * 44 }}>
                  {ringkas.perHari.map((d) => (
                    <div key={d.tgl} style={{ flex: '0 0 38px', textAlign: 'center' }} title={`${d.tgl}: ${formatRupiah(d.omset)}`}>
                      <div className="text-xs text-muted" style={{ marginBottom: 2 }}>{formatRupiahShort(d.omset)}</div>
                      <div
                        style={{
                          height: Math.max(4, (d.omset / maxHarian) * 110),
                          background: 'var(--primary, #2563eb)',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>{d.tgl.slice(8)}/{d.tgl.slice(5, 7)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Produk terlaris */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><span className="nav-icon">🏆</span> Produk Terlaris</div>
              <span className="text-sm text-muted">{ringkas.perProduk.length} produk</span>
            </div>
            {ringkas.perProduk.length === 0 ? (
              <div className="empty-state">
                <div className="nav-icon" style={{ fontSize: 40 }}>📦</div>
                <h3>Belum ada penjualan</h3>
                <p className="text-sm">Data produk muncul setelah ada transaksi di POS.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Produk</th><th className="text-right">Terjual</th><th className="text-right">Omset</th><th className="text-right">Laba</th></tr>
                  </thead>
                  <tbody>
                    {ringkas.perProduk.map((p, idx) => (
                      <tr key={p.nama}>
                        <td className="font-bold">{idx + 1}. {p.nama}</td>
                        <td className="text-right">{p.qty}</td>
                        <td className="text-right">{formatRupiah(p.omset)}</td>
                        <td className={`text-right font-bold ${p.omset - p.hpp >= 0 ? 'text-success' : 'text-danger'}`}>{formatRupiah(p.omset - p.hpp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown metode & channel */}
          <div className="grid-2">
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title"><span className="nav-icon">💳</span> Metode Bayar</div>
              </div>
              {ringkas.perMetode.length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada data.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Metode</th><th className="text-right">Transaksi</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {ringkas.perMetode.map((m) => (
                        <tr key={m.nama}>
                          <td className="capitalize font-bold">{m.nama}</td>
                          <td className="text-right">{m.jumlah}</td>
                          <td className="text-right">{formatRupiah(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title"><span className="nav-icon">🏪</span> Channel Penjualan</div>
              </div>
              {ringkas.perChannel.length === 0 ? (
                <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada data.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Channel</th><th className="text-right">Transaksi</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {ringkas.perChannel.map((c) => (
                        <tr key={c.nama}>
                          <td className="capitalize font-bold">{c.nama}</td>
                          <td className="text-right">{c.jumlah}</td>
                          <td className="text-right">{formatRupiah(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Rincian harian */}
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><span className="nav-icon">📅</span> Rincian Harian</div>
            </div>
            {ringkas.perHari.length === 0 ? (
              <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada data.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Tanggal</th><th className="text-right">Transaksi</th><th className="text-right">Omset</th><th className="text-right">Rata-rata</th></tr></thead>
                  <tbody>
                    {[...ringkas.perHari].reverse().map((d) => (
                      <tr key={d.tgl}>
                        <td>{formatTanggal(d.tgl)}</td>
                        <td className="text-right">{d.jumlah}</td>
                        <td className="text-right font-bold">{formatRupiah(d.omset)}</td>
                        <td className="text-right text-muted">{formatRupiah(d.jumlah ? d.omset / d.jumlah : 0)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--card-alt, rgba(0,0,0,0.03))' }}>
                      <td className="font-extrabold">TOTAL</td>
                      <td className="text-right font-extrabold">{ringkas.jumlah}</td>
                      <td className="text-right font-extrabold">{formatRupiah(ringkas.omset)}</td>
                      <td className="text-right font-extrabold">{formatRupiah(ringkas.rataRata)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  )
}
