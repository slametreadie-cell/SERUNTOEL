import { supabase } from './supabaseClient'

/**
 * Catat aktivitas ke tabel audit_logs.
 * Sengaja tidak pernah melempar error — kegagalan logging tidak boleh
 * menggagalkan aksi utama (transaksi, simpan produk, dll).
 */
export async function logAudit({ aksi, detail = {}, user = null, sheetTarget = null }) {
  try {
    await supabase.from('audit_logs').insert({
      aksi,
      detail_json: detail,
      user_email: user?.email || null,
      user_id: user?.id || null,
      sheet_target: sheetTarget,
    })
  } catch (e) {
    // diamkan — logging bersifat best-effort
  }
}
