-- ============================================================
-- Seruntul — Kolom ongkir untuk transaksi online
-- Tempel di Supabase SQL Editor lalu RUN.
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ongkir DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Catatan: total_bayar POS sekarang sudah INCLUDE ongkir.
-- Ongkir disimpan terpisah biar bisa dianalisis / dibatalkan.
-- ============================================================
-- SELESAI.
-- ============================================================