/**
 * API Admin — Manajemen User (khusus role owner/admin)
 *
 * Memakai SUPABASE_SERVICE_ROLE_KEY di sisi server untuk mengelola akun
 * Supabase Auth (buat, ubah password/email, hapus). Key ini TIDAK PERNAH
 * dikirim ke browser.
 *
 * Hanya pemanggil yang sudah login DAN rolenya owner/admin di tabel `users`
 * yang diizinkan.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const svcHeaders = () => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
})

/** Ambil user dari token pemanggil; null kalau tidak valid. */
async function userDariToken(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/** Cek apakah email pemanggil ber-role owner/admin. */
async function bolehKelola(email) {
  if (!email) return false
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/users?select=role&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: svcHeaders() }
  )
  if (!r.ok) return false
  const rows = await r.json()
  const role = rows?.[0]?.role
  if (role === 'owner' || role === 'admin') return true

  // BOOTSTRAP: kalau tabel users masih KOSONG (belum ada owner sama sekali),
  // izinkan pengguna login pertama mengelola user — mencegah lockout total.
  if (!rows || rows.length === 0) {
    const cekOwner = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id&role=in.(owner,admin)&limit=1`,
      { headers: svcHeaders() }
    )
    if (cekOwner.ok) {
      const ada = await cekOwner.json()
      if (!ada || ada.length === 0) return true   // belum ada owner -> bootstrap
    }
  }
  return false
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE) {
    return res.status(500).json({
      error: 'Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY tidak diset di Vercel).',
    })
  }

  // 1. Wajib login
  const pemanggil = await userDariToken(req)
  if (!pemanggil?.email) {
    return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' })
  }

  // 2. Wajib owner/admin
  if (!(await bolehKelola(pemanggil.email))) {
    return res.status(403).json({ error: 'Hanya owner atau admin yang bisa mengelola user.' })
  }

  const { aksi } = req.body || {}

  try {
    if (req.method === 'GET' || aksi === 'list') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: svcHeaders() })
      const d = await r.json()
      const users = (d.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        nama: u.user_metadata?.nama || u.user_metadata?.full_name || null,
        dibuat: u.created_at,
        login_terakhir: u.last_sign_in_at,
        terkonfirmasi: !!u.email_confirmed_at,
      }))
      return res.status(200).json({ users })
    }

    // ── TAMBAH USER ────────────────────────────────────────────
    if (aksi === 'create') {
      const { email, password, nama, role } = req.body
      if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' })
      if (String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' })

      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: svcHeaders(),
        body: JSON.stringify({
          email: String(email).trim().toLowerCase(),
          password,
          email_confirm: true, // langsung aktif, tanpa perlu verifikasi email
          user_metadata: { nama: nama || null },
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        const pesan = String(d.msg || d.message || d.error_description || '')
        return res.status(400).json({
          error: pesan.includes('already') || pesan.includes('registered')
            ? 'Email ini sudah terdaftar.'
            : pesan || 'Gagal membuat akun.',
        })
      }

      // catat ke tabel users (data & role)
      await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: d.id,
          email: String(email).trim().toLowerCase(),
          nama: nama || null,
          role: role || 'kasir',
        }),
      })

      return res.status(201).json({ ok: true, id: d.id, email: d.email })
    }

    // ── UBAH USER (email / password / nama) ────────────────────
    if (aksi === 'update') {
      const { id, email, password, nama } = req.body
      if (!id) return res.status(400).json({ error: 'ID user tidak diberikan.' })

      const body = {}
      if (email) body.email = String(email).trim().toLowerCase()
      if (password) {
        if (String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' })
        body.password = password
      }
      if (nama !== undefined) body.user_metadata = { nama: nama || null }
      if (email) body.email_confirm = true

      if (Object.keys(body).length) {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
          method: 'PUT', headers: svcHeaders(), body: JSON.stringify(body),
        })
        const d = await r.json()
        if (!r.ok) {
          const pesan = String(d.msg || d.message || d.error_description || '')
          return res.status(400).json({ error: pesan || 'Gagal memperbarui akun.' })
        }
      }

      // sinkronkan nama di tabel users
      if (nama !== undefined) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
          method: 'PATCH',
          headers: { ...svcHeaders(), Prefer: 'return=minimal' },
          body: JSON.stringify({ nama: nama || null }),
        })
      }

      return res.status(200).json({ ok: true })
    }

    // ── UBAH ROLE SAJA ─────────────────────────────────────────
    if (aksi === 'role') {
      const { id, email, role } = req.body
      const target = email ? `email=eq.${encodeURIComponent(email)}` : `id=eq.${id}`
      const r = await fetch(`${SUPABASE_URL}/rest/v1/users?${target}`, {
        method: 'PATCH',
        headers: { ...svcHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ role }),
      })
      if (!r.ok) return res.status(400).json({ error: 'Gagal mengubah role.' })
      return res.status(200).json({ ok: true })
    }

    // ── HAPUS USER ─────────────────────────────────────────────
    if (aksi === 'delete') {
      const { id, email } = req.body
      if (!id) return res.status(400).json({ error: 'ID user tidak diberikan.' })

      // jangan biarkan owner menghapus dirinya sendiri
      if (String(email || '').toLowerCase() === String(pemanggil.email).toLowerCase()) {
        return res.status(400).json({ error: 'Tidak bisa menghapus akun yang sedang dipakai.' })
      }

      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'DELETE', headers: svcHeaders(),
      })
      if (!r.ok && r.status !== 404) {
        const d = await r.json().catch(() => ({}))
        return res.status(400).json({ error: d.msg || d.message || 'Gagal menghapus akun.' })
      }

      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
        method: 'DELETE', headers: { ...svcHeaders(), Prefer: 'return=minimal' },
      })

      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Aksi tidak dikenal.' })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Kesalahan server.' })
  }
}
