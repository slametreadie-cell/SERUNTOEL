import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import { logAudit } from '../utils/audit'
import { cetakStruk } from '../utils/struk'
import {
  parseLoyaltyConfig, TIER_DEFAULT, TIER_EMOJI,
  hitungPoin, nilaiPoin, tierDari,
} from '../utils/loyalty'
import Icon from '../components/Icons'
import { SkeletonRows, EmptyBlock } from '../components/DashboardWidgets'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const METODE = [
  { key: 'cash', label: 'Tunai', icon: 'banknote' },
  { key: 'qris', label: 'QRIS', icon: 'pulse' },
  { key: 'transfer', label: 'Transfer', icon: 'trendingUp' },
  { key: 'ewallet', label: 'E-Wallet', icon: 'wallet' },
]

const CHANNEL = [
  { k: 'offline', l: 'Offline', icon: 'dashboard' },
  { k: 'online', l: 'Online', icon: 'orbit' },
  { k: 'reseller', l: 'Reseller', icon: 'handshake' },
]

export default function POS() {
  const { user } = useAuth()
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('')

  // Master data
  const [loyalty, setLoyalty] = useState(parseLoyaltyConfig([]))
  const [tiers, setTiers] = useState(TIER_DEFAULT)
  const [diskonReseller, setDiskonReseller] = useState(10)
  const [toko, setToko] = useState({})

  // Keranjang
  const [cart, setCart] = useState([])
  const [metode, setMetode] = useState('cash')
  const [nominalBayar, setNominalBayar] = useState('')
  const [customer, setCustomer] = useState('')
  const [channel, setChannel] = useState('offline')
  const [saving, setSaving] = useState(false)
  const [sukses, setSukses] = useState(null)

  // Diskon manual
  const [diskonMode, setDiskonMode] = useState('none')
  const [diskonInput, setDiskonInput] = useState('')

  // Voucher
  const [voucherInput, setVoucherInput] = useState('')
  const [voucher, setVoucher] = useState(null)
  const [voucherMsg, setVoucherMsg] = useState('')
  const [cekPod, setCekPod] = useState(false)

  // Member / loyalitas
  const [memberQuery, setMemberQuery] = useState('')
  const [member, setMember] = useState(null)
  const [memberMsg, setMemberMsg] = useState('')
  const [poinPakai, setPoinPakai] = useState('')

  // Telepon pelanggan (WA blast)
  const [telp, setTelp] = useState('')
  const [suggest, setSuggest] = useState([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)

  // Auto-suggest pelanggan dari tabel customers (nama / kontak)
  const cariPelanggan = useCallback(async (q) => {
    const query = (q || '').trim()
    if (query.length < 2) { setSuggest([]); setSuggestOpen(false); return }
    setSuggestLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('id, nama, kontak')
      .or(`nama.ilike.%${query}%,kontak.ilike.%${query}%`)
      .order('total_belanja', { ascending: false })
      .limit(6)
    if (data && data.length) {
      setSuggest(data)
      setSuggestOpen(true)
    } else {
      setSuggest([])
      setSuggestOpen(false)
    }
    setSuggestLoading(false)
  }, [])


  const fetchProduk = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('nama_produk')
    if (error) setError(error.message)
    else setProduk(data || [])
    setLoading(false)
  }, [])

  const fetchMaster = useCallback(async () => {
    const [loy, tier, conf] = await Promise.all([
      supabase.from('loyalty_config').select('*'),
      supabase.from('tier_config').select('*'),
      supabase.from('configuration').select('key, value'),
    ])
    setLoyalty(parseLoyaltyConfig(loy.data || []))
    if (tier.data && tier.data.length) setTiers(tier.data)
    const cm = {}
    ;(conf.data || []).forEach((c) => { cm[c.key] = c.value })
    setToko(cm)
    const dr = Number(cm.diskon_reseller)
    setDiskonReseller(Number.isFinite(dr) && dr > 0 ? dr : 10)
  }, [])

  useEffect(() => { fetchProduk(); fetchMaster() }, [fetchProduk, fetchMaster])

  const kategoriList = useMemo(() => {
    const s = new Set(produk.map((p) => p.kategori).filter(Boolean))
    return [...s].sort()
  }, [produk])

  const produkFiltered = produk.filter((p) => {
    const matchSearch = !search || (p.nama_produk || '').toLowerCase().includes(search.toLowerCase())
    const matchKat = !kategori || p.kategori === kategori
    return matchSearch && matchKat
  })

  // ===== Keranjang =====
  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id)
      if (existing) {
        if (existing.qty + 1 > (p.stok_produk || 0)) {
          alert(`Stok ${p.nama_produk} tidak cukup (sisa ${p.stok_produk})`)
          return prev
        }
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
      }
      if ((p.stok_produk || 0) < 1) {
        alert(`Stok ${p.nama_produk} habis!`)
        return prev
      }
      return [...prev, {
        id: p.id, nama: p.nama_produk, harga: Number(p.harga_jual) || 0,
        qty: 1, stok: p.stok_produk, foto: p.foto_url, hpp: Number(p.hpp_per_unit) || 0,
      }]
    })
  }

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const newQty = i.qty + delta
        if (newQty < 1) return i
        if (newQty > i.stok) { alert(`Stok maksimal ${i.stok}`); return i }
        return { ...i, qty: newQty }
      })
    )
  }

  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.id !== id))

  const resetCart = () => {
    setCart([])
    setNominalBayar('')
    setCustomer('')
    setMetode('cash')
    setChannel('offline')
    setDiskonMode('none')
    setDiskonInput('')
    setVoucher(null)
    setVoucherInput('')
    setVoucherMsg('')
    setMember(null)
    setMemberQuery('')
    setMemberMsg('')
    setPoinPakai('')
    setTelp('')
    setSuggest([])
    setSuggestOpen(false)
  }

  // ===== Perhitungan =====
  const subtotalNormal = cart.reduce((s, i) => s + i.harga * i.qty, 0)
  const diskonResellerRp = channel === 'reseller' ? Math.round(subtotalNormal * diskonReseller / 100) : 0
  const subtotal = Math.max(0, subtotalNormal - diskonResellerRp)

  // Diskon manual
  const diskonManual = diskonMode === 'persen'
    ? Math.round(subtotal * (Number(diskonInput) || 0) / 100)
    : diskonMode === 'nominal' ? Math.min(subtotal, Number(diskonInput) || 0) : 0

  const setelahDiskon = Math.max(0, subtotal - diskonManual)

  // Voucher
  const diskonVoucher = useMemo(() => {
    if (!voucher) return 0
    if (voucher.tipe === 'persen') return Math.round(setelahDiskon * (Number(voucher.nilai) || 0) / 100)
    return Math.min(setelahDiskon, Number(voucher.nilai) || 0)
  }, [voucher, setelahDiskon])

  const setelahVoucher = Math.max(0, setelahDiskon - diskonVoucher)

  // Poin
  const maxPoin = loyalty.nilai_poin > 0 ? Math.floor(setelahVoucher / loyalty.nilai_poin) : 0
  const bolehTukar = member && loyalty.aktif && (member.poin || 0) >= loyalty.min_tukar && maxPoin > 0
  const poinDipakai = bolehTukar ? Math.min(Number(poinPakai) || 0, member.poin || 0, maxPoin) : 0
  const diskonPoin = nilaiPoin(poinDipakai, loyalty.nilai_poin)

  const total = Math.max(0, setelahVoucher - diskonPoin)
  const kembalian = Math.max(0, (Number(nominalBayar) || 0) - total)
  const poinDidapat = loyalty.aktif && member ? hitungPoin(total, loyalty.poin_per_rupiah) : 0

  const diskonTierRp = diskonResellerRp + diskonPoin

  // ===== Aksi =====
  const cekVoucher = async () => {
    const kode = (voucherInput || '').trim().toUpperCase()
    if (!kode) { setVoucherMsg('Masukkan kode voucher dulu'); return }
    setCekPod(true); setVoucherMsg('')
    try {
      const { data, error } = await supabase
        .from('vouchers').select('*').ilike('kode', kode).eq('aktif', true).limit(1).maybeSingle()
      if (error) throw error
      if (!data) { setVoucher(null); setVoucherMsg(' Voucher tidak ditemukan / tidak aktif'); return }

      const today = new Date().toISOString().slice(0, 10)
      if (data.tanggal_mulai && today < data.tanggal_mulai) {
        setVoucher(null); setVoucherMsg(` Voucher berlaku mulai ${data.tanggal_mulai}`); return
      }
      if (data.tanggal_berakhir && today > data.tanggal_berakhir) {
        setVoucher(null); setVoucherMsg(' Voucher sudah kedaluwarsa'); return
      }
      setVoucher(data)
      setVoucherMsg(` Voucher aktif: ${data.tipe === 'persen' ? `${data.nilai}%` : formatRupiah(data.nilai)}`)
    } catch (e) {
      setVoucherMsg(' ' + e.message)
    } finally {
      setCekPod(false)
    }
  }

  const cariMember = async () => {
    const q = (memberQuery || '').trim()
    if (!q) { setMemberMsg('Masukkan nama atau kontak'); return }
    setMemberMsg('')
    const { data } = await supabase
      .from('loyalty_members').select('*')
      .or(`nama.ilike.%${q}%,kontak.ilike.%${q}%`)
      .order('total_belanja', { ascending: false }).limit(1).maybeSingle()
    if (!data) {
      setMember(null)
      setMemberMsg('Member belum terdaftar — akan otomatis dibuat saat bayar.')
      if (!customer) setCustomer(q)
      return
    }
    setMember(data)
    setCustomer(data.nama)
    setPoinPakai('')
    setMemberMsg(` ${data.nama} — ${data.poin} poin (${TIER_EMOJI[data.tier] || ''} ${data.tier})`)
  }

  const buatMemberBaru = async () => {
    const nama = (customer || memberQuery || '').trim()
    if (!nama) { setMemberMsg('Isi nama pelanggan dulu'); return }
    const { data, error } = await supabase
      .from('loyalty_members')
      .insert({ nama, kontak: null, poin: 0, tier: 'bronze', total_transaksi: 0, total_belanja: 0 })
      .select().single()
    if (error) { setMemberMsg(' ' + error.message); return }
    setMember(data)
    setMemberMsg(` Member baru: ${data.nama}`)
  }

  // ===== Checkout =====
  const handleCheckout = async () => {
    if (cart.length === 0) { alert('Keranjang masih kosong'); return }
    if (metode === 'cash' && (Number(nominalBayar) || 0) < total) {
      alert('Nominal bayar kurang dari total!'); return
    }
    setSaving(true)
    setError('')

    try {
      const idTransaksi = 'TRX-' + Date.now().toString().slice(-10) + '-' + Math.floor(Math.random() * 1000)
      const itemsPayload = cart.map((i) => ({
        produk_id: i.id,
        nama_produk: i.nama,
        qty: i.qty,
        harga_satuan: i.harga,
        hpp_satuan: i.hpp,
        subtotal: i.harga * i.qty,
      }))

      const namaCustomer = (customer || member?.nama || '').trim()
      const kontakCustomer = (telp || '').trim() || null

      // 0. Pelanggan
      let customerId = member?.customer_id || null
      if (namaCustomer && !customerId) {
        try {
          const { data: existing } = await supabase
            .from('customers').select('id, total_transaksi, total_belanja')
            .ilike('nama', namaCustomer).limit(1).maybeSingle()
          if (existing) {
            await supabase.from('customers').update({
              total_transaksi: (existing.total_transaksi || 0) + 1,
              total_belanja: Number(existing.total_belanja || 0) + total,
              last_order: new Date().toISOString(),
              ...(kontakCustomer && !existing.kontak ? { kontak: kontakCustomer } : {}),
            }).eq('id', existing.id)
            customerId = existing.id
          } else {
            const { data: baru } = await supabase.from('customers').insert({
              nama: namaCustomer, kontak: kontakCustomer, channel, total_transaksi: 1,
              total_belanja: total, last_order: new Date().toISOString(),
            }).select('id').single()
            customerId = baru?.id || null
          }
        } catch (e) { customerId = customerId || null }
      }

      // 1. Transaksi
      const { data: trx, error: trxErr } = await supabase
        .from('transactions')
        .insert({
          id_transaksi: idTransaksi,
          total_bayar: total,
          channel,
          metode_pembayaran: metode,
          diskon: diskonManual + diskonTierRp,
          nominal_bayar: metode === 'cash' ? Number(nominalBayar) || 0 : total,
          kembalian: metode === 'cash' ? kembalian : 0,
          customer: namaCustomer || null,
          customer_id: customerId,
          voucher_kode: voucher?.kode || null,
          diskon_voucher: diskonVoucher,
          user_id: user?.id,
        })
        .select('id').single()
      if (trxErr) throw trxErr

      // 2. Item
      const { error: itemsErr } = await supabase
        .from('transaction_items')
        .insert(itemsPayload.map((i) => ({ ...i, transaksi_id: trx.id })))
      if (itemsErr) throw itemsErr

      // 3. Stok
      for (const i of cart) {
        const { data: prod } = await supabase.from('products').select('stok_produk').eq('id', i.id).single()
        const stokBaru = Math.max(0, (prod?.stok_produk || 0) - i.qty)
        await supabase.from('products').update({ stok_produk: stokBaru }).eq('id', i.id)
      }

      // 4. Voucher usage
      if (voucher) {
        await supabase.from('voucher_usages').insert({
          voucher_id: voucher.id, kode_voucher: voucher.kode, transaksi_id: trx.id,
          customer_id: customerId, customer: namaCustomer || null, diskon: diskonVoucher,
        })
        await supabase.from('vouchers')
          .update({ total_dipakai: (voucher.total_dipakai || 0) + 1 }).eq('id', voucher.id)
      }

      // 5. Loyalitas
      let totalPoinBaru = member?.poin || 0
      if (loyalty.aktif && namaCustomer) {
        let m = member
        if (!m) {
          const { data: found } = await supabase
            .from('loyalty_members').select('*').ilike('nama', namaCustomer).limit(1).maybeSingle()
          m = found
        }
        const totalBelanjaBaru = Number(m?.total_belanja || 0) + total
        const poinBaru = Math.max(0, (m?.poin || 0) - poinDipakai) + poinDidapat
        const tierBaru = tierDari(totalBelanjaBaru, tiers)

        if (m) {
          await supabase.from('loyalty_members').update({
            poin: poinBaru, tier: tierBaru,
            total_transaksi: (m.total_transaksi || 0) + 1,
            total_belanja: totalBelanjaBaru,
            customer_id: customerId, last_visit: new Date().toISOString(),
          }).eq('id', m.id)
          totalPoinBaru = poinBaru
          if (poinDipakai > 0) {
            await supabase.from('loyalty_history').insert({
              member_id: m.id, jenis: 'tukar', poin: poinDipakai,
              keterangan: `Tukar poin di ${idTransaksi}`,
            })
          }
          if (poinDidapat > 0) {
            await supabase.from('loyalty_history').insert({
              member_id: m.id, jenis: 'tambah', poin: poinDidapat,
              keterangan: `Belanja ${idTransaksi}`,
            })
          }
        } else {
          const { data: nm } = await supabase.from('loyalty_members').insert({
            nama: namaCustomer, customer_id: customerId, poin: poinDidapat, tier: 'bronze',
            total_transaksi: 1, total_belanja: total, last_visit: new Date().toISOString(),
          }).select().single()
          totalPoinBaru = poinDidapat
          if (nm && poinDidapat > 0) {
            await supabase.from('loyalty_history').insert({
              member_id: nm.id, jenis: 'tambah', poin: poinDidapat, keterangan: `Belanja ${idTransaksi}`,
            })
          }
        }
      }

      logAudit({
        aksi: 'transaksi', user, sheetTarget: 'transactions',
        detail: {
          id_transaksi: idTransaksi, total, metode, channel, items: cart.length,
          customer: namaCustomer || null, voucher: voucher?.kode || null,
          diskon: diskonManual + diskonTierRp, diskon_voucher: diskonVoucher,
          poin_ditukar: poinDipakai, poin_didapat: poinDidapat,
        },
      })

      setSukses({
        id: idTransaksi, total, kembalian, metode, channel,
        items: itemsPayload, customer: namaCustomer,
        diskon: diskonManual + diskonTierRp, diskon_voucher: diskonVoucher,
        voucher_kode: voucher?.kode || null,
        poin_didapat: poinDidapat, poin_ditukar: poinDipakai, total_poin: totalPoinBaru,
        nominal_bayar: metode === 'cash' ? Number(nominalBayar) || 0 : total,
        tanggal: new Date().toISOString(),
      })
      resetCart()
      fetchProduk()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan transaksi')
    } finally {
      setSaving(false)
    }
  }

  const cetak = (s) => cetakStruk({
    ...s,
    nama_toko: toko.nama_toko, alamat_toko: toko.alamat_toko,
    telepon_toko: toko.telepon_toko, footer_struk: toko.footer_struk,
  })

  return (
    <AppLayout
      title="POS Kasir"
      subtitle="Transaksi penjualan cepat"
      actions={
        <Link href="/kasir/tutup" className="btn btn-outline btn-sm">
          <Icon name="lock" size={15} />
          <span className="hide-mobile">Tutup Kas</span>
        </Link>
      }
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </div>
      )}

      {/* Notifikasi sukses */}
      {sukses && (
        <div className="alert alert-success" style={{ position: 'sticky', top: 70, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex-1">
            <b className="flex items-center gap-2">
              <Icon name="checkSquare" size={16} /> Transaksi berhasil!
            </b>
            <span className="text-sm">{sukses.id}</span>
            {sukses.poin_didapat > 0 && <><br /><span className="text-sm">Poin +{sukses.poin_didapat} (total {sukses.total_poin})</span></>}
          </div>
          <div className="text-right">
            <div className="font-extrabold">{formatRupiah(sukses.total)}</div>
            {sukses.metode === 'cash' && <div className="text-sm">Kembalian: {formatRupiah(sukses.kembalian)}</div>}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary" onClick={() => cetak(sukses)} aria-label="Cetak struk">
              <Icon name="receipt" size={14} />
              <span className="hide-mobile">Struk</span>
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setSukses(null)} aria-label="Tutup notifikasi">
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="pos-layout">
        {/* ===== KIRI: Katalog ===== */}
        <div className="card pos-katalog" style={{ padding: 16 }}>
          <div className="flex gap-2 mb-3">
            <div className="search-wrap">
              <Icon name="search" size={15} className="search-icon" />
              <input className="form-control" placeholder="Cari produk..." value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Cari produk" />
            </div>
            <select className="form-control" style={{ maxWidth: 160 }} value={kategori} onChange={(e) => setKategori(e.target.value)}>
              <option value="">Semua</option>
              {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="pos-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} aria-hidden="true">
                  <div className="skeleton" style={{ height: 80, borderRadius: 6 }} />
                  <div className="skeleton skeleton-text" style={{ width: '75%', marginTop: 8 }} />
                  <div className="skeleton skeleton-text" style={{ width: '45%' }} />
                </div>
              ))}
            </div>
          ) : produkFiltered.length === 0 ? (
            <EmptyBlock
              icon="box"
              title={search || kategori ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              message={
                search || kategori
                  ? 'Coba kata kunci lain atau ganti kategori.'
                  : 'Tambahkan produk di menu Produk & HPP dulu.'
              }
            />
          ) : (
            <div className="pos-grid">
              {produkFiltered.map((p) => {
                const habis = (p.stok_produk || 0) < 1
                return (
                  <button key={p.id} className={`pos-produk ${habis ? 'pos-habis' : ''}`} onClick={() => addToCart(p)} disabled={habis}>
                    <div className="pos-produk-img">
                      {p.foto_url ? (
                        <img src={p.foto_url} alt="" loading="lazy" />
                      ) : (
                        <Icon name="box" size={26} />
                      )}
                    </div>
                    <div className="pos-produk-info">
                      <div className="pos-produk-nama">{p.nama_produk}</div>
                      <div className="pos-produk-harga">{formatRupiah(p.harga_jual)}</div>
                      <div className={`text-xs ${habis ? 'text-danger' : 'text-muted'}`}>{habis ? 'Habis' : `Stok ${p.stok_produk}`}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ===== KANAN: Keranjang & Pembayaran ===== */}
        <div className="card pos-keranjang" style={{ padding: 16 }}>
          <div className="card-title mb-3">
            <Icon name="cart" size={16} /> Keranjang ({cart.length})
          </div>

          {/* Channel penjualan */}
          <div className="form-group">
            <label className="form-label">Channel</label>
            <div className="channel-grid">
              {CHANNEL.map((c) => (
                <button key={c.k} type="button" className={`metode-btn ${channel === c.k ? 'active' : ''}`}
                  onClick={() => setChannel(c.k)} aria-pressed={channel === c.k}>
                  <Icon name={c.icon} size={14} />
                  {c.k === 'reseller' ? `Reseller -${diskonReseller}%` : c.l}
                </button>
              ))}
            </div>
          </div>

          {cart.length === 0 ? (
            <EmptyBlock icon="cart" title="Keranjang kosong" message="Klik produk di kiri untuk menambahkan." />
          ) : (
            <div className="cart-list">
              {cart.map((i) => (
                <div key={i.id} className="cart-item">
                  <div className="cart-item-info">
                    <div className="font-bold" style={{ fontSize: 13 }}>{i.nama}</div>
                    <div className="text-sm text-muted">{formatRupiah(i.harga)} × {i.qty}</div>
                  </div>
                  <div className="cart-item-actions">
                    <button className="qty-btn" onClick={() => updateQty(i.id, -1)} aria-label={`Kurangi ${i.nama}`}>−</button>
                    <span className="font-bold">{i.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(i.id, 1)} aria-label={`Tambah ${i.nama}`}>+</button>
                    <button className="qty-btn qty-del" onClick={() => removeItem(i.id)} aria-label={`Hapus ${i.nama}`}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  <div className="font-bold text-primary" style={{ fontSize: 13 }}>{formatRupiah(i.harga * i.qty)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ===== Diskon manual ===== */}
          <div className="form-group mt-3">
            <label className="form-label">Diskon</label>
            <div className="diskon-row">
              <select className="form-control" style={{ maxWidth: 120 }} value={diskonMode} onChange={(e) => { setDiskonMode(e.target.value); setDiskonInput('') }}>
                <option value="none">Tanpa</option>
                <option value="persen">Persen %</option>
                <option value="nominal">Nominal Rp</option>
              </select>
              {diskonMode !== 'none' && (
                <input className="form-control" type="number" placeholder={diskonMode === 'persen' ? '0' : '0'}
                  value={diskonInput} onChange={(e) => setDiskonInput(e.target.value)} />
              )}
              {diskonManual > 0 && <span className="text-sm text-danger font-bold">−{formatRupiah(diskonManual)}</span>}
            </div>
          </div>

          {/* ===== Voucher ===== */}
          <div className="form-group">
            <label className="form-label">Kode Voucher</label>
            <div className="diskon-row">
              <input className="form-control" placeholder="mis. PROMO10" value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} />
              <button type="button" className="btn btn-outline btn-sm" onClick={cekVoucher} disabled={cekPod}>
                {cekPod ? '...' : 'Pakai'}
              </button>
              {voucher && (
                <button type="button" className="btn btn-sm btn-danger"
                  onClick={() => { setVoucher(null); setVoucherInput(''); setVoucherMsg('') }}
                  aria-label="Batalkan voucher">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            {voucherMsg && <div className="text-xs mt-1">{voucherMsg}</div>}
            {voucher && diskonVoucher > 0 && <div className="text-sm text-danger font-bold mt-1">−{formatRupiah(diskonVoucher)}</div>}
          </div>

          {/* ===== Member / Poin ===== */}
          {loyalty.aktif && (
            <div className="form-group">
              <label className="form-label">Member / Pelanggan</label>
              <div className="diskon-row">
                <input className="form-control" placeholder="Nama / kontak" value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)} />
                <button type="button" className="btn btn-outline btn-sm" onClick={cariMember}>Cari</button>
              </div>
              {memberMsg && <div className="text-xs mt-1">{memberMsg}</div>}
              {member && (
                <div className="member-box mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{TIER_EMOJI[member.tier] || ''} {member.nama}</div>
                      <div className="text-xs text-muted">Tier {member.tier} · {member.poin} poin</div>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => { setMember(null); setPoinPakai(''); setMemberMsg('') }}>Ganti</button>
                  </div>
                  {bolehTukar && (
                    <div className="diskon-row mt-2">
                      <input className="form-control" type="number" placeholder={`maks ${Math.min(member.poin, maxPoin)}`}
                        value={poinPakai} onChange={(e) => setPoinPakai(e.target.value)} />
                      <button type="button" className="btn btn-sm btn-primary"
                        onClick={() => setPoinPakai(String(Math.min(member.poin, maxPoin)))}>Maks</button>
                    </div>
                  )}
                  {diskonPoin > 0 && <div className="text-sm text-danger font-bold mt-1">Tukar poin −{formatRupiah(diskonPoin)}</div>}
                  {poinDidapat > 0 && <div className="text-sm text-success mt-1">Akan dapat +{poinDidapat} poin</div>}
                </div>
              )}
              {!member && memberQuery.trim() && memberMsg.includes('belum terdaftar') && (
                <button type="button" className="btn btn-sm btn-outline mt-2" onClick={buatMemberBaru}>
                  <Icon name="plus" size={14} /> Daftarkan sebagai member
                </button>
              )}
            </div>
          )}

          {/* ===== Ringkasan ===== */}
          <div className="cart-total">
            {diskonResellerRp > 0 && (
              <div className="baw-row"><span>Harga normal</span><b className="text-muted">{formatRupiah(subtotalNormal)}</b></div>
            )}
            {diskonResellerRp > 0 && (
              <div className="baw-row"><span>Diskon reseller {diskonReseller}%</span><b className="text-danger">−{formatRupiah(diskonResellerRp)}</b></div>
            )}
            <div className="baw-row"><span>Subtotal</span><b>{formatRupiah(subtotal)}</b></div>
            {diskonManual > 0 && <div className="baw-row"><span>Diskon</span><b className="text-danger">−{formatRupiah(diskonManual)}</b></div>}
            {diskonVoucher > 0 && <div className="baw-row"><span>Voucher {voucher?.kode}</span><b className="text-danger">−{formatRupiah(diskonVoucher)}</b></div>}
            {diskonPoin > 0 && <div className="baw-row"><span>Tukar {poinDipakai} poin</span><b className="text-danger">−{formatRupiah(diskonPoin)}</b></div>}
            <div className="baw-row total"><span>TOTAL</span><b className="text-primary">{formatRupiah(total)}</b></div>
          </div>

          {/* Metode pembayaran */}
          <div className="form-group mt-3">
            <label className="form-label">Metode Pembayaran</label>
            <div className="metode-grid">
              {METODE.map((m) => (
                <button key={m.key} type="button" className={`metode-btn ${metode === m.key ? 'active' : ''}`}
                  onClick={() => setMetode(m.key)} aria-pressed={metode === m.key}>
                  <Icon name={m.icon} size={15} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {metode === 'cash' && (
            <div className="form-group">
              <label className="form-label">Nominal Bayar</label>
              <input className="form-control" type="number" value={nominalBayar} onChange={(e) => setNominalBayar(e.target.value)} placeholder="0" />
              <div className="text-sm text-muted mt-2">Kembalian: <b className="text-success">{formatRupiah(kembalian)}</b></div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[total, 50000, 100000, 200000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4).map((v) => (
                  <button key={v} type="button" className="btn btn-sm btn-outline" onClick={() => setNominalBayar(String(v))}>
                    {v === total ? 'Uang Pas' : formatRupiah(v)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nama Pelanggan</label>
            <div className="customer-suggest-wrap">
              <input className="form-control" value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value)
                  cariPelanggan(e.target.value)
                  setTelp('')
                }}
                placeholder="Ketik nama / telepon..." onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
                aria-label="Nama pelanggan" />
              {suggestOpen && suggest.length > 0 && (
                <div className="customer-suggest-list">
                  {suggest.map((s) => (
                    <button key={s.id} type="button" className="customer-suggest-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setCustomer(s.nama)
                        setTelp(s.kontak || '')
                        setSuggestOpen(false)
                        setMemberQuery(s.nama)
                      }}>
                      <Icon name="users" size={14} />
                      <span>{s.nama}</span>
                      {s.kontak && <span className="text-xs text-muted"><Icon name="phone" size={11} /> {s.kontak}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">No. Telepon / WA</label>
            <input className="form-control" value={telp} onChange={(e) => setTelp(e.target.value)}
              placeholder="08xxxxxxxxxx" inputMode="tel" />
            <div className="text-xs text-muted mt-1">Dipakai untuk WA blast promo & info member</div>
          </div>

          <button className="btn btn-primary btn-block" style={{ padding: 14, fontSize: 16 }} onClick={handleCheckout} disabled={saving || cart.length === 0}>
            {saving ? (
              <>
                <span className="spinner" /> Memproses...
              </>
            ) : (
              <>
                <Icon name="banknote" size={17} /> Bayar {formatRupiah(total)}
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .pos-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 1024px) { .pos-layout { grid-template-columns: 1.4fr .9fr; align-items: start; } }

        .search-wrap { position: relative; flex: 1; }
        .pos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 640px) { .pos-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1200px) { .pos-grid { grid-template-columns: repeat(4, 1fr); } }

        .pos-produk {
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          overflow: hidden; background: var(--card); cursor: pointer;
          transition: all .15s; text-align: left; padding: 0;
        }
        .pos-produk:hover { border-color: var(--primary); background: var(--primary-light); }
        .pos-produk.pos-habis { opacity: .55; cursor: not-allowed; background: var(--card-alt); }
        .pos-produk-img {
          height: 80px; background: var(--card-alt);
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); border-bottom: 1px solid var(--border);
        }
        .pos-produk-img img { width: 100%; height: 100%; object-fit: cover; }
        .pos-produk-info { padding: 8px 10px; }
        .pos-produk-nama { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pos-produk-harga { font-size: 13px; font-weight: 600; color: var(--primary); }

        .cart-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
        .cart-item {
          display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center;
          padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);
        }
        .cart-item-actions { display: flex; align-items: center; gap: 6px; }
        .qty-btn {
          width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-weight: 600;
          background: var(--bg); transition: all .15s;
        }
        .qty-btn:hover { border-color: var(--primary); color: var(--primary); }
        .qty-del { color: var(--danger); }
        .qty-del:hover { border-color: var(--danger); }

        .cart-total { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-strong); }
        .baw-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .baw-row span { color: var(--muted); }
        .baw-row.total { border-top: 1px solid var(--border); margin-top: 6px; padding-top: 8px; }
        .baw-row.total b { font-size: 20px; }

        .metode-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .channel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .channel-grid .metode-btn { font-size: 11px; padding: 8px 4px; gap: 4px; flex-direction: column; }
        .metode-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 6px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-weight: 500; font-size: 12.5px; transition: border-color .12s, background .12s, color .12s;
          background: var(--card); color: var(--muted);
        }
        .metode-btn:hover { border-color: var(--border-strong); color: var(--text); }
        .metode-btn.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary-dark); }

        .diskon-row { display: flex; align-items: center; gap: 8px; }
        .member-box { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: var(--bg); }

        .customer-suggest-wrap { position: relative; }
        .customer-suggest-list {
          position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm);
          box-shadow: var(--shadow-lg); overflow: hidden;
        }
        .customer-suggest-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 12px; text-align: left; font-size: 13px; cursor: pointer;
          background: var(--card); color: var(--text); border: none; border-bottom: 1px solid var(--border);
        }
        .customer-suggest-item:last-child { border-bottom: none; }
        .customer-suggest-item:hover { background: var(--primary-light); color: var(--primary-dark); }
        .customer-suggest-item .text-xs { margin-left: auto; white-space: nowrap; }
      `}</style>
    </AppLayout>
  )
}
