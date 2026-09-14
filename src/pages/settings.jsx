import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

export default function Settings() {
  const { user } = useAuth()
  const [config, setConfig] = useState([])
  const [kategori, setKategori] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [cRes, kRes] = await Promise.all([
      supabase.from('configuration').select('*').order('key'),
      supabase.from('product_categories').select('*').order('nama'),
    ])
    setConfig(cRes.data || [])
    setKategori(kRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const updateConfig = async (id, value) => {
    await supabase.from('configuration').update({ value }).eq('id', id)
  }

  const [newKategori, setNewKategori] = useState('')
  const [newMargin, setNewMargin] = useState(30)

  const addKategori = async () => {
    if (!newKategori.trim()) return
    const { error } = await supabase.from('product_categories').insert({
      nama: newKategori.trim(),
      margin_persen: Number(newMargin) || 30,
    })
    if (error) setMsg('Gagal: ' + error.message)
    else {
      setNewKategori('')
      setMsg(' Kategori ditambahkan')
      fetchData()
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const hapusKategori = async (id) => {
    await supabase.from('product_categories').delete().eq('id', id)
    fetchData()
  }

  if (loading) {
    return <AppLayout title="Pengaturan"><div className="card"><p className="text-muted">Memuat...</p></div></AppLayout>
  }

  return (
    <AppLayout title="Pengaturan" subtitle="Konfigurasi aplikasi">
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="grid-2">
        {/* Konfigurasi umum */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="settings" size={16} /> Konfigurasi Umum</div></div>
          {config.map((c) => (
            <div className="form-group" key={c.id}>
              <label className="form-label">{c.key}</label>
              <input
                className="form-control"
                defaultValue={c.value}
                onBlur={(e) => updateConfig(c.id, e.target.value)}
              />
              {c.keterangan && <div className="text-xs text-muted mt-1">{c.keterangan}</div>}
            </div>
          ))}
        </div>

        {/* Identitas toko untuk struk */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="receipt" size={16} /> Identitas Toko (Struk)</div></div>
          {['nama_toko', 'alamat_toko', 'telepon_toko', 'footer_struk'].map((key) => {
            const row = config.find((c) => c.key === key)
            return (
              <div className="form-group" key={key}>
                <label className="form-label">
                  {{ nama_toko: 'Nama Toko', alamat_toko: 'Alamat', telepon_toko: 'No. Telepon', footer_struk: 'Ucapan di Struk' }[key]}
                </label>
                <input
                  className="form-control"
                  defaultValue={row?.value || ''}
                  placeholder={row ? '' : 'belum diisi'}
                  onBlur={(e) => {
                    if (row) updateConfig(row.id, e.target.value)
                    else supabase.from('configuration').insert({ key, value: e.target.value }).then(() => fetchData())
                  }}
                />
              </div>
            )
          })}
          <div className="text-xs text-muted">Teks ini muncul di struk yang dicetak dari POS.</div>
        </div>
      </div>

      {/* Kategori produk */}
      <div className="card">
        <div className="card-header"><div className="card-title"><span className="nav-icon"></span> Kategori Produk</div></div>

        <div className="flex gap-2 mb-3">
          <input className="form-control" placeholder="Nama kategori baru" value={newKategori} onChange={(e) => setNewKategori(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 90 }} type="number" placeholder="Margin %" value={newMargin} onChange={(e) => setNewMargin(e.target.value)} />
          <button className="btn btn-primary" onClick={addKategori}><Icon name="plus" size={13} /></button>
        </div>

        {kategori.map((k) => (
          <div key={k.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="font-bold">{k.nama}</div>
              <div className="text-xs text-muted">Margin default: {k.margin_persen}%</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => hapusKategori(k.id)}><Icon name="close" size={13} /></button>
          </div>
        ))}
      </div>

      {/* Info akun */}
      <div className="card">
        <div className="card-header"><div className="card-title"><Icon name="userCheck" size={16} /> Info Akun</div></div>
        <div className="hpp-row"><span>Email</span><b>{user?.email}</b></div>
        <div className="hpp-row"><span>User ID</span><b className="text-muted" style={{ fontSize: 12 }}>{user?.id}</b></div>
      </div>

      <style jsx>{`
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
      `}</style>
    </AppLayout>
  )
}
