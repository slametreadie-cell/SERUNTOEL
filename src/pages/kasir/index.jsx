import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'
import { kirimWADanCatat } from '../../utils/wa'
import { teksStrukWA } from '../../utils/strukWA'
import { cetakStruk } from '../../utils/struk'
import Icon from '../../components/Icons'
import { StatCard, SkeletonStat, SkeletonRows, EmptyBlock } from '../../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (v) => new Date(v).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

const hariIni = () => new Date().toISOString().slice(0, 10)

const METODE_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', ewallet: 'E-Wallet' }

export default function Kasir() {
  const { user } = useAuth()
  const [transaksi, setTransaksi] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toko, setToko] = useState({})
  const [kontakMap, setKontakMap] = useState({})

  const [dari, setDari] = useState(hariIni())
  const [sampai, setSampai] = useState(hariIni())
  const [metodeFilter, setMetodeFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    if (!dari || !sampai) return
    setLoading(true); setError('')
    try {
      const gte = `${dari}T00:00:00`
      const lte = `${sampai}T23:59:59`
      const { data: trx, error: e1 } = await supabase
        .from('transactions').select('*')
        .gte('tanggal', gte).lte('tanggal', lte)
        .order('tanggal', { ascending: false })
      if (e1) throw e1

      const ids = (trx || []).map((t) => t.id)
      let items = []
      if (ids.length) {
        const { data: it } = await supabase.from('transaction_items').select('*').in('transaksi_id', ids)
        items = it || []
      }
      setTransaksi((trx || []).map((t) => ({ ...t, items: items.filter((i) => i.transaksi_id === t.id) })))

      const custIds = (trx || []).map((t) => t.customer_id).filter(Boolean)
      let kontakMap = {}
      if (custIds.length) {
        const unique = [...new Set(custIds)]
        const { data: custs } = await supabase.from('customers').select('id, kontak').in('id', unique)
        ;(custs || []).forEach((c) => { if (c.kontak) kontakMap[c.id] = c.kontak })
      }
      setKontakMap(kontakMap)

      const { data: cfg } = await supabase.from('configuration').select('key, value')
      const cm = {}
      ;(cfg || []).forEach((c) => { cm[c.key] = c.value })
      setToko(cm)
    } catch (e) {
      setError(e.message)
      setTransaksi([])
    }
    setLoading(false)
  }, [dari, sampai])

  useEffect(() => { fetchData() }, [fetchData])

  const cetak = (t) => {
  cetakStruk({
    ...t,
    nama_toko: toko.nama_toko, alamat_toko: toko.alamat_toko,
    telepon_toko: toko.telepon_toko, footer_struk: toko.footer_struk,
  })
}

