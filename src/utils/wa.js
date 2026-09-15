/**
 * Suport WhatsApp via Fonnte.
 * - kirimWA(nomor, pesan): kirim satu pesan (butuh token dari settings 'notif.fonnte_token')
 * - formatNomor(nomor): 08xx -> 62xx
 * - isiTemplate(tmpl, data): ganti {var} dengan nilai, beri batas aman
 * - bacaTemplate / simpanTemplate: settle template WA blast di settings 'wa_templates'
 */
import { supabase } from './supabaseClient'

export const formatNomor = (n) => {
  if (!n) return ''
  let s = String(n).replace(/[^\d]/g, '')
  if (s.startsWith('0')) s = '62' + s.slice(1)
  else if (s.startsWith('8')) s = '62' + s
  return s
}

/** Ganti {nama}, {nominal}, {toko}, {poin}, {id} — dan kosongkan tag tak dikenal */
export const isiTemplate = (tmpl, data = {}) => {
  if (!tmpl) return ''
  return String(tmpl).replace(/\{(\w+)\}/g, (_, k) => data[k] !== undefined ? data[k] : '')
}

export async function bacaToken() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'notif.fonnte_token').maybeSingle()
  return data?.value || ''
}

export async function bacaTemplate() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'wa_templates').maybeSingle()
  try { return JSON.parse(data?.value || '[]') } catch { return [] }
}

export async function simpanTemplate(lista) {
  return supabase.from('settings').upsert({ key: 'wa_templates', value: JSON.stringify(lista) }, { onConflict: 'key' })
}

/**
 * Kirim satu pesan WhatsApp via Fonnte.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function kirimWA(nomor, pesan) {
  const token = await bacaToken()
  if (!token) return { ok: false, error: 'Token Fonnte belum diisi di Pengaturan' }
  const tujuan = formatNomor(nomor)
  if (!tujuan) return { ok: false, error: 'Nomor tidak valid' }

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: tujuan, message: pesan }),
    })
    const j = await res.json().catch(() => ({}))
    // Fonnte: status true = terkirim
    if (res.ok && (j.status === true || j.status === 'true')) return { ok: true }
    return { ok: false, error: j.reason || j.message || `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err.message || 'Gagal terhubung ke Fonnte' }
  }
}

/** Simpan log pengiriman ke tabel wa_messages */
export async function catatWA({ nomor, id_transaksi = '', customer_id = null, isi = '', jenis = 'struk', status = 'terkirim', error = '', template = '' }) {
  try {
    return await supabase.from('wa_messages').insert({
      nomor, id_transaksi, customer_id, isi, jenis, status, error, template,
    })
  } catch (e) { return { error: e } }
}

/** Kirim + catat dalam satu langkah; return {ok, error} */
export async function kirimWADanCatat({ nomor, pesan, id_transaksi = '', customer_id = null, jenis = 'struk', template = '' }) {
  const r = await kirimWA(nomor, pesan)
  await catatWA({ nomor, id_transaksi, customer_id, isi: pesan, jenis, status: r.ok ? 'terkirim' : 'gagal', error: r.error || '', template })
  return r
}