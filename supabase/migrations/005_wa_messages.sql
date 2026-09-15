-- ============================================================
-- Seruntul — Tabel log WhatsApp (strok & WA Blast)
-- Tempel seluruh blok ini di Supabase SQL Editor, lalu RUN.
-- Aman dijalankan ulang (pakai IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wa_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_transaksi text,
  customer_id uuid,
  nomor text NOT NULL,
  jenis text NOT NULL DEFAULT 'struk',        -- 'struk' | 'blast'
  isi text,
  status text NOT NULL DEFAULT 'terkirim',      -- 'terkirim' | 'gagal' | 'pending'
  error text,
  dikirim_at timestamptz NOT NULL DEFAULT now(),
  template text
);

-- Aktifkan RLS (aman: deny semua kecuali pemilik via policy di bawah)
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

-- Policy: anon/service_role diizinkan baca & tulis (aplikasi single-user owner)
DROP POLICY IF EXISTS wa_messages_all ON public.wa_messages;
CREATE POLICY wa_messages_all ON public.wa_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Kolom template untuk menyimpan template WA blast (key-value)
CREATE TABLE IF NOT EXISTS public.settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_all ON public.settings;
CREATE POLICY settings_all ON public.settings
  FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.settings (key, value) VALUES ('wa_templates', '[]')
  ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SELESAI. Setelah ini, pergi ke Pengaturan → WA Blast.
-- ============================================================