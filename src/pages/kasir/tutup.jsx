import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { logAudit } from '../../utils/audit'
import Icon from '../../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (v) => new Date(v).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

const hariIni = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function TutupKas() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [tanggal, setTanggal] = useState(hariIni())
  const [modalAwal, setModalAwal] = useState('')
  const [uangFisik, setUangFisik] = useState('')
  const [catatan, setCatatan] = useState('')

  const [trxHari, setTrxHari] = useState([])
  const [riwayat, setRiwayat] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const gte = `${tanggal}T00:00:00`
      const lte = `${tanggal}T23:59:59`

      const [tRes, rRes] = await Promise.all([
        supabase.from('transactions').select('*')
          .gte('tanggal', gte).lte('tanggal', lte).order('tanggal', { ascending: true }),
        supabase.from('cash_closings').select('*')
          .order('tanggal', { ascending: false }).limit(20),
      ])

      if (tRes.error) throw tRes.error
      setTrxHari(tRes.data || [])
      setRiwayat(rRes.data || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [tanggal])

  useEffect(() => { fetchData() }, [fetchData])

  // ===== Rekap =====
  const rekap = useMemo(() => {
    const penjualan = trxHari.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const cash = trxHari.filter((t) => t.metode_pembayaran === 'cash')
      .reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const nonCash = penjualan - cash
    const perMetode = {}
    trxHari.forEach((t) => {
      const m = t.metode_pembayaran || 'lainnya'
      perMetode[m] = (perMetode[m] || 0) + Number(t.total_bayar || 0)
    })
    const modal = Number(modalAwal) || 0
    const fisik = Number(uangFisik) || 0
    const seharusnya = modal + cash          // uang tunai yang seharusnya ada di laci
    const selisih = fisik > 0 ? fisik - seharusnya : 0

    return { penjualan, cash, nonCash, perMetode, jumlah: trxHari.length, modal, fisik, seharusnya, selisih }
  }, [trxHari, modalAwal, uangFisik])

  const sudahDitutup = riwayat.find((r) => r.tanggal === tanggal)

  const simpan = async () => {
    if (Number(uangFisik) <= 0) { setError('Isi jumlah uang fisik di laci dulu'); return }
    setSaving(true); setError('')
    try {
      const { error } = await supabase.from('cash_closings').insert({
        tanggal,
        saldo_sistem: rekap.seharusnya,
        uang_fisik: Number(uangFisik) || 0,
        selisih: rekap.selisih,
        penjualan_hari_ini: rekap.penjualan,
        trx_hari_ini: rekap.jumlah,
        modal_awal: Number(modalAwal) || 0,
        catatan: catatan || null,
        user_email: user?.email || null,
        user_id: user?.id || null,
      })
      if (error) throw error

      logAudit({
        aksi: 'tutup_kas', user, sheetTarget: 'cash_closings',
        detail: {
          tanggal, penjualan: rekap.penjualan, trx: rekap.jumlah,
          seharusnya: rekap.seharusnya, fisik: Number(uangFisik) || 0, selisih: rekap.selisih,
        },
      })

      setMsg(rekap.selisih === 0
        ? ' Kas seimbang!'
        : ` Tersimpan — selisih ${formatRupiah(Math.abs(rekap.selisih))} (${rekap.selisih > 0 ? 'lebih' : 'kurang'})`)
      setUangFisik(''); setCatatan('')
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 6000)
    }
  }

  const selisihTone = rekap.fisik > 0 ? (rekap.selisih === 0 ? '' : rekap.selisih > 0 ? 'warning' : 'danger') : ''
  const selisihLabel = rekap.fisik > 0
    ? (rekap.selisih === 0 ? 'Seimbang' : rekap.selisih > 0 ? 'Lebih' : 'Kurang')
    : 'Belum dihitung'

  return (
    <AppLayout
      title="Tutup Kas"
      subtitle="Rekap uang laci & serah terima shift"
      actions={<Link href="/pos" className="btn btn-outline btn-sm"><Icon name="cart" size={13} /> Kembali ke POS</Link>}
    >
      {msg && <div className="alert alert-success"><Icon name="checkSquare" size={16} /> {msg}</div>}
      {error && <div className="alert alert-danger"><Icon name="alert" size={16} /> {error}</div>}

      {sudahDitutup && (
        <div className="alert alert-warning">
          <Icon name="alert" size={16} /> Tanggal <b>{tanggal}</b> sudah pernah ditutup oleh {sudahDitutup.user_email || '—'} pada {tglID(sudahDitutup.created_at)}.
          Menyimpan lagi akan menambah catatan baru.
        </div>
      )}

      {/* Rekap hari ini */}
      {loading ? (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
      ) : (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <StatCard label={`Penjualan ${tanggal}`} value={formatRupiah(rekap.penjualan)} icon="trendingUp"
            tone="primary" hint={`${rekap.jumlah} transaksi`} />
          <StatCard label="Uang Tunai (laci)" value={formatRupiah(rekap.cash)} icon="banknote"
            hint="transaksi cash hari ini" />
          <StatCard label="Seharusnya di Laci" value={formatRupiah(rekap.seharusnya)} icon="lock"
            tone={rekap.fisik > 0 && rekap.selisih !== 0 ? 'warning' : 'primary'} hint={`modal ${formatRupiah(rekap.modal)} + tunai`} />
          <StatCard label="Selisih" value={rekap.fisik > 0 ? formatRupiah(rekap.selisih) : '—'} icon="target"
            tone={selisihTone || ''} hint={selisihLabel} />
        </div>
      )}

      <div className="grid-2">
        {/* ===== Kiri: input ===== */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="lock" size={16} /> Hitung Uang Laci</div></div>

          <div className="form-group">
            <label className="form-label">Tanggal</label>
            <input className="form-control" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Modal Awal (Rp)</label>
              <input className="form-control" type="number" value={modalAwal} onChange={(e) => setModalAwal(e.target.value)} placeholder="0" />
              <div className="text-xs text-muted mt-1">Uang kembalian yang disiapkan di awal</div>
            </div>
            <div className="form-group">
              <label className="form-label">Uang Fisik di Laci (Rp)</label>
              <input className="form-control" type="number" value={uangFisik} onChange={(e) => setUangFisik(e.target.value)} placeholder="0" />
              <div className="text-xs text-muted mt-1">Hasil hitung uang tunai sebenarnya</div>
            </div>
          </div>

          {/* Rekap */}
          <div className="rekap">
            <div className="rk-row"><span>Transaksi tunai hari ini</span><b>{formatRupiah(rekap.cash)}</b></div>
            <div className="rk-row"><span>+ Modal awal</span><b>{formatRupiah(rekap.modal)}</b></div>
            <div className="rk-row sub"><span>Seharusnya di laci</span><b className="text-primary">{formatRupiah(rekap.seharusnya)}</b></div>
            <div className="rk-row"><span>Uang fisik dihitung</span><b>{formatRupiah(rekap.fisik)}</b></div>
            <div className={`rk-row sub ${rekap.selisih === 0 ? '' : rekap.selisih > 0 ? 'text-success' : 'text-danger'}`}>
              <span>Selisih</span>
              <b>{rekap.fisik > 0 ? `${rekap.selisih > 0 ? '+' : ''}${formatRupiah(rekap.selisih)}` : '—'}</b>
            </div>
          </div>

          {rekap.fisik > 0 && (
            <div className={`alert ${rekap.selisih === 0 ? 'alert-success' : 'alert-warning'} mt-3`}>
              {rekap.selisih === 0
                ? ' Kas seimbang, tidak ada selisih.'
                : rekap.selisih > 0
                  ? ` Uang fisik LEBIH ${formatRupiah(rekap.selisih)} dari seharusnya.`
                  : ` Uang fisik KURANG ${formatRupiah(Math.abs(rekap.selisih))} dari seharusnya.`}
            </div>
          )}

          <div className="form-group mt-3">
            <label className="form-label">Catatan (opsional)</label>
            <input className="form-control" value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. ada kembalian ke pelanggan yang salah" />
          </div>

          <button className="btn btn-primary btn-block" style={{ padding: 13 }} onClick={simpan} disabled={saving}>
            {saving ? <><span className="spinner" /> Menyimpan...</> : <><Icon name="checkSquare" size={15} /> Simpan Tutup Kas</>}
          </button>
        </div>

        {/* ===== Kanan: rekap penjualan ===== */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Icon name="barChart" size={16} /> Penjualan {tanggal}</div></div>

          <div className="mt-3">
            <div className="text-sm font-bold mb-2">Rincian per Metode</div>
            {Object.keys(rekap.perMetode).length === 0 ? (
              <p className="text-muted text-sm">Belum ada transaksi pada tanggal ini.</p>
            ) : (
              Object.entries(rekap.perMetode).map(([m, v]) => (
                <div key={m} className="rk-row">
                  <span className="capitalize">{m}</span>
                  <b>{formatRupiah(v)}</b>
                </div>
              ))
            )}
            {rekap.nonCash > 0 && (
              <div className="rk-row sub"><span>Non-tunai (tidak masuk laci)</span><b className="text-muted">{formatRupiah(rekap.nonCash)}</b></div>
            )}
          </div>
        </div>
      </div>

      {/* Riwayat */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="fileText" size={16} /> Riwayat Tutup Kas</div>
          <span className="text-sm text-muted">{riwayat.length} catatan</span>
        </div>
        {loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={5} />
          </div>
        ) : riwayat.length === 0 ? (
          <EmptyBlock icon="fileText" title="Belum ada tutup kas"
            message="Lakukan tutup kas setiap akhir shift." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Tanggal</th><th className="text-right">Penjualan</th><th className="text-right">Trx</th><th className="text-right">Seharusnya</th><th className="text-right">Fisik</th><th className="text-right">Selisih</th><th>Kasir</th></tr>
              </thead>
              <tbody>
                {riwayat.map((r) => {
                  const s = Number(r.selisih || 0)
                  return (
                    <tr key={r.id}>
                      <td>{r.tanggal}</td>
                      <td className="text-right">{formatRupiah(r.penjualan_hari_ini)}</td>
                      <td className="text-right">{r.trx_hari_ini}</td>
                      <td className="text-right">{formatRupiah(r.saldo_sistem)}</td>
                      <td className="text-right font-bold">{formatRupiah(r.uang_fisik)}</td>
                      <td className="text-right font-bold">
                        <span className={`badge ${s === 0 ? 'badge-success' : s > 0 ? 'badge-neutral' : 'badge-danger'}`}>
                          {s === 0 ? ' Seimbang' : s > 0 ? `+${formatRupiah(s)}` : formatRupiah(s)}
                        </span>
                      </td>
                      <td className="text-muted text-xs">{r.user_email || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .rekap { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); }
        .rk-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .rk-row span { color: var(--muted); }
        .rk-row.sub { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px; font-weight: 600; }
      `}</style>
    </AppLayout>
  )
}