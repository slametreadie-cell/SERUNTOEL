# 🐟 Seruntul Advanced

Aplikasi manajemen bisnis (POS, inventory, keuangan) berbasis **Next.js + Supabase + Vercel**.

## Struktur Proyek

```
src/
  pages/          # Halaman Next.js (pages router)
  components/     # Komponen React (AuthProvider, Login, Dashboard)
  utils/          # Klien Supabase bersama
supabase/
  migrations/     # Skema database (jalankan di SQL Editor Supabase)
```

## 1. Setup Supabase

1. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → pilih project Anda.
2. Buka **SQL Editor** → **New query**.
3. Salin seluruh isi `supabase/migrations/001_initial_schema.sql` → klik **Run**.
   - Skrip ini idempotent (aman dijalankan ulang).
   - Membuat semua tabel, RLS policy, trigger `updated_at`, trigger auto-profil saat signup, dan seed data.
4. Buka **Authentication → Providers → Email**: pastikan **Email** aktif.
5. Buat user pertama (owner) di **Authentication → Users → Add user**:
   - Email: mis. `owner@seruntul.com`, password kuat, ✓ **Auto Confirm User**.
   - Saat user ini pertama kali login, trigger `handle_new_user` otomatis membuat baris profilnya.
   - Untuk menjadikannya owner, jalankan di SQL Editor:
     ```sql
     UPDATE public.users SET role = 'owner' WHERE email = 'owner@seruntul.com';
     ```

## 2. Environment Variables

Salin `.env.example` menjadi `.env.local`, lalu isi:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

Kedua nilai ada di **Project Settings → API**. `.env.local` **tidak** di-commit (sudah diblokir `.gitignore`).

> ⚠️ **Keamanan:** file `.env.local` dan key `service_role` pernah ter-commit ke riwayat git sebelumnya. Segera **reset password database Supabase** dan **regenerate API keys** di Project Settings → API. Jangan pernah menaruh `service_role` di kode frontend.

## 3. Jalankan Lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) → otomatis diarahkan ke `/login`.

## 4. Push ke GitHub

```bash
git add .
git commit -m "Perbaikan: build Next.js + skema Supabase"
git push origin main
```

Remote sudah dikonfigurasi ke `slametreadie-cell/SERUNTUL`. Jika diminta login, gunakan Personal Access Token (bukan password) atau jalankan `gh auth login`.

## 5. Deploy ke Vercel

1. [vercel.com](https://vercel.com) → import project dari GitHub `slametreadie-cell/SERUNTUL`.
2. Framework preset: **Next.js** (terdeteksi otomatis dari `package.json`).
3. Di **Settings → Environment Variables**, tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview + Development).
4. Setiap push ke `main` akan memicu deploy otomatis.

> File `vercel.json` lama yang memaksa semua route ke `/` (penyebab 404) sudah dihapus — Vercel memakai konfigurasi bawaan Next.js.

## Langkah Berikutnya

- Halaman `/pos`, `/inventory`, `/finance` masih placeholder — hubungkan ke tabel `transactions`, `inventory`, `cashflow`.
- Tambahkan halaman `/settings` untuk mengelola tabel `configuration` dan `margin_categories`.
- Generate tipe TypeScript dari skema: `npx supabase gen types typescript --project-id <ref> > src/types/supabase.ts`.
