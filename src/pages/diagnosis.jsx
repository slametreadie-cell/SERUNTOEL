import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AppLayout from '../components/AppLayout'
import Icon from '../components/Icons'

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const toISO = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }

export default function Diagnosis() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trx, setTrx] = useState([])
  const [items, setItems] = useState([])
  const [produk, setProduk] = useState([])
  const [cash, setCash] = useState([])
  const [hutang, setHutang] = useState([])
  const [waste, setWaste] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const n = new Date()
      const awal = toISO(new Date(n.getTime() - 29 * 86400000))
      const akhir = toISO(n)
      const awalBulan = toISO(new Date(n.getFullYear(), n.getMonth(), 1))

      const [tRes, pRes, cRes, hRes, wRes] = await Promise.all([
        supabase.from('transactions').select('*').gte('tanggal', `${awal}T00:00:00`).lte('tanggal', `${akhir}T23:59:59`),
        supabase.from('products').select('id, nama_produk, stok_produk, hpp_per_unit, harga_jual'),
        supabase.from('cashflow').select('*').gte('tanggal', awalBulan).lte('tanggal', akhir),
        supabase.from('receivables_payables').select('*').eq('status', 'aktif').limit(500).then((r) => r, () => ({ data: [] })),
        supabase.from('waste_logs').select('*').gte('tanggal', awal).lte('tanggal', akhir),
      ])
      if (tRes.error) throw tRes.error
      const t = tRes.data || []
      setTrx(t); setProduk(pRes.data || []); setCash(cRes.data || [])
      setHutang(hRes.data || []); setWaste(wRes.data || [])

      const ids = t.map((x) => x.id)
      if (ids.length) {
        const { data } = await supabase.from('transaction_items').select('*').in('transaksi_id', ids)
        setItems(data || [])
      } else setItems([])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const diag = useMemo(() => {
    const pendapatan = trx.reduce((s, t) => s + Number(t.total_bayar || 0), 0)
    const hpp = items.reduce((s, i) => s + Number(i.hpp_satuan || 0) * Number(i.qty || 0), 0)
    const labaKotor = pendapatan - hpp
    const marginKotor = pendapatan > 0 ? (labaKotor / pendapatan) * 100 : 0

    const biayaOp = cash.filter((c) => c.jenis === 'keluar' && !['Pembelian Bahan', 'Hutang'].includes(c.kategori))
      .reduce((s, c) => s + Number(c.jumlah || 0), 0)
    const labaBersih = labaKotor - biayaOp
    const marginBersih = pendapatan > 0 ? (labaBersih / pendapatan) * 100 : 0

    // Per produk
    const perProduk = {}
    items.forEach((i) => {
      const n = i.nama_produk || '—'
      if (!perProduk[n]) perProduk[n] = { qty: 0, omset: 0, hpp: 0 }
      perProduk[n].qty += Number(i.qty || 0)
      perProduk[n].omset += Number(i.subtotal || 0)
      perProduk[n].hpp += Number(i.hpp_satuan || 0) * Number(i.qty || 0)
    })
    const produkList = Object.entries(perProduk).map(([nama, v]) => ({
      nama, ...v, laba: v.omset - v.hpp, margin: v.omset > 0 ? ((v.omset - v.hpp) / v.omset) * 100 : 0,
    })).sort((a, b) => b.omset - a.omset)

    // Hari aktif & rata-rata harian
    const hariSet = new Set(trx.map((t) => (t.tanggal || '').slice(0, 10)))
    const hariAktif = hariSet.size || 1
    const rataHarian = pendapatan / hariAktif

    // Stok menipis / mati
    const stokHabis = produk.filter((p) => (p.stok_produk || 0) <= 0)
    const produkTerjual = new Set(items.map((i) => i.nama_produk))
    const produkMati = produk.filter((p) => !produkTerjual.has(p.nama_produk) && (p.stok_produk || 0) > 0)

    // Konsentrasi: berapa % omset dari 1 produk teratas
    const konsentrasi = produkList.length && pendapatan > 0 ? (produkList[0].omset / pendapatan) * 100 : 0

    // Waste
    const biayaWaste = waste.reduce((s, w) => s + Number(w.biaya_hpp || 0), 0)
    const rasioWaste = pendapatan > 0 ? (biayaWaste / pendapatan) * 100 : 0

    // Hutang/piutang
    const piutang = hutang.filter((h) => h.jenis === 'piutang').reduce((s, h) => s + Number(h.jumlah || 0), 0)
    const hutangTotal = hutang.filter((h) => h.jenis === 'hutang').reduce((s, h) => s + Number(h.jumlah || 0), 0)

    // ===== Skor komponen (0-100) =====
    const skor = {
      profitabilitas: Math.max(0, Math.min(100, Math.round((marginBersih / 20) * 100))),   // 20% margin = 100
      marginKotor: Math.max(0, Math.min(100, Math.round((marginKotor / 40) * 100))),        // 40% = 100
      konsistensi: Math.max(0, Math.min(100, Math.round((hariAktif / 30) * 100))),
      diversifikasi: produkList.length === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - Math.max(0, konsentrasi - 30) * 1.4))),
      efisiensiWaste: Math.max(0, Math.min(100, Math.round(100 - rasioWaste * 10))),        // 0% waste = 100
      likuiditas: (piutang + hutangTotal) === 0 ? 80 : Math.max(0, Math.min(100, Math.round(100 - (hutangTotal / (pendapatan || 1)) * 100))),
    }
    const total = Math.round(Object.values(skor).reduce((s, v) => s + v, 0) / Object.keys(skor).length)

    // ===== Rekomendasi =====
    const rekom = []
    if (marginBersih < 5) rekom.push({ p: 'tinggi', t: 'Margin bersih sangat tipis', d: `Margin ${marginBersih.toFixed(1)}%. Tinjau harga jual atau tekan HPP. Target minimal 10-15%.` })
    else if (marginBersih < 10) rekom.push({ p: 'sedang', t: 'Margin bersih masih tipis', d: `Margin ${marginBersih.toFixed(1)}%. Masih bisa ditingkatkan dengan efisiensi bahan atau harga.` })
    else rekom.push({ p: 'baik', t: 'Margin bersih sehat', d: `Margin ${marginBersih.toFixed(1)}%. Pertahankan struktur biaya saat ini.` })

    if (marginKotor < 30) rekom.push({ p: 'sedang', t: 'HPP terlalu tinggi terhadap harga jual', d: `HPP memakan ${(100 - marginKotor).toFixed(1)}% dari pendapatan. Cek harga bahan & porsi.` })
    if (konsentrasi > 50) rekom.push({ p: 'tinggi', t: 'Penjualan terlalu bergantung 1 produk', d: `${konsentrasi.toFixed(0)}% omset dari "${produkList[0]?.nama}". Risiko besar jika produk itu turun.` })
    if (hariAktif < 15) rekom.push({ p: 'sedang', t: 'Penjualan belum konsisten', d: `Hanya ${hariAktif} hari ada transaksi dalam 30 hari. Pertimbangkan promo di hari sepi.` })
    if (rasioWaste > 3) rekom.push({ p: 'tinggi', t: 'Waste terlalu besar', d: `Kerugian waste ${rp(biayaWaste)} (${rasioWaste.toFixed(1)}% dari omset). Perbaiki penyimpanan & perkiraan produksi.` })
    if (stokHabis.length > 0) rekom.push({ p: 'sedang', t: `${stokHabis.length} produk stoknya habis`, d: `Produk: ${stokHabis.slice(0, 5).map((p) => p.nama_produk).join(', ')}${stokHabis.length > 5 ? ` +${stokHabis.length - 5} lagi` : ''}. Isi ulang agar tidak kehilangan penjualan.` })
    if (produkMati.length > 0) rekom.push({ p: 'rendah', t: `${produkMati.length} produk tidak terjual 30 hari`, d: `Produk: ${produkMati.slice(0, 5).map((p) => p.nama_produk).join(', ')}. Pertimbangkan promo atau hentikan produksi.` })
    if (piutang > 0) rekom.push({ p: 'rendah', t: 'Ada piutang belum tertagih', d: `Total ${rp(piutang)}. Tagih agar arus kas lancar.` })
    if (hutangTotal > pendapatan * 0.5) rekom.push({ p: 'tinggi', t: 'Hutang besar dibanding pendapatan', d: `Hutang ${rp(hutangTotal)} vs pendapatan 30 hari ${rp(pendapatan)}. Prioritaskan pelunasan.` })
    if (labaBersih < 0) rekom.push({ p: 'tinggi', t: 'Bisnis sedang RUGI', d: `Rugi ${rp(Math.abs(labaBersih))} pada periode ini. Tinjau harga, HPP, dan biaya operasional.` })

    return {
      pendapatan, hpp, labaKotor, biayaOp, labaBersih, marginKotor, marginBersih,
      produkList, hariAktif, rataHarian, stokHabis, produkMati, konsentrasi,
      biayaWaste, rasioWaste, piutang, hutangTotal, skor, total, rekom,
    }
  }, [trx, items, produk, cash, hutang, waste])

  const GRADE = diag.total >= 80 ? { g: 'A', l: 'Sangat Sehat', c: 'text-success' }
    : diag.total >= 65 ? { g: 'B', l: 'Sehat', c: 'text-success' }
    : diag.total >= 50 ? { g: 'C', l: 'Cukup', c: 'text-warning' }
    : diag.total >= 35 ? { g: 'D', l: 'Perlu Perbaikan', c: 'text-warning' }
    : { g: 'E', l: 'Kritis', c: 'text-danger' }

  const KOMPONEN = [
    { k: 'profitabilitas', l: 'Profitabilitas', d: 'Margin bersih (target 20%)' },
    { k: 'marginKotor', l: 'Efisiensi HPP', d: 'Margin kotor (target 40%)' },
    { k: 'konsistensi', l: 'Konsistensi Penjualan', d: 'Hari aktif dalam 30 hari' },
    { k: 'diversifikasi', l: 'Diversifikasi Produk', d: 'Tidak bergantung 1 produk' },
    { k: 'efisiensiWaste', l: 'Efisiensi Produksi', d: 'Rasio waste rendah' },
    { k: 'likuiditas', l: 'Likuiditas', d: 'Beban hutang vs pendapatan' },
  ]

  return (
    <AppLayout title="Diagnosis Bisnis" subtitle="Skor kesehatan & rekomendasi otomatis">
      {error && <div className="alert alert-danger"> {error}</div>}

      {loading ? <p className="text-muted text-center py-4">Menganalisis data 30 hari terakhir...</p> : (
        <>
          {/* Skor utama */}
          <div className="card score-card">
            <div className="score-circle" data-grade={GRADE.g}>
              <div className="sc-num">{diag.total}</div>
              <div className="sc-max">/100</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted">Kesehatan Bisnis Anda</div>
              <div className={`score-label ${GRADE.c}`}>{GRADE.g} — {GRADE.l}</div>
              <div className="text-sm text-muted mt-2">
                Analisis 30 hari terakhir · {diag.hariAktif} hari aktif · rata-rata {rp(diag.rataHarian)}/hari
              </div>
            </div>
          </div>

          {/* Komponen skor */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Icon name="barChart" size={16} /> Rincian Skor</div></div>
            {KOMPONEN.map((k) => {
              const v = diag.skor[k.k]
              return (
                <div key={k.k} className="comp-row">
                  <div className="comp-info">
                    <div className="font-bold">{k.l}</div>
                    <div className="text-xs text-muted">{k.d}</div>
                  </div>
                  <div className="comp-bar">
                    <div className="comp-fill" style={{ width: `${v}%`, background: v >= 70 ? 'var(--success,#16a34a)' : v >= 45 ? 'var(--warning,#d97706)' : 'var(--danger,#dc3545)' }} />
                  </div>
                  <div className="comp-val">{v}</div>
                </div>
              )
            })}
          </div>

          {/* Rekomendasi */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Icon name="pulse" size={16} /> Rekomendasi</div>
              <span className="text-sm text-muted">{diag.rekom.length} temuan</span>
            </div>
            {diag.rekom.map((r, i) => (
              <div key={i} className={`rekom rekom-${r.p}`}>
                <div className="rekom-icon">{r.p === 'tinggi' ? '' : r.p === 'sedang' ? '' : r.p === 'baik' ? '' : ''}</div>
                <div>
                  <div className="font-bold">{r.t}</div>
                  <div className="text-sm text-muted">{r.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Angka kunci */}
          <div className="metrics-grid">
            <div className="metric-card"><div className="metric-label">Pendapatan (30 hari)</div><div className="metric-value text-primary">{rp(diag.pendapatan)}</div></div>
            <div className="metric-card"><div className="metric-label">Laba Bersih</div><div className={`metric-value ${diag.labaBersih >= 0 ? 'text-success' : 'text-danger'}`}>{rp(diag.labaBersih)}</div></div>
            <div className="metric-card"><div className="metric-label">Margin Bersih</div><div className="metric-value">{diag.marginBersih.toFixed(1)}%</div></div>
            <div className="metric-card"><div className="metric-label">Hari Aktif</div><div className="metric-value">{diag.hariAktif} <span className="text-xs text-muted">/30</span></div></div>
            <div className="metric-card"><div className="metric-label">Kerugian Waste</div><div className="metric-value text-danger">{rp(diag.biayaWaste)}</div></div>
            <div className="metric-card"><div className="metric-label">Produk Tidak Laku</div><div className="metric-value">{diag.produkMati.length}</div></div>
          </div>

          {/* Produk teratas */}
          {diag.produkList.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: 16 }}>
                <div className="card-title"><Icon name="gem" size={16} /> Produk Teratas</div>
                <span className="text-sm text-muted">konsentrasi {diag.konsentrasi.toFixed(0)}%</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Produk</th><th className="text-right">Terjual</th><th className="text-right">Omset</th><th className="text-right">Laba</th><th className="text-right">Margin</th></tr></thead>
                  <tbody>
                    {diag.produkList.slice(0, 10).map((p, i) => (
                      <tr key={p.nama}>
                        <td className="font-bold">{i + 1}. {p.nama}</td>
                        <td className="text-right">{p.qty}</td>
                        <td className="text-right">{rp(p.omset)}</td>
                        <td className={`text-right ${p.laba >= 0 ? 'text-success' : 'text-danger'}`}>{rp(p.laba)}</td>
                        <td className="text-right">{p.margin.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .score-card { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .score-circle { width: 110px; height: 110px; border-radius: 50%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; border: 6px solid var(--primary); flex-shrink: 0; }
        .score-circle[data-grade="A"], .score-circle[data-grade="B"] { border-color: var(--success,#16a34a); }
        .score-circle[data-grade="C"], .score-circle[data-grade="D"] { border-color: var(--warning,#d97706); }
        .score-circle[data-grade="E"] { border-color: var(--danger,#dc3545); }
        .sc-num { font-size: 34px; font-weight: 600; line-height: 1; }
        .sc-max { font-size: 11px; color: var(--muted); }
        .score-label { font-size: 22px; font-weight: 600; }
        .comp-row { display: grid; grid-template-columns: 1fr 90px 40px; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border); }
        @media (min-width: 700px) { .comp-row { grid-template-columns: 220px 1fr 40px; } }
        .comp-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
        .comp-fill { height: 100%; border-radius: 4px; transition: width .3s; }
        .comp-val { text-align: right; font-weight: 600; }
        .rekom { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--border); }
        .rekom-icon { font-size: 16px; line-height: 1.4; }
      `}</style>
    </AppLayout>
  )
}
