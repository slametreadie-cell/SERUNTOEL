import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import { LOYALTY_DEFAULT, TIER_DEFAULT, TIER_EMOJI, ORDER_TIER, tierDari } from '../utils/loyalty'
import Icon from '../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function Loyalty() {
  const { user } = useAuth()
  const [tab, setTab] = useState('member')
  const [members, setMembers] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [tiers, setTiers] = useState(TIER_DEFAULT)
  const [config, setConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    const [mRes, hRes, tRes, cRes] = await Promise.all([
      supabase.from('loyalty_members').select('*').order('total_belanja', { ascending: false }),
      supabase.from('loyalty_history').select('*').order('tanggal', { ascending: false }).limit(300),
      supabase.from('tier_config').select('*').order('target_bulanan'),
      supabase.from('loyalty_config').select('*').order('key'),
    ])
    if (mRes.error) setError(mRes.error.message)
    setMembers(mRes.data || [])
    setRiwayat(hRes.data || [])
    setTiers((tRes.data && tRes.data.length) ? tRes.data : TIER_DEFAULT)
    setConfig(cRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const cfgVal = (k) => {
    const row = config.find((c) => c.key === k)
    return row?.value ?? LOYALTY_DEFAULT[k]
  }

  const setCfg = async (k, v) => {
    const row = config.find((c) => c.key === k)
    if (row) await supabase.from('loyalty_config').update({ value: String(v) }).eq('id', row.id)
    else await supabase.from('loyalty_config').insert({ key: k, value: String(v) })
  }

  const simpanConfig = async () => {
    setSaving(true)
    try {
      await setCfg('aktif', String(cfgAktif))
      await setCfg('poin_per_rupiah', String(poinPer))
      await setCfg('nilai_poin', String(nilaiPoin))
      await setCfg('min_tukar', String(minTukar))
      logAudit({ aksi: 'ubah_loyalty_config', user, sheetTarget: 'loyalty_config', detail: { poin_per_rupiah: poinPer, nilai_poin: nilaiPoin, min_tukar: minTukar } })
      setMsg(' Konfigurasi poin disimpan')
      fetchData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const [cfgAktif, setCfgAktif] = useState(true)
  const [poinPer, setPoinPer] = useState(LOYALTY_DEFAULT.poin_per_rupiah)
  const [nilaiPoin, setNilaiPoin] = useState(LOYALTY_DEFAULT.nilai_poin)
  const [minTukar, setMinTukar] = useState(LOYALTY_DEFAULT.min_tukar)

  useEffect(() => {
    if (!config.length) return
    setCfgAktif(String(cfgVal('aktif')) !== 'false')
    setPoinPer(cfgVal('poin_per_rupiah'))
    setNilaiPoin(cfgVal('nilai_poin'))
    setMinTukar(cfgVal('min_tukar'))
  }, [config])

  const simpanTier = async (t) => {
    const row = tiers.find((x) => x.tier === t.tier)
    if (row?.id) {
      await supabase.from('tier_config').update({
        diskon_persen: Number(t.diskon_persen) || 0,
        target_bulanan: Number(t.target_bulanan) || 0,
        keterangan: t.keterangan || null,
      }).eq('id', row.id)
    } else {
      await supabase.from('tier_config').insert({
        tier: t.tier, diskon_persen: Number(t.diskon_persen) || 0,
        target_bulanan: Number(t.target_bulanan) || 0, keterangan: t.keterangan || null,
      })
    }
    setMsg(' Tier diperbarui')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const seedTier = async () => {
    setSaving(true)
    for (const t of TIER_DEFAULT) {
      const row = tiers.find((x) => x.tier === t.tier)
      if (!row) await supabase.from('tier_config').insert(t)
    }
    setSaving(false)
    setMsg(' Tier default dibuat')
    fetchData()
  }

  const editTier = (tier, field, val) => {
    setTiers((prev) => prev.map((x) => x.tier === tier ? { ...x, [field]: val } : x))
  }

  const hapusMember = async (m) => {
    if (!confirm(`Hapus member ${m.nama}?`)) return
    await supabase.from('loyalty_members').delete().eq('id', m.id)
    logAudit({ aksi: 'hapus_member', user, sheetTarget: 'loyalty_members', detail: { nama: m.nama } })
    fetchData()
  }

  const sinkronTier = async () => {
    setSaving(true)
    for (const m of members) {
      const t = tierDari(m.total_belanja, tiers)
      if (t !== m.tier) {
        await supabase.from('loyalty_members').update({ tier: t }).eq('id', m.id)
      }
    }
    setSaving(false)
    setMsg(' Tier semua member disinkronkan')
    fetchData()
    setTimeout(() => setMsg(''), 3000)
  }

  const filtered = members.filter((m) => {
    const okS = !search || (m.nama || '').toLowerCase().includes(search.toLowerCase()) || (m.kontak || '').includes(search)
    const okT = !tierFilter || m.tier === tierFilter
    return okS && okT
  })

  const stat = useMemo(() => ({
    total: members.length,
    totalPoin: members.reduce((s, m) => s + (m.poin || 0), 0),
    totalBelanja: members.reduce((s, m) => s + Number(m.total_belanja || 0), 0),
    perTier: ORDER_TIER.map((t) => ({ tier: t, n: members.filter((m) => m.tier === t).length })),
  }), [members])

  return (
    <AppLayout title="Loyalty & Member" subtitle="Poin, tier, dan pelanggan setia">
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger"> {error}</div>}

      <div className="metrics-grid">
        <StatCard label="Total Member" value={stat.total} icon="users" tone="primary" />
        <StatCard label="Poin Beredar" value={stat.totalPoin.toLocaleString('id-ID')} icon="gem" />
        <StatCard label="Nilai Poin" value={formatRupiah(stat.totalPoin * (Number(nilaiPoin) || 0))} icon="gem" tone="success" />
        <StatCard label="Total Belanja Member" value={formatRupiah(stat.totalBelanja)} icon="users" />
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'member', l: ' Member' },
            { k: 'riwayat', l: ' Riwayat Poin' },
            { k: 'tier', l: ' Tier & Diskon' },
            { k: 'config', l: ' Aturan Poin' },
          ].map((t) => (
            <button key={t.k} className={`btn btn-sm ${tab === t.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* ===== MEMBER ===== */}
      {tab === 'member' && (
        <>
          <div className="card" style={{ padding: 16 }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2" style={{ flex: 1 }}>
                <input className="form-control" style={{ maxWidth: 220 }} placeholder="Cari nama/kontak..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="form-control" style={{ maxWidth: 160 }} value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
                  <option value="">Semua Tier</option>
                  {ORDER_TIER.map((t) => <option key={t} value={t}>{TIER_EMOJI[t]} {t}</option>)}
                </select>
              </div>
              <button className="btn btn-outline" onClick={sinkronTier} disabled={saving}> Sinkron Tier</button>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {stat.perTier.map((p) => (
                <span key={p.tier} className="badge badge-neutral">{TIER_EMOJI[p.tier]} {p.tier}: <b>{p.n}</b></span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><Icon name="users" size={16} /> Daftar Member</div>
              <span className="text-sm text-muted">{filtered.length} member</span>
            </div>
            {loading ? <div className="p-3"><SkeletonRows rows={4} /></div>
              : filtered.length === 0 ? (
                <EmptyBlock icon="users" title="Belum ada member" message="Member otomatis terdaftar saat transaksi POS dengan nama pelanggan." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Nama</th><th>Kontak</th><th>Tier</th><th className="text-right">Poin</th><th className="text-right">Belanja</th><th className="text-right">Trx</th><th>Terakhir</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map((m) => (
                        <tr key={m.id}>
                          <td className="font-bold">{m.nama}</td>
                          <td>{m.kontak || '—'}</td>
                          <td><span className="badge badge-warning">{TIER_EMOJI[m.tier] || ''} {m.tier}</span></td>
                          <td className="text-right font-bold text-primary">{m.poin || 0}</td>
                          <td className="text-right">{formatRupiah(m.total_belanja)}</td>
                          <td className="text-right">{m.total_transaksi || 0}</td>
                          <td className="text-muted text-sm">{tglID(m.last_visit)}</td>
                          <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => hapusMember(m)}><Icon name="close" size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </>
      )}

      {/* ===== RIWAYAT POIN ===== */}
      {tab === 'riwayat' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: 16 }}>
            <div className="card-title"><Icon name="fileText" size={16} /> Riwayat Poin</div>
            <span className="text-sm text-muted">{riwayat.length} catatan</span>
          </div>
          {riwayat.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: 16 }}>Belum ada riwayat poin.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tanggal</th><th>Member</th><th>Jenis</th><th className="text-right">Poin</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {riwayat.map((r) => {
                    const m = members.find((x) => x.id === r.member_id)
                    return (
                      <tr key={r.id}>
                        <td className="text-muted text-sm">{tglID(r.tanggal)}</td>
                        <td className="font-bold">{m?.nama || '—'}</td>
                        <td><span className={`badge ${r.jenis === 'tambah' ? 'badge-success' : 'badge-danger'}`}>{r.jenis === 'tambah' ? '↑ Tambah' : '↓ Tukar'}</span></td>
                        <td className={`text-right font-bold ${r.jenis === 'tambah' ? 'text-success' : 'text-danger'}`}>{r.jenis === 'tambah' ? '+' : '−'}{r.poin}</td>
                        <td className="text-sm text-muted">{r.keterangan || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== TIER ===== */}
      {tab === 'tier' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Icon name="gem" size={16} /> Tier & Diskon Otomatis</div>
            <button className="btn btn-sm btn-outline" onClick={seedTier} disabled={saving}>＋ Buat Tier Default</button>
          </div>
          <p className="text-sm text-muted mb-3">
            Tier naik otomatis berdasarkan total belanja member. Diskon diterapkan saat member belanja.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tier</th><th>Diskon (%)</th><th>Min. Total Belanja (Rp)</th><th>Keterangan</th><th></th></tr></thead>
              <tbody>
                {ORDER_TIER.map((t) => {
                  const row = tiers.find((x) => x.tier === t) || { tier: t, diskon_persen: 0, target_bulanan: 0, keterangan: '' }
                  return (
                    <tr key={t}>
                      <td className="font-bold">{TIER_EMOJI[t]} {t}</td>
                      <td><input className="form-control" type="number" style={{ maxWidth: 100, padding: '6px 8px' }}
                        value={row.diskon_persen} onChange={(e) => editTier(t, 'diskon_persen', e.target.value)} /></td>
                      <td><input className="form-control" type="number" style={{ maxWidth: 160, padding: '6px 8px' }}
                        value={row.target_bulanan} onChange={(e) => editTier(t, 'target_bulanan', e.target.value)} /></td>
                      <td><input className="form-control" style={{ padding: '6px 8px' }}
                        value={row.keterangan || ''} onChange={(e) => editTier(t, 'keterangan', e.target.value)} /></td>
                      <td className="text-right">
                        <button className="btn btn-sm btn-primary" onClick={() => simpanTier(row)}><Icon name="checkSquare" size={13} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CONFIG ===== */}
      {tab === 'config' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="settings" size={16} /> Aturan Poin</div></div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status Loyalitas</label>
              <select className="form-control" value={cfgAktif ? 'true' : 'false'} onChange={(e) => setCfgAktif(e.target.value === 'true')}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Belanja per 1 Poin (Rp)</label>
              <input className="form-control" type="number" value={poinPer} onChange={(e) => setPoinPer(e.target.value)} />
              <div className="text-xs text-muted mt-1">Contoh: 10000 → setiap Rp10.000 dapat 1 poin</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nilai 1 Poin (Rp)</label>
              <input className="form-control" type="number" value={nilaiPoin} onChange={(e) => setNilaiPoin(e.target.value)} />
              <div className="text-xs text-muted mt-1">Contoh: 100 → 1 poin bernilai Rp100 saat ditukar</div>
            </div>
            <div className="form-group">
              <label className="form-label">Minimal Poin Bisa Ditukar</label>
              <input className="form-control" type="number" value={minTukar} onChange={(e) => setMinTukar(e.target.value)} />
            </div>
          </div>

          <div className="alert alert-info">
            Simulasi: belanja {formatRupiah(100000)} → dapat <b>{Math.floor(100000 / (Number(poinPer) || 1))} poin</b> senilai{' '}
            <b>{formatRupiah(Math.floor(100000 / (Number(poinPer) || 1)) * (Number(nilaiPoin) || 0))}</b>.
          </div>

          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={simpanConfig} disabled={saving}>
              {saving ? <><span className="spinner" /> Menyimpan...</> : ' Simpan Aturan'}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
