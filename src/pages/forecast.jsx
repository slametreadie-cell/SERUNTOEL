import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function Forecast() {
  const { user } = useAuth()
  const [produk, setProduk] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)

  // Input simulasi
  const [produkId, setProdukId] = useState('')
  const [kenaikanBahan, setKenaikanBahan] = useState(0)
  const [penurunanJual, setPenurunanJual] = useState(0)
  const [kenaikanOp, setKenaikanOp] = useState(0)
  const [perubahanMargin, setPerubahanMargin] = useState(0)

  const [hasil, setHasil] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pRes, rRes] = await Promise.all([
      supabase.from('products').select('id, nama_produk, hpp_per_unit, harga_jual, margin').order('nama_produk'),
      supabase.from('simulation_scenarios').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setProduk(pRes.data || [])
    setRiwayat(rRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const hitung = () => {
    const p = produk.find((x) => x.id === produkId)
    if (!p) { setError('Pilih produk dulu'); return }
    setError('')

    const hppSekarang = Number(p.hpp_per_unit) || 0
    const hargaSekarang = Number(p.harga_jual) || 0
    const marginSekarang = Number(p.margin) || 0

    // HPP baru = HPP sekarang + kenaikan bahan + kenaikan operasional
    const hppBaru = hppSekarang * (1 + (Number(kenaikanBahan) || 0) / 100) * (1 + (Number(kenaikanOp) || 0) / 100)

    // Margin baru
    const marginBaru = marginSekarang + (Number(perubahanMargin) || 0)

    // Harga jual baru berdasarkan margin baru
    const hargaJualBaru = hppBaru * (1 + marginBaru / 100)

    // Laba per unit (dengan penurunan penjualan)
    const labaUnit = hargaJualBaru - hppBaru

    // Estimasi BEP sederhana (asumsi biaya tetap)
    const biayaTetap = 0 // bisa diambil dari konfigurasi nanti
    const bepBaru = biayaTetap > 0 ? Math.ceil(biayaTetap / (labaUnit || 1)) : 0

    setHasil({
      hppSekarang,
      hargaSekarang,
      hppBaru,
      hargaJualBaru,
      marginBaru,
      labaUnit,
      bepBaru,
      penurunanJual: Number(penurunanJual) || 0,
    })
  }

  const simpanSimulasi = async () => {
    if (!hasil) return
    setSaving(true)
    const p = produk.find((x) => x.id === produkId)
    try {
      const { error } = await supabase.from('simulation_scenarios').insert({
        kenaikan_bahan: Number(kenaikanBahan) || 0,
        penurunan_penjualan: Number(penurunanJual) || 0,
        kenaikan_op: Number(kenaikanOp) || 0,
        perubahan_margin: Number(perubahanMargin) || 0,
        hpp_baru: hasil.hppBaru,
        harga_jual_baru: hasil.hargaJualBaru,
        laba_unit: hasil.labaUnit,
        margin_baru: hasil.marginBaru,
        bep_baru: hasil.bepBaru,
        keterangan: p?.nama_produk || '',
        status: 'simulasi',
      })
      if (error) throw error
      setHasil(null)
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Forecast & Simulasi" subtitle="Simulasi dampak perubahan biaya & harga">
      <div className="grid-2">
        {/* Kiri: input simulasi */}
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🎯</span> Simulasi Skenario</div></div>

          <div className="form-group">
            <label className="form-label">Pilih Produk</label>
            <select className="form-control" value={produkId} onChange={(e) => setProdukId(e.target.value)}>
              <option value="">— Pilih produk —</option>
              {produk.map((p) => <option key={p.id} value={p.id}>{p.nama_produk}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kenaikan Bahan (%)</label>
              <input className="form-control" type="number" value={kenaikanBahan} onChange={(e) => setKenaikanBahan(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Penurunan Penjualan (%)</label>
              <input className="form-control" type="number" value={penurunanJual} onChange={(e) => setPenurunanJual(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kenaikan Operasional (%)</label>
              <input className="form-control" type="number" value={kenaikanOp} onChange={(e) => setKenaikanOp(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Perubahan Margin (poin %)</label>
              <input className="form-control" type="number" value={perubahanMargin} onChange={(e) => setPerubahanMargin(e.target.value)} placeholder="mis. -5 atau +10" />
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={hitung}>🔮 Hitung Simulasi</button>
            {hasil && <button className="btn btn-outline" onClick={simpanSimulasi} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>}
          </div>

          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>

        {/* Kanan: hasil */}
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">📊</span> Hasil Simulasi</div></div>

          {!hasil ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}>🔮</div>
              <h3>Belum ada simulasi</h3>
              <p className="text-sm">Isi parameter di kiri lalu klik "Hitung Simulasi".</p>
            </div>
          ) : (
            <div className="hpp-summary">
              <div className="hpp-row"><span>HPP Sekarang</span><b>{formatRupiah(hasil.hppSekarang)}</b></div>
              <div className="hpp-row"><span>Harga Jual Sekarang</span><b>{formatRupiah(hasil.hargaSekarang)}</b></div>
              <div className="hpp-row"><span>HPP Baru</span><b className="text-danger">{formatRupiah(hasil.hppBaru)}</b></div>
              <div className="hpp-row"><span>Harga Jual Baru</span><b className="text-primary">{formatRupiah(hasil.hargaJualBaru)}</b></div>
              <div className="hpp-row"><span>Margin Baru</span><b>{Math.round(hasil.marginBaru)}%</b></div>
              <div className="hpp-row"><span>Laba / Unit</span><b className={hasil.labaUnit >= 0 ? 'text-success' : 'text-danger'}>{formatRupiah(hasil.labaUnit)}</b></div>
              {hasil.bepBaru > 0 && <div className="hpp-row"><span>BEP (unit)</span><b>{hasil.bepBaru}</b></div>}
            </div>
          )}

          {hasil && hasil.labaUnit < 0 && (
            <div className="alert alert-danger mt-3">⚠️ Produk ini akan RUGI {formatRupiah(Math.abs(hasil.labaUnit))} per unit!</div>
          )}
        </div>
      </div>

      {/* Riwayat simulasi */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">📜</span> Riwayat Simulasi</div>
        </div>
        {riwayat.length === 0 ? (
          <div className="empty-state"><p className="text-sm">Belum ada simulasi tersimpan.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Produk</th><th>Kenaikan Bahan</th><th>Penurunan Jual</th><th>HPP Baru</th><th>Harga Baru</th><th>Laba/Unit</th></tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.keterangan || '—'}</td>
                    <td>+{r.kenaikan_bahan}%</td>
                    <td>-{r.penurunan_penjualan}%</td>
                    <td>{formatRupiah(r.hpp_baru)}</td>
                    <td>{formatRupiah(r.harga_jual_baru)}</td>
                    <td className={r.laba_unit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>{formatRupiah(r.laba_unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .hpp-summary { display: flex; flex-direction: column; gap: 8px; }
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      `}</style>
    </AppLayout>
  )
}
