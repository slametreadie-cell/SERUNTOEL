-- ============================================================
-- 004_add_missing_columns.sql
-- Tambahan kolom untuk modul Hutang & Piutang (Prioritas 2).
-- Aman dijalankan berulang kali (idempotent).
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> New query
--   -> paste semua isi file ini -> Run
--
-- Catatan: 8 modul Prioritas 2 lainnya (Stok/Opname, Waste,
-- Kadaluarsa, Pre-Order, QC, Label Gizi, Karyawan, Duplikat
-- Produk) memakai kolom yang SUDAH ADA, jadi tidak butuh file ini.
-- Hanya modul Hutang/Piutang yang perlu kolom `dibayar` di bawah.
-- ============================================================

-- Kolom untuk melacak pembayaran sebagian (cicilan) hutang/piutang
ALTER TABLE receivables_payables
  ADD COLUMN IF NOT EXISTS dibayar DECIMAL(15,2) DEFAULT 0;

-- Isi nilai awal 0 untuk baris lama yang masih NULL
UPDATE receivables_payables SET dibayar = 0 WHERE dibayar IS NULL;

-- Verifikasi: harus muncul 1 baris dengan kolom `dibayar`
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'receivables_payables'
  AND column_name = 'dibayar';
