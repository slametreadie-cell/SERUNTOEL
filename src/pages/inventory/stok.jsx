import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const hariIni = () => new Date().toISOString().slice(0, 10)
const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function StokOpname() {
  const { user } = useAuth()
  const [tab, setTab] = useState('bahan')
  const [bahan, setBahan] = useState([])
  const [produk, setProduk] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  // form koreksi
  const [opname, setOpname] = useState(null) // { item, jenis, stokFisik, alasan }

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [bRes, pRes, rRes] = await Promise.all([
      supabase.from('ingredients').select('*').order('nama_bahan'),
      supabase.from('products').select('id, nama_produk, kategori, stok_produk').order('nama_produk'),
      supabase.from('stock_cards').select('*').order('created_at', { ascending: false }).limit(300),
    ])
    if (bRes.error) setError(bRes.error.message)
    setBahan(bRes.data || [])
    setProduk(pRes.data || [])
    setRiwayat(rRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const daftar = tab === 'bahan'
    ? bahan.map((b) => ({ id: b.id, nama: b.nama_bahan, satuan: b.satuan || 'pcs', stok: b.stok_sisa || 0, min: b.stok_minimum || 0, kategori: null }))
    : produk.map((p) => ({ id: p.id, nama: p.nama_produk, satuan: 'pcs', stok: p.stok_produk || 0, min: 0, kategori: p.kategori }))

  const filtered = daftar.filter((d) => !search || (d.nama || '').toLowerCase().includes(search.toLowerCase()))

  const stat = useMemo(() => {
    const kritis = daftar.filter((d) => d.min > 0 && d.stok <= d.min)
    const habis = daftar.filter((d) => d.stok <= 0)
    return { total: daftar.length, kritis: kritis.length, habis: habis.length,
      nilai: bahan.reduce((s, b) => s + (b.stok_sisa || 0), 0) }
  }, [daftar, bahan])

  const mulaiOpname = (item) => {
    setOpname({ item, jenis: opname?.jenis || tab, stokFisik: String(item.stok), alasan: '' })
  }

  const simpanOpname = async () => {
    if (!opname) return
    const fisik = Number(opname.stokFisik)
    if (Number.isNaN(fisik) || fisik < 0) { setError('Stok fisik tidak valid'); return }
    const { item } = opname
    const selisih = fisik - item.stok

    setSaving(true); setError('')
    try {
      if (tab === 'bahan') {
        await supabase.from('ingredients').update({ stok_sisa: fisik }).eq('id', item.id)
        await supabase.from('stock_cards').insert({
          bahan_id: item.id, nama_bahan: item.nama, satuan: item.satuan,
          stok_awal: item.stok, masuk: selisih > 0 ? selisih : 0,
          keluar: selisih < 0 ? Math.abs(selisih) : 0, stok_sisa: fisik, status: 'opname',
        })
      } else {
        await supabase.from('products').update({ stok_produk: fisik }).eq('id', item.id)
      }

      logAudit({ aksi: 'stok_opname', user, sheetTarget: tab === 'bahan' ? 'ingredients' : 'products',
        detail: { nama: item.nama, stok_lama: item.stok, stok_fisik: fisik, selisih, alasan: opname.alasan || null } })

      setMsg(selisih === 0
        ? `✅ ${item.nama}: stok sudah sesuai`
        : `✅ ${item.nama}: dikoreksi ${selisih > 0 ? '+' : ''}${selisih} ${item.satuan}`)
      setOpname(null)
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 4000) }
  }

  return (
    <AppLayout title="Stok & Opname" subtitle="Cek fisik stok dan koreksi selisih">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label">Total Item</div><div className="metric-value text-primary">{stat.total}</div></div>
        <div className="metric-card"><div className="metric-label">Stok Kritis</div><div className="metric-value text-warning">{stat.kritis}</div></div>
        <div className="metric-card"><div className="metric-label">Stok Habis</div><div className="metric-value text-danger">{stat.habis}</div></div>
        <div className="metric-card"><div className="metric-label">Catatan Opname</div><div className="metric-value">{riwayat.length}</div></div>
      </div>

      {/* Form koreksi */}
      {opname && (
        <div className="card" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-header">
            <div className="card-title"><span className="nav-icon">📋</span> Opname — {opname.item.nama}</div>
            <button className="btn btn-sm btn-outline" onClick={() => setOpname(null)}>✕</button>
          </div>
          <div className="text-sm text-muted mb-3">
            Stok tercatat sistem: <b>{opname.item.stok} {opname.item.satuan}</b>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Stok Fisik Hasil Hitung</label>
              <input className="form-control" type="number" autoFocus value={opname.stokFisik}
                onChange={(e) => setOpname({ ...opname, stokFisik: e.target.value })} />
              {opname.stokFisik !== '' && (
                <div className={`text-sm mt-1 ${Number(opname.stokFisik) - opname.item.stok === 0 ? 'text-success' : 'text-danger'}`}>
                  Selisih: <b>{Number(opname.stokFisik) - opname.item.stok > 0 ? '+' : ''}{Number(opname.stokFisik) - opname.item.stok} {opname.item.satuan}</b>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Alasan Selisih (opsional)</label>
              <input className="form-control" value={opname.alasan}
                onChange={(e) => setOpname({ ...opname, alasan: e.target.value })}
                placeholder="mis. tumpah, salah catat, susut" />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={simpanOpname} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : '💾 Simpan Koreksi'}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="flex flex-wrap gap-2">
            <button className={`btn btn-sm ${tab === 'bahan' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab('bahan'); setOpname(null) }}>
              🧂 Bahan Baku
            </button>
            <button className={`btn btn-sm ${tab === 'produk' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab('produk'); setOpname(null) }}>
              📦 Produk Jadi
            </button>
          </div>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="🔍 Cari..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? <p className="text-muted text-center py-4">Memuat...</p>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}>📋</div>
              <h3>Belum ada {tab === 'bahan' ? 'bahan baku' : 'produk'}</h3>
              <p className="text-sm">Tambahkan {tab === 'bahan' ? 'bahan di menu Inventory' : 'produk di menu Produk & HPP'}.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Nama</th>{tab === 'produk' && <th>Kategori</th>}<th className="text-right">Stok Sistem</th><th className="text-right">Stok Min</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const kritis = d.min > 0 && d.stok <= d.min
                    const habis = d.stok <= 0
                    return (
                      <tr key={d.id}>
                        <td className="font-bold">{d.nama}</td>
                        {tab === 'produk' && <td><span className="badge badge-neutral">{d.kategori || '—'}</span></td>}
                        <td className="text-right font-bold">{d.stok} <span className="text-muted text-xs">{d.satuan}</span></td>
                        <td className="text-right text-muted">{d.min || '—'}</td>
                        <td>
                          <span className={`badge ${habis ? 'badge-danger' : kritis ? 'badge-warning' : 'badge-success'}`}>
                            {habis ? 'Habis' : kritis ? 'Kritis' : 'Aman'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button className="btn btn-sm btn-outline" onClick={() => mulaiOpname(d)}>📋 Opname</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Riwayat kartu stok */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><span className="nav-icon">🗂️</span> Kartu Stok (Mutasi Bahan)</div>
          <span className="text-sm text-muted">{riwayat.length} catatan</span>
        </div>
        {riwayat.length === 0 ? (
          <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada mutasi stok. Catatan muncul setelah opname atau pembelian bahan.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Bahan</th><th className="text-right">Awal</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Sisa</th><th>Ket</th></tr></thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted text-sm">{tglID(r.created_at)}</td>
                    <td className="font-bold">{r.nama_bahan}</td>
                    <td className="text-right text-muted">{r.stok_awal}</td>
                    <td className="text-right text-success font-bold">{r.masuk ? `+${r.masuk}` : '—'}</td>
                    <td className="text-right text-danger font-bold">{r.keluar ? `−${r.keluar}` : '—'}</td>
                    <td className="text-right font-bold">{r.stok_sisa} <span className="text-xs text-muted">{r.satuan}</span></td>
                    <td><span className="badge badge-neutral">{r.status || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
