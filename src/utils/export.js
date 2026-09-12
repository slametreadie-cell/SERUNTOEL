/**
 * Export data ke Excel/CSV & PDF — tanpa library tambahan (aman untuk build).
 * CSV memakai BOM + pemisah titik-koma agar langsung rapi di Excel Indonesia.
 */

const esc = (v) => {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const UNDUH = (blob, nama) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Ekspor array of objects ke file .csv yang bisa dibuka Excel.
 * @param {Array<object>} rows
 * @param {Array<{key:string,label:string}>} kolom
 * @param {string} namaFile
 */
export function exportCSV(rows, kolom, namaFile = 'export.csv') {
  if (!rows?.length) { alert('Tidak ada data untuk diekspor'); return }
  const head = kolom.map((k) => esc(k.label)).join(';')
  const body = rows.map((r) => kolom.map((k) => esc(r[k.key])).join(';')).join('\n')
  const csv = '\uFEFF' + head + '\n' + body            // BOM -> Excel baca UTF-8
  UNDUH(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), namaFile)
}

/**
 * Cetak tabel sebagai PDF lewat dialog print browser (pilih "Save as PDF").
 * @param {string} judul
 * @param {Array<{key:string,label:string}>} kolom
 * @param {Array<object>} rows
 * @param {object} opts { subjudul, ringkasan: [{label, value}] }
 */
export function exportPDF(judul, kolom, rows, opts = {}) {
  const rp = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0)

  const head = kolom.map((k) => `<th>${esc(k.label)}</th>`).join('')
  const body = rows.map((r) =>
    `<tr>${kolom.map((k) => {
      const v = r[k.key]
      const align = typeof v === 'number' || /rp|total|jumlah|omset|harga|hpp|laba|diskon/i.test(k.key) ? 'right' : 'left'
      const teks = typeof v === 'number' && /rp|total|jumlah|omset|harga|hpp|laba|diskon|biaya|pendapatan|budget|target/i.test(k.key)
        ? rp(v) : (v ?? '—')
      return `<td class="${align}">${esc(teks)}</td>`
    }).join('')}</tr>`).join('')

  const ringkas = (opts.ringkasan || []).map((x) =>
    `<div class="sum"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('')

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judul)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
  .sum-box { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .sum { border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; min-width: 150px; }
  .sum span { display: block; color: #666; font-size: 11px; }
  .sum b { font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; }
  th { background: #f3f4f6; text-align: left; font-weight: 700; }
  td.right, th.right { text-align: right; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .actions { margin-top: 20px; text-align: center; }
  button { font: inherit; padding: 9px 18px; margin: 0 4px; cursor: pointer; border-radius: 6px;
    border: 1px solid #ccc; background: #fff; }
  button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
  @media print { .actions { display: none; } body { padding: 0; } @page { size: A4 landscape; margin: 10mm; } }
</style></head><body>
  <h1>${esc(judul)}</h1>
  <div class="sub">${esc(opts.subjudul || '')} · Dicetak ${new Date().toLocaleString('id-ID')}</div>
  ${ringkas ? `<div class="sum-box">${ringkas}</div>` : ''}
  <table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="99">Tidak ada data</td></tr>'}</tbody></table>
  <div class="actions">
    <button class="primary" onclick="window.print()">🖨️ Simpan sebagai PDF</button>
    <button onclick="window.close()">Tutup</button>
  </div>
</body></html>`

  const w = window.open('', '_blank', 'width=1000,height=720')
  if (!w) { alert('Popup diblokir. Izinkan popup untuk mengekspor PDF.'); return }
  w.document.open(); w.document.write(html); w.document.close()
}