const kirimWA = async (t) => {
  if (!t.customer_id || !kontakMap[t.customer_id]) {
    alert('Pelanggan ini tidak punya nomor WA — tambahkan di halaman Pelanggan dulu.')
    return
  }
  const nomor = kontakMap[t.customer_id]
  const pesan = teksStrukWA({
    ...t,
    nama_toko: toko.nama_toko, alamat_toko: toko.alamat_toko,
    telepon_toko: toko.telepon_toko, footer_struk: toko.footer_struk,
  })
  const r = await kirimWADanCatat({ nomor, pesan, id_transaksi: t.id_transaksi, customer_id: t.customer_id, jenis: 'struk' })
  if (r.ok) alert('Struk terkirim ke WA')
  else alert('Gagal kirim WA: ' + (r.error || 'Tidak diketahui'))
}

  const filtered = transaksi.filter((t) => {
    const okM = !metodeFilter || t.metode_pembayaran === metodeFilter
    const okC = !channelFilter || t.channel === channelFilter
    const hay = `${t.id_transaksi || ''} ${t.customer || ''} ${t.voucher_kode || ''}`.toLowerCase()
    const okS = !search || hay.includes(search.toLowerCase())
    return okM && okC && okS
  })

  const stat = useMemo(() => {
    const omzet = filtered.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const diskon = filtered.reduce((s, t) => s + Number(t.diskon || 0) + Number(t.diskon_voucher || 0), 0)
    const cash = filtered.filter((t) => t.metode_pembayaran === 'cash').reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    return { omzet, diskon, cash, nonCash: omzet - cash, jumlah: filtered.length }
  }, [filtered])

  return (
    <AppLayout
      title="Riwayat Transaksi"
      subtitle="Cari transaksi & cetak ulang struk"
      actions={<Link href="/kasir/tutup" className="btn btn-outline btn-sm"><Icon name="lock" size={13} /> Tutup Kas</Link>}
    >
      {error && <div className="alert alert-danger"><Icon name="alert" size={16} /> {error}</div>}

      {loading ? (
        <>
          <div className="metrics-grid">
            <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
          </div>
          <div className="card">
            <SkeletonRows rows={6} />
          </div>
        </>
      ) : (
        <>
          <div className="metrics-grid">
            <StatCard label="Total Omset" value={formatRupiah(stat.omzet)} icon="trendingUp"
              tone="primary" hint={`${stat.jumlah} transaksi`} />
            <StatCard label="Transaksi" value={stat.jumlah} icon="receipt"
              hint="periode terpilih" />
            <StatCard label="Tunai" value={formatRupiah(stat.cash)} icon="banknote"
              tone="primary" hint="uang di laci" />
            <StatCard label="Non-Tunai" value={formatRupiah(stat.nonCash)} icon="wallet"
              hint="QRIS, transfer, e-wallet" />
            <StatCard label="Total Diskon" value={formatRupiah(stat.diskon)} icon="ticket"
              tone="danger" hint="diskon + voucher" />
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="flex flex-wrap items-center gap-2">
              <input className="form-control" type="date" style={{ maxWidth: 165 }} value={dari} onChange={(e) => setDari(e.target.value)} />
              <span className="text-muted text-sm">s/d</span>
              <input className="form-control" type="date" style={{ maxWidth: 165 }} value={sampai} onChange={(e) => setSampai(e.target.value)} />
              <select className="form-control" style={{ maxWidth: 150 }} value={metodeFilter} onChange={(e) => setMetodeFilter(e.target.value)}>
                <option value="">Semua Metode</option>
                <option value="cash">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer</option>
                <option value="ewallet">E-Wallet</option>
              </select>
              <select className="form-control" style={{ maxWidth: 140 }} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                <option value="">Semua Channel</option>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="reseller">Reseller</option>
              </select>
              <input className="form-control" style={{ maxWidth: 200 }} placeholder="No. trx / pelanggan"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn btn-outline btn-sm" onClick={fetchData}><Icon name="refresh" size={13} /> Muat Ulang</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ padding: 16 }}>
              <div className="card-title"><Icon name="receipt" size={16} /> Daftar Transaksi</div>
              <span className="text-sm text-muted">{filtered.length} transaksi</span>
            </div>

            {filtered.length === 0 ? (
              <EmptyBlock icon="receipt" title="Tidak ada transaksi"
                message="Coba ubah rentang tanggal atau filter." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Waktu</th><th>No. Transaksi</th><th>Pelanggan</th><th>Metode</th><th>Channel</th><th className="text-right">Item</th><th className="text-right">Diskon</th><th className="text-right">Total</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const diskonTotal = Number(t.diskon || 0) + Number(t.diskon_voucher || 0)
                      return (
                        <tr key={t.id}>
                          <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{tglID(t.tanggal)}</td>
                          <td>
                            <div className="font-bold" style={{ fontSize: 12 }}>{t.id_transaksi}</div>
                            {t.voucher_kode && <div className="text-xs text-muted"><Icon name="ticket" size={11} /> {t.voucher_kode}</div>}
                          </td>
                          <td>
                          <div>{t.customer || '—'}</div>
                          {(t.customer_id && kontakMap[t.customer_id]) && (
                            <div className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                              <Icon name="phone" size={10} /> {kontakMap[t.customer_id]}
                            </div>
                          )}
                        </td>
                          <td><span className="badge badge-neutral">{METODE_LABEL[t.metode_pembayaran] || t.metode_pembayaran}</span></td>
                          <td><span className={`badge ${t.channel === 'reseller' ? 'badge-warning' : t.channel === 'online' ? 'badge-info' : 'badge-success'}`}>{t.channel || 'offline'}</span></td>
                          <td className="text-right">{t.items?.length || 0}</td>
                          <td className="text-right text-danger">{diskonTotal > 0 ? `−${formatRupiah(diskonTotal)}` : '—'}</td>
                          <td className="text-right font-bold text-primary">{formatRupiah(t.total_bayar)}</td>
                          <td className="text-right">
                            <button className="btn btn-sm btn-outline" onClick={() => cetak(t)}><Icon name="receipt" size={13} /></button>
                            {t.customer_id && kontakMap[t.customer_id] && (
                              <button className="btn btn-sm btn-outline ml-1" onClick={() => kirimWA(t)}><Icon name="send" size={13} /></button>
                            )}
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
    </AppLayout>
  )
}