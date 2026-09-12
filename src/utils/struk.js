/**
 * Cetak struk belanja lewat window print browser.
 * Dipakai POS setelah transaksi berhasil, dan bisa dipanggil ulang dari riwayat.
 */

const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

const tglID = (d) =>
  new Date(d || Date.now()).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

const METODE_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', ewallet: 'E-Wallet' }

/**
 * Buka jendela struk dan langsung panggil print.
 * @param {object} trx  { id_transaksi, tanggal, total_bayar, metode_pembayaran, nominal_bayar, kembalian, customer, items[], diskon, diskon_voucher, voucher_kode, poin_didapat, poin_ditukar, nama_toko, alamat_toko, telepon_toko, footer_struk }
 */
export function cetakStruk(trx, opts = {}) {
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

  const rows = items.map((i) => `
    <tr>
      <td colspan="2">${escapeHtml(i.nama_produk || '-')}</td>
    </tr>
    <tr>
      <td class="qty">${i.qty} x ${rp(i.harga_satuan)}</td>
      <td class="right">${rp(i.subtotal)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Struk ${escapeHtml(t.id_transaksi || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000;
         margin: 0; padding: 12px; background: #fff; }
  .wrap { width: 78mm; margin: 0 auto; }
  .center { text-align: center; }
  .shop { font-weight: 800; font-size: 15px; letter-spacing: .5px; }
  .muted { color: #444; font-size: 11px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  .qty { color: #444; font-size: 11px; padding-left: 6px; }
  .right { text-align: right; white-space: nowrap; }
  .bold { font-weight: 800; }
  .tot td { font-size: 14px; font-weight: 800; padding-top: 4px; }
  .loyal { margin-top: 6px; border: 1px dashed #000; padding: 6px; font-size: 11px; }
  .actions { margin: 16px auto 0; text-align: center; }
  button { font-family: inherit; font-size: 13px; padding: 8px 16px; margin: 0 4px; cursor: pointer; }
  @media print {
    .actions { display: none; }
    body { padding: 0; }
    @page { margin: 4mm; size: 80mm auto; }
  }
</style></head>
<body><div class="wrap">
  <div class="center">
    <div class="shop">${escapeHtml(nama)}</div>
    ${alamat ? `<div class="muted">${escapeHtml(alamat)}</div>` : ''}
    ${telp ? `<div class="muted">${escapeHtml(telp)}</div>` : ''}
  </div>
  <hr>
  <table>
    <tr><td>No</td><td class="right">${escapeHtml(t.id_transaksi || '-')}</td></tr>
    <tr><td>Tanggal</td><td class="right">${tglID(t.tanggal)}</td></tr>
    ${t.customer ? `<tr><td>Pelanggan</td><td class="right">${escapeHtml(t.customer)}</td></tr>` : ''}
  </table>
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    ${diskonTier > 0 ? `<tr><td>Diskon</td><td class="right">-${rp(diskonTier)}</td></tr>` : ''}
    ${diskonVoucher > 0 ? `<tr><td>Voucher ${escapeHtml(t.voucher_kode || '')}</td><td class="right">-${rp(diskonVoucher)}</td></tr>` : ''}
    <tr class="tot"><td>TOTAL</td><td class="right">${rp(total)}</td></tr>
    <tr><td>${METODE_LABEL[t.metode_pembayaran] || 'Bayar'}</td><td class="right">${rp(t.nominal_bayar || total)}</td></tr>
    ${Number(t.kembalian) > 0 ? `<tr><td>Kembalian</td><td class="right">${rp(t.kembalian)}</td></tr>` : ''}
  </table>
  ${(t.poin_didapat || t.poin_ditukar) ? `
  <div class="loyal">
    ${t.poin_ditukar ? `<div>Poin ditukar: <b>${t.poin_ditukar}</b></div>` : ''}
    ${t.poin_didapat ? `<div>Poin didapat: <b>+${t.poin_didapat}</b></div>` : ''}
    ${t.total_poin != null ? `<div>Total poin: <b>${t.total_poin}</b></div>` : ''}
  </div>` : ''}
  <hr>
  <div class="center muted">${escapeHtml(footer)}</div>
  <div class="actions">
    <button onclick="window.print()">🖨️ Cetak</button>
    <button onclick="window.close()">Tutup</button>
  </div>
</div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 250); });</script>
</body></html>`

  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak struk.')
    return null
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  return w
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
