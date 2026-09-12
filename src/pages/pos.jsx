import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const METODE = [
  { key: 'cash', label: '💵 Tunai' },
  { key: 'qris', label: '📱 QRIS' },
  { key: 'transfer', label: '🏦 Transfer' },
  { key: 'ewallet', label: '👛 E-Wallet' },
]

export default function POS() {
  const { user } = useAuth()
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('')

  // Keranjang
  const [cart, setCart] = useState([]) // [{id, nama, harga, qty, stok, foto}]
  const [metode, setMetode] = useState('cash')
  const [nominalBayar, setNominalBayar] = useState('')
  const [customer, setCustomer] = useState('')
  const [saving, setSaving] = useState(false)
  const [sukses, setSukses] = useState(null)

  const fetchProduk = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('nama_produk')
    if (error) setError(error.message)
    else setProduk(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProduk() }, [fetchProduk])

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
        // cek stok
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
      return [...prev, { id: p.id, nama: p.nama_produk, harga: p.harga_jual, qty: 1, stok: p.stok_produk, foto: p.foto_url }]
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

  const subtotal = cart.reduce((s, i) => s + i.harga * i.qty, 0)
  const kembalian = Math.max(0, (Number(nominalBayar) || 0) - subtotal)

  const resetCart = () => {
    setCart([])
    setNominalBayar('')
    setCustomer('')
    setMetode('cash')
  }

  // ===== Checkout =====
  const handleCheckout = async () => {
    if (cart.length === 0) { alert('Keranjang masih kosong'); return }
    if (metode === 'cash' && (Number(nominalBayar) || 0) < subtotal) {
      alert('Nominal bayar kurang dari total!')
      return
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
        subtotal: i.harga * i.qty,
      }))

      // 1. Insert transaksi
      const { data: trx, error: trxErr } = await supabase
        .from('transactions')
        .insert({
          id_transaksi: idTransaksi,
          total_bayar: subtotal,
          metode_pembayaran: metode,
          nominal_bayar: metode === 'cash' ? Number(nominalBayar) || 0 : subtotal,
          kembalian: metode === 'cash' ? kembalian : 0,
          customer: customer || null,
          user_id: user?.id,
        })
        .select('id')
        .single()

      if (trxErr) throw trxErr

      // 2. Insert items
      const { error: itemsErr } = await supabase
        .from('transaction_items')
        .insert(itemsPayload.map((i) => ({ ...i, transaksi_id: trx.id })))
      if (itemsErr) throw itemsErr

      // 3. Kurangi stok produk
      for (const i of cart) {
        const { data: prod } = await supabase.from('products').select('stok_produk').eq('id', i.id).single()
        const stokBaru = Math.max(0, (prod?.stok_produk || 0) - i.qty)
        await supabase.from('products').update({ stok_produk: stokBaru }).eq('id', i.id)
      }

      setSukses({ id: idTransaksi, total: subtotal, kembalian, metode })
      resetCart()
      fetchProduk()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan transaksi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="POS Kasir" subtitle="Transaksi penjualan cepat">
      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {/* Notifikasi sukses */}
      {sukses && (
        <div className="alert alert-success" style={{ position: 'sticky', top: 70, zIndex: 20, boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex-1">
            <b>✅ Transaksi berhasil!</b><br />
            <span className="text-sm">{sukses.id}</span>
          </div>
          <div className="text-right">
            <div className="font-extrabold">{formatRupiah(sukses.total)}</div>
            {sukses.metode === 'cash' && <div className="text-sm">Kembalian: {formatRupiah(sukses.kembalian)}</div>}
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setSukses(null)}>✕</button>
        </div>
      )}

      <div className="pos-layout">
        {/* ===== KIRI: Katalog ===== */}
        <div className="card pos-katalog" style={{ padding: 16 }}>
          <div className="flex gap-2 mb-3">
            <input className="form-control" placeholder="🔍 Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="form-control" style={{ maxWidth: 160 }} value={kategori} onChange={(e) => setKategori(e.target.value)}>
              <option value="">Semua</option>
              {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="text-muted text-center">Memuat produk...</p>
          ) : produkFiltered.length === 0 ? (
            <div className="empty-state">
              <div className="nav-icon" style={{ fontSize: 40 }}>🛒</div>
              <h3>Belum ada produk</h3>
              <p className="text-sm">Tambahkan produk di menu Produk & HPP dulu.</p>
            </div>
          ) : (
            <div className="pos-grid">
              {produkFiltered.map((p) => {
                const habis = (p.stok_produk || 0) < 1
                return (
                  <button key={p.id} className={`pos-produk ${habis ? 'pos-habis' : ''}`} onClick={() => addToCart(p)} disabled={habis}>
                    <div className="pos-produk-img">
                      {p.foto_url ? <img src={p.foto_url} alt={p.nama_produk} /> : <span>🍱</span>}
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

        {/* ===== KANAN: Keranjang ===== */}
        <div className="card pos-keranjang" style={{ padding: 16 }}>
          <div className="card-title mb-3"><span className="nav-icon">🧺</span> Keranjang ({cart.length})</div>

          {cart.length === 0 ? (
            <div className="text-center text-muted py-4">Keranjang kosong.<br /><span className="text-sm">Klik produk untuk menambahkan.</span></div>
          ) : (
            <div className="cart-list">
              {cart.map((i) => (
                <div key={i.id} className="cart-item">
                  <div className="cart-item-info">
                    <div className="font-bold" style={{ fontSize: 13 }}>{i.nama}</div>
                    <div className="text-sm text-muted">{formatRupiah(i.harga)} × {i.qty}</div>
                  </div>
                  <div className="cart-item-actions">
                    <button className="qty-btn" onClick={() => updateQty(i.id, -1)}>−</button>
                    <span className="font-bold">{i.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(i.id, 1)}>＋</button>
                    <button className="qty-btn qty-del" onClick={() => removeItem(i.id)}>✕</button>
                  </div>
                  <div className="font-bold text-primary" style={{ fontSize: 13 }}>{formatRupiah(i.harga * i.qty)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="cart-total">
            <div className="hpp-row"><span>Subtotal</span><b>{formatRupiah(subtotal)}</b></div>
            <div className="hpp-row"><span>Total</span><b className="text-primary" style={{ fontSize: 20 }}>{formatRupiah(subtotal)}</b></div>
          </div>

          {/* Metode pembayaran */}
          <div className="form-group mt-3">
            <label className="form-label">Metode Pembayaran</label>
            <div className="metode-grid">
              {METODE.map((m) => (
                <button key={m.key} type="button" className={`metode-btn ${metode === m.key ? 'active' : ''}`} onClick={() => setMetode(m.key)}>
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
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nama Pelanggan (opsional)</label>
            <input className="form-control" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Tanpa nama" />
          </div>

          <button className="btn btn-primary btn-block" style={{ padding: 14, fontSize: 16 }} onClick={handleCheckout} disabled={saving || cart.length === 0}>
            {saving ? <><span className="spinner" /> Memproses...</> : `💳 Bayar ${formatRupiah(subtotal)}`}
          </button>
        </div>
      </div>

      <style jsx>{`
        .pos-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 1024px) { .pos-layout { grid-template-columns: 1.4fr .9fr; align-items: start; } }

        .pos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 640px) { .pos-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1200px) { .pos-grid { grid-template-columns: repeat(4, 1fr); } }

        .pos-produk {
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          overflow: hidden; background: var(--card); cursor: pointer;
          transition: all .15s; text-align: left; padding: 0;
        }
        .pos-produk:hover { transform: translateY(-2px); border-color: var(--primary); box-shadow: var(--shadow-hover); }
        .pos-produk.pos-habis { opacity: .5; cursor: not-allowed; }
        .pos-produk-img { height: 80px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .pos-produk-img img { width: 100%; height: 100%; object-fit: cover; }
        .pos-produk-info { padding: 8px 10px; }
        .pos-produk-nama { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pos-produk-harga { font-size: 13px; font-weight: 800; color: var(--primary); }

        .cart-list { display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto; }
        .cart-item {
          display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center;
          padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);
        }
        .cart-item-actions { display: flex; align-items: center; gap: 6px; }
        .qty-btn {
          width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-weight: 700;
          background: var(--bg); transition: all .15s;
        }
        .qty-btn:hover { border-color: var(--primary); color: var(--primary); }
        .qty-del { color: var(--danger); }
        .qty-del:hover { border-color: var(--danger); }

        .cart-total { margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--border); }
        .hpp-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .hpp-row span { color: var(--muted); }

        .metode-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .metode-btn {
          padding: 10px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-weight: 600; font-size: 13px; transition: all .15s; background: var(--card);
        }
        .metode-btn.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary-dark); }
      `}</style>
    </AppLayout>
  )
}
