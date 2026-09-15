/**
 * Konversi data transaksi ke teks WA.
 * Dipakai untuk kirim struk via WA + WA Blast.
 */

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (d) =>
  new Date(d || Date.now()).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

const METODE_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', ewallet: 'E-Wallet' }

/**
 * @param {object} trx  { id_transaksi, tanggal, total_bayar, metode_pembayaran, nominal_bayar, kembalian, customer, items[], diskon, diskon_voucher, voucher_kode, poin_didapat, poin_ditukar, nama_toko, alamat_toko, telepon_toko, footer_struk }
 * @returns {string} teks WA
 */
export function teksStrukWA(trx) {
  const t = trx || {}
  const items = Array.isArray(t.items) ? t.items : []
  const subtotal = items.reduce((s, i) => s + Number(i.subtotal || 0), 0)
  const diskonTier = Number(t.diskon || 0)
  const diskonVoucher = Number(t.diskon_voucher || 0)
  const total = Number(t.total_bayar || 0)

  const nama = t.nama_toko || 'SERUNTUL'
  const alamat = t.alamat_toko || ''
  const telp = t.telepon_toko || ''
  const footer = t.footer_struk || 'Terima kasih telah berbelanja 🙏'

  const rows = items.map((i) =>
    `${i.qty}x ${i.nama_produk || '-'}: ${rp(i.subtotal)}`
  ).join('\n')

  let txt = `*${nama}*
`
  if (alamat) txt += `${alamat}\n`
  if (telp) txt += `${telp}\n`
  txt += `\nNo: ${t.id_transaksi || '-'}\nTanggal: ${tglID(t.tanggal)}\n`
  if (t.customer) txt += `Pelanggan: ${t.customer}\n`
  txt += `\n${rows}\n`
  if (diskonTier > 0) txt += `\nDiskon: -${rp(diskonTier)}`
  if (diskonVoucher > 0) txt += `\nVoucher ${t.voucher_kode || ''}: -${rp(diskonVoucher)}`
  const ongkir = Number(t.ongkir || 0)
  if (ongkir > 0) txt += `\nOngkir: ${rp(ongkir)}`
  txt += `\n*TOTAL: ${rp(total)}*\n${METODE_LABEL[t.metode_pembayaran] || 'Bayar'}: ${rp(t.nominal_bayar || total)}`
  if (Number(t.kembalian) > 0) txt += `\nKembalian: ${rp(t.kembalian)}`

  if (t.poin_didapat || t.poin_ditukar) {
    txt += '\n\n*Loyalty:*'
    if (t.poin_ditukar) txt += `\nPoin ditukar: ${t.poin_ditukar}`
    if (t.poin_didapat) txt += `\nPoin didapat: +${t.poin_didapat}`
    if (t.total_poin != null) txt += `\nTotal poin: ${t.total_poin}`
  }

  txt += `\n\n${footer}`
  return txt
}
