-- ============================================================
-- 003_fix_rls_policies.sql
-- Tujuan: memperbaiki RLS yang memblokir SEMUA tulis/baca dari aplikasi.
--
-- MASALAH: migration 001 mengaktifkan Row Level Security di banyak tabel
-- tetapi TIDAK membuat satu pun policy. Di PostgreSQL, RLS aktif tanpa
-- policy = tidak ada baris yang boleh dibaca/ditulis. Akibatnya aplikasi
-- hanya bisa menampilkan halaman kosong dan semua simpan gagal dengan
-- error 42501 "new row violates row-level security policy".
--
-- SOLUSI: buat policy untuk role `authenticated` (pengguna yang sudah
-- login lewat Supabase Auth). Role `anon` (belum login) sengaja TIDAK
-- diberi akses ke tabel bisnis, sehingga data tetap aman.
--
-- Aman dijalankan berulang kali (idempotent).
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- ── 1. Pastikan RLS aktif di semua tabel public ──────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ── 2. Hapus policy lama dengan nama yang sama (biar idempotent) ──
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_full_access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_only" ON public.%I', t);
  END LOOP;
END $$;

-- ── 3. Policy utama: pengguna login boleh baca & tulis penuh ──
--    (menggantikan model Google Apps Script yang berbasis satu spreadsheet)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'CREATE POLICY "auth_full_access" ON public.%I
         FOR ALL
         TO authenticated
         USING (true)
         WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ── 4. Khusus tabel `users`: izinkan baca untuk yang login ──
--    (sudah tercakup policy di atas; blok ini hanya jaring pengaman)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ── 5. Default privilege agar tabel baru otomatis bisa dipakai ──
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO authenticated;

-- ── 6. Verifikasi ────────────────────────────────────────────
-- Setelah menjalankan query ini, cek hasilnya:
SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname='public')                     AS total_tabel,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public')                   AS total_policy,
  (SELECT count(DISTINCT tablename) FROM pg_policies
     WHERE schemaname='public' AND policyname='auth_full_access')                AS tabel_terlindungi;
