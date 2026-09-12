import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../components/AuthProvider'
import AppLayout from '../../components/AppLayout'

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

export default function ProdukDetail() {
  const router = useRouter()
  const { id } = router.query
  const [produk, setProduk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchProduk = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
    if (error) setError(error.message)
    else setProduk(data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchProduk()
  }, [fetchProduk])

  const handleDelete = async () => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      router.push('/produk-hpp')
    }
  }

  if (loading) {
    return <AppLayout title="Detail Produk"><div className="card"><p className="text-muted">Memuat...</p></div></AppLayout>
  }

  if (error || !produk) {
    return (
      <AppLayout title="Detail Produk">
        <div className="card">
          <div className="empty-state">
            <div className="nav-icon" style={{ fontSize: 40 }}>😕</div>
            <h3>{error || 'Produk tidak ditemukan'}</h3>
            <Link href="/produk-hpp" className="btn btn-outline mt-3">← Kembali</Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  const rincian = produk.rincian_json || {}
  const margin = Math.round(produk.margin || 0)
  const marginBadge = margin >= 40 ? 'badge-success' : margin >= 20 ? 'badge-warning' : 'badge-danger'

  return (
    <AppLayout title={produk.nama_produk} subtitle="Detail produk & kalkulasi HPP">
      <div className="grid-2">
        {/* Kiri: foto & info */}
        <div className="card">
          <div className="foto-detail">
            {produk.foto_url ? (
              <img src={produk.foto_url} alt={produk.nama_produk} />
            ) : (
              <div className="foto-placeholder">🍱</div>
            )}
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-sm text-muted">Kategori</div>
                <div className="badge badge-info">{produk.kategori || 'Tanpa kategori'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Stok</div>
                <div className={`font-bold ${produk.stok_produk <= 5 ? 'text-danger' : ''}`}>{produk.stok_produk} unit</div>
              </div>
              <div>
                <div className="text-sm text-muted">Margin</div>
                <span className={`badge ${marginBadge}`}>{margin}%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Link href={`/produk-hpp/baru?id=${produk.id}`} className="btn btn-primary">✏️ Edit Produk</Link>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>🗑️ Hapus</button>
          </div>
          {confirmDelete && (
            <div className="alert alert-danger mt-3">
              <div className="flex-1">
                <b>Hapus produk ini?</b><br />Tindakan ini tidak bisa dibatalkan.
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-outline" onClick={() => setConfirmDelete(false)}>Batal</button>
                <button className="btn btn-sm btn-danger" onClick={handleDelete}>Ya, Hapus</button>
              </div>
            </div>
          )}
        </div>

        {/* Kanan: rincian HPP */}
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🧮</span> Rincian HPP</div></div>

          <div className="hpp-summary">
            <div className="hpp-row"><span>Total Bahan Baku</span><b>{formatRupiah(rincian.bahan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0)}</b></div>
            <div className="hpp-row"><span>Total Kemasan</span><b>{formatRupiah(rincian.kemasan?.reduce((s, r) => s + r.qty * r.harga, 0) || 0)}</b></div>
            <div className="hpp-row"><span>Total Operasional</span><b>{formatRupiah(rincian.operasional?.reduce((s, r) => s + r.qty * r.harga, 0) || 0)}</b></div>
            <div className="hpp-row"><span>Pajak ({rincian.pajak_persen || 0}%)</span><b>{formatRupiah(rincian.pajak_nominal || 0)}</b></div>
            <div className="hpp-row hpp-total"><span>Total HPP</span><b>{formatRupiah(produk.total_hpp)}</b></div>
            <div className="hpp-row"><span>Hasil per Batch</span><b>{produk.jumlah_produksi} unit</b></div>
            <div className="hpp-row hpp-highlight"><span>HPP / Unit</span><b>{formatRupiah(produk.hpp_per_unit)}</b></div>
            <div className="hpp-row hpp-highlight"><span>Harga Jual</span><b className="text-primary">{formatRupiah(produk.harga_jual)}</b></div>
          </div>

          {rincian.bahan?.length > 0 && (
            <div className="mt-4">
              <div className="card-title mb-2" style={{ fontSize: 14 }}>📋 Bahan Baku</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Nama</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {rincian.bahan.map((b, i) => (
                      <tr key={i}><td>{b.nama}</td><td>{b.qty}</td><td>{formatRupiah(b.harga)}</td><td>{formatRupiah(b.qty * b.harga)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .foto-detail {
          width: 100%; height: 280px; border-radius: var(--radius);
          overflow: hidden; background: var(--bg);
          display: flex; align-items: center; justify-content: center;
        }
        .foto-detail img { width: 100%; height: 100%; object-fit: cover; }
        .foto-placeholder { font-size: 80px; opacity: .4; }
        .hpp-summary { display: flex; flex-direction: column; gap: 8px; }
        .hpp-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .hpp-row span { color: var(--muted); }
        .hpp-total { font-size: var(--fs-md); border-bottom: 2px solid var(--border); }
        .hpp-highlight { border-bottom: none; background: var(--bg); padding: 12px; border-radius: var(--radius-sm); }
      `}</style>
    </AppLayout>
  )
}
