import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './AuthProvider'
import AppLayout from './AppLayout'
import Icon from './Icons'
import { StatCard, Sparkline, SkeletonStat, SkeletonRows, EmptyBlock, StockBar } from './DashboardWidgets'

const QUICK_ACCESS = [
  { icon: 'cart', title: 'POS Kasir', desc: 'Transaksi penjualan', href: '/pos' },
  { icon: 'box', title: 'Inventory', desc: 'Stok bahan & produk', href: '/inventory' },
  { icon: 'wallet', title: 'Cashflow', desc: 'Arus kas masuk & keluar', href: '/cashflow' },
  { icon: 'users', title: 'Pelanggan', desc: 'Database & loyalitas', href: '/customers' },
  { icon: 'trendingUp', title: 'Laporan', desc: 'Laba rugi & analisis', href: '/laporan' },
  { icon: 'fileText', title: 'Produk & HPP', desc: 'Kalkulasi harga pokok', href: '/produk-hpp' },
]

const rupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

// Ringkas untuk kartu: "Rp 1,2 jt" agar tidak memecah layout di HP
const rupiahShort = (v) => {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (Math.abs(n) >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`
  return `Rp ${n}`
}

const hariAwal = (offsetHari = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetHari)
  d.setHours(0, 0, 0, 0)
  return d
}

const waktuLalu = (iso) => {
  if (!iso) return ''
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (detik < 60) return 'baru saja'
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`
  const hari = Math.floor(detik / 86400)
  return hari === 1 ? 'kemarin' : `${hari} hari lalu`
}

const LABEL_AKSI = {
  tambah_transaksi: 'Transaksi baru',
  tambah_produk: 'Produk ditambahkan',
  tambah_piutang: 'Piutang dicatat',
  tambah_hutang: 'Hutang dicatat',
  tambah_cashflow: 'Cashflow dicatat',
  hapus_produk: 'Produk dihapus',
  hapus_transaksi: 'Transaksi dihapus',
  login: 'Masuk aplikasi',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setError('')
    setLoading(true)
    try {
      const awalHariIni = hariAwal(0)
      const awalKemarin = hariAwal(1)
      const tujuhHari = hariAwal(6)
      const tigaPuluhHari = hariAwal(29)

      const [trxRes, prodRes, custRes, cfRes, rpRes, auditRes, profileRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, id_transaksi, tanggal, total_bayar')
          .gte('tanggal', tigaPuluhHari.toISOString())
          .order('tanggal', { ascending: false })
          .limit(500),
        supabase.from('products').select('id, nama_produk, stok_produk, harga_jual, hpp_per_unit').limit(500),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase
          .from('cashflow')
          .select('jenis, jumlah, tanggal')
          .gte('tanggal', tigaPuluhHari.toISOString().slice(0, 10))
          .limit(500),
        supabase.from('receivables_payables').select('jenis, jumlah, status').eq('status', 'aktif').limit(500),
        supabase
          .from('audit_logs')
          .select('aksi, user_email, tanggal, detail_json')
          .order('tanggal', { ascending: false })
          .limit(6),
        supabase.from('users').select('role, nama').eq('id', user.id).maybeSingle(),
      ])

      // Kegagalan tiap bagian tidak boleh mematikan seluruh dashboard
      const transaksi = trxRes.error ? [] : trxRes.data || []
      const produk = prodRes.error ? [] : prodRes.data || []
      const cashflow = cfRes.error ? [] : cfRes.data || []
      const hutangPiutang = rpRes.error ? [] : rpRes.data || []
      const aktivitas = auditRes.error ? [] : auditRes.data || []

      const gagalSemua = trxRes.error && prodRes.error && custRes.error
      if (gagalSemua) throw trxRes.error

      // ---- Penjualan hari ini & kemarin ----
      const hariIni = transaksi.filter((t) => new Date(t.tanggal) >= awalHariIni)
      const kemarin = transaksi.filter((t) => {
        const d = new Date(t.tanggal)
        return d >= awalKemarin && d < awalHariIni
      })
      const omsetHariIni = hariIni.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
      const omsetKemarin = kemarin.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
      const deltaOmset = omsetKemarin > 0 ? ((omsetHariIni - omsetKemarin) / omsetKemarin) * 100 : null

      // ---- Deret 7 hari untuk grafik ----
      const seri7 = []
      for (let i = 6; i >= 0; i--) {
        const mulai = hariAwal(i)
        const sampai = hariAwal(i - 1)
        const total = transaksi
          .filter((t) => {
            const d = new Date(t.tanggal)
            return d >= mulai && d < sampai
          })
          .reduce((s, t) => s + Number(t.total_bayar || 0), 0)
        seri7.push(total)
      }
      const omset7Hari = seri7.reduce((s, v) => s + v, 0)

      // ---- Produk terlaris (7 hari) ----
      const idTrx7 = transaksi.filter((t) => new Date(t.tanggal) >= tujuhHari).map((t) => t.id)
      let terlaris = []
      if (idTrx7.length) {
        const { data: items } = await supabase
          .from('transaction_items')
          .select('produk_id, nama_produk, qty, subtotal')
          .in('transaksi_id', idTrx7.slice(0, 200))
        const peta = {}
        ;(items || []).forEach((it) => {
          const k = it.produk_id || it.nama_produk
          if (!k) return
          if (!peta[k]) peta[k] = { nama: it.nama_produk || 'Produk', qty: 0, omzet: 0 }
          peta[k].qty += Number(it.qty || 0)
          peta[k].omzet += Number(it.subtotal || 0)
        })
        terlaris = Object.values(peta)
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5)
      }

      // ---- Stok menipis ----
      const stokKritis = produk
        .filter((p) => Number(p.stok_produk || 0) <= 5)
        .sort((a, b) => Number(a.stok_produk || 0) - Number(b.stok_produk || 0))
        .slice(0, 5)

      // ---- Keuangan ----
      const kasHariIni = cashflow.filter((c) => new Date(c.tanggal) >= awalHariIni)
      const kasMasuk = kasHariIni.filter((c) => c.jenis === 'masuk').reduce((s, c) => s + Number(c.jumlah || 0), 0)
      const kasKeluar = kasHariIni.filter((c) => c.jenis === 'keluar').reduce((s, c) => s + Number(c.jumlah || 0), 0)
      const piutang = hutangPiutang.filter((r) => r.jenis === 'piutang').reduce((s, r) => s + Number(r.jumlah || 0), 0)
      const hutang = hutangPiutang.filter((r) => r.jenis === 'hutang').reduce((s, r) => s + Number(r.jumlah || 0), 0)

      setData({
        omsetHariIni,
        transaksiHariIni: hariIni.length,
        deltaOmset,
        seri7,
        omset7Hari,
        terlaris,
        stokKritis,
        jumlahProduk: produk.length,
        pelanggan: custRes.error ? 0 : custRes.count || 0,
        kasMasuk,
        kasKeluar,
        piutang,
        hutang,
        aktivitas,
      })
      setProfile(profileRes.error ? null : profileRes.data)
    } catch (err) {
      setError(err.message || 'Gagal memuat data dari Supabase')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const nama = profile?.nama || user?.email?.split('@')[0] || 'User'
  const role = profile?.role || 'user'
  const sapaan = useMemo(() => {
    const jam = new Date().getHours()
    if (jam < 11) return 'Selamat pagi'
    if (jam < 15) return 'Selamat siang'
    if (jam < 19) return 'Selamat sore'
    return 'Selamat malam'
  }, [])
  const tanggal = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const tombolRefresh = (
    <button className="btn btn-outline" onClick={fetchData} disabled={loading} aria-label="Muat ulang data">
      <Icon name="refresh" size={15} />
      <span className="hide-mobile">{loading ? 'Memuat...' : 'Muat Ulang'}</span>
    </button>
  )

  return (
    <AppLayout title="Dashboard" subtitle={tanggal} actions={tombolRefresh}>
      {/* Sapaan */}
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <div className="page-title">
            {sapaan}, {nama}
          </div>
          <div className="page-subtitle">
            Ringkasan bisnis Anda hari ini · <span className="badge badge-success capitalize">{role}</span>
          </div>
        </div>
        <Link href="/pos" className="btn btn-primary">
          <Icon name="plus" size={15} />
          Transaksi Baru
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <div>
            <strong>Gagal memuat data.</strong> {error}
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="metrics-grid">
        {loading || !data ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <StatCard
              label="Penjualan Hari Ini"
              value={rupiahShort(data.omsetHariIni)}
              icon="trendingUp"
              tone="primary"
              delta={data.deltaOmset}
              hint={`${data.transaksiHariIni} transaksi`}
            />
            <StatCard
              label="Omzet 7 Hari"
              value={rupiahShort(data.omset7Hari)}
              icon="barChart"
              hint="Total seminggu terakhir"
            />
            <StatCard
              label="Stok Menipis"
              value={data.stokKritis.length}
              icon="alert"
              tone={data.stokKritis.length > 0 ? 'warning' : ''}
              hint="Produk ≤ 5 unit"
            />
            <StatCard
              label="Pelanggan"
              value={data.pelanggan}
              icon="users"
              hint={`${data.jumlahProduk} produk aktif`}
            />
          </>
        )}
      </div>

      {/* Grafik + keuangan */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="trendingUp" size={16} />
              Tren Penjualan
            </div>
            <span className="badge badge-neutral">7 hari</span>
          </div>
          {loading || !data ? (
            <div className="skeleton" style={{ height: 90 }} aria-hidden="true" />
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="stat-value">{rupiah(data.omset7Hari)}</div>
                  <div className="stat-hint">Total 7 hari terakhir</div>
                </div>
              </div>
              <Sparkline
                values={data.seri7}
                ariaLabel={`Tren penjualan 7 hari, total ${rupiah(data.omset7Hari)}`}
              />
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>6 hari lalu</span>
                <span>Hari ini</span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="wallet" size={16} />
              Kas & Tagihan
            </div>
            <Link href="/cashflow" className="text-sm text-primary">
              Kelola
            </Link>
          </div>
          {loading || !data ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="list">
              <div className="list-item">
                <div className="list-icon" style={{ color: 'var(--success)' }}>
                  <Icon name="trendingUp" size={15} />
                </div>
                <div className="list-body">
                  <div className="list-title">Kas masuk hari ini</div>
                  <div className="list-meta">Pemasukan tercatat</div>
                </div>
                <div className="list-value" style={{ color: 'var(--success)' }}>
                  +{rupiahShort(data.kasMasuk)}
                </div>
              </div>
              <div className="list-item">
                <div className="list-icon" style={{ color: 'var(--danger)' }}>
                  <Icon name="trendingDown" size={15} />
                </div>
                <div className="list-body">
                  <div className="list-title">Kas keluar hari ini</div>
                  <div className="list-meta">Pengeluaran tercatat</div>
                </div>
                <div className="list-value" style={{ color: 'var(--danger)' }}>
                  -{rupiahShort(data.kasKeluar)}
                </div>
              </div>
              <div className="list-item">
                <div className="list-icon">
                  <Icon name="banknote" size={15} />
                </div>
                <div className="list-body">
                  <div className="list-title">Piutang aktif</div>
                  <div className="list-meta">Belum dibayar pelanggan</div>
                </div>
                <div className="list-value">{rupiahShort(data.piutang)}</div>
              </div>
              <div className="list-item">
                <div className="list-icon">
                  <Icon name="receipt" size={15} />
                </div>
                <div className="list-body">
                  <div className="list-title">Hutang aktif</div>
                  <div className="list-meta">Kewajiban ke supplier</div>
                </div>
                <div className="list-value">{rupiahShort(data.hutang)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Produk terlaris + stok menipis */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="barChart" size={16} />
              Produk Terlaris
            </div>
            <span className="badge badge-neutral">7 hari</span>
          </div>
          {loading || !data ? (
            <SkeletonRows rows={4} />
          ) : data.terlaris.length === 0 ? (
            <EmptyBlock
              icon="box"
              title="Belum ada penjualan"
              message="Data terlaris muncul setelah ada transaksi minggu ini."
            />
          ) : (
            <div className="list">
              {data.terlaris.map((p, i) => (
                <div className="list-item" key={`${p.nama}-${i}`}>
                  <span className="rank">{i + 1}</span>
                  <div className="list-body">
                    <div className="list-title">{p.nama}</div>
                    <div className="list-meta">{p.qty} terjual</div>
                  </div>
                  <div className="list-value">{rupiahShort(p.omzet)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Icon name="alert" size={16} />
              Stok Menipis
            </div>
            <Link href="/inventory/stok" className="text-sm text-primary">
              Lihat stok
            </Link>
          </div>
          {loading || !data ? (
            <SkeletonRows rows={4} />
          ) : data.stokKritis.length === 0 ? (
            <EmptyBlock
              icon="checkSquare"
              title="Stok aman"
              message="Tidak ada produk di bawah batas minimum. Kerja bagus!"
            />
          ) : (
            <div className="list">
              {data.stokKritis.map((p) => (
                <div className="list-item" key={p.id}>
                  <div className="list-body">
                    <div className="list-title">{p.nama_produk || 'Tanpa nama'}</div>
                    <div className="list-meta">Sisa {Number(p.stok_produk || 0)} unit</div>
                    <StockBar value={p.stok_produk} />
                  </div>
                  <span
                    className={`badge ${
                      Number(p.stok_produk || 0) <= 0 ? 'badge-danger' : 'badge-warning'
                    }`}
                  >
                    {Number(p.stok_produk || 0) <= 0 ? 'Habis' : 'Rendah'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Akses cepat */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Icon name="orbit" size={16} />
            Akses Cepat
          </div>
        </div>
        <div className="grid-3">
          {QUICK_ACCESS.map((item) => (
            <Link key={item.href} href={item.href} className="quick-card">
              <div className="quick-icon">
                <Icon name={item.icon} size={19} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="quick-title">{item.title}</div>
                <div className="text-sm text-muted">{item.desc}</div>
              </div>
              <Icon name="chevronRight" size={15} className="quick-arrow" />
            </Link>
          ))}
        </div>
      </div>

      {/* Aktivitas terbaru */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Icon name="pulse" size={16} />
            Aktivitas Terbaru
          </div>
          <Link href="/audit" className="text-sm text-primary">
            Lihat semua
          </Link>
        </div>
        {loading || !data ? (
          <SkeletonRows rows={4} />
        ) : data.aktivitas.length === 0 ? (
          <EmptyBlock
            icon="inbox"
            title="Belum ada aktivitas"
            message="Riwayat akan tercatat otomatis saat Anda mulai bekerja."
            action={
              <Link href="/pos" className="btn btn-primary mt-3">
                Mulai Transaksi
              </Link>
            }
          />
        ) : (
          <div className="list">
            {data.aktivitas.map((a, i) => (
              <div className="list-item" key={i}>
                <div className="list-icon">
                  <Icon name="pulse" size={15} />
                </div>
                <div className="list-body">
                  <div className="list-title">{LABEL_AKSI[a.aksi] || a.aksi || 'Aktivitas'}</div>
                  <div className="list-meta">
                    {a.user_email || 'sistem'} · {waktuLalu(a.tanggal)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .quick-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--card);
          transition: border-color 0.12s, background 0.12s;
        }
        .quick-card:hover {
          border-color: var(--primary);
          background: var(--primary-light);
        }
        .quick-icon {
          width: 38px;
          height: 38px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--card-alt);
          border: 1px solid var(--border);
          color: var(--primary);
          flex-shrink: 0;
        }
        .quick-title {
          font-weight: 500;
          font-size: var(--fs-base);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .quick-card :global(.quick-arrow) {
          margin-left: auto;
          color: var(--muted);
          opacity: 0;
          transition: opacity 0.12s, transform 0.12s;
        }
        .quick-card:hover :global(.quick-arrow) {
          opacity: 1;
        }
      `}</style>
    </AppLayout>
  )
}
