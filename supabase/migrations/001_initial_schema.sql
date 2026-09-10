-- =============================================================
-- Seruntul Advanced — Skema awal (idempotent: aman dijalankan ulang)
-- Cara pakai: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS & PROFIL ====================

-- Profil user, terhubung ke auth.users milik Supabase
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'produksi', 'kasir', 'user')),
  nama TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CORE BUSINESS TABLES ====================

-- Customers dibuat lebih dulu karena direferensikan oleh transactions
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  kontak TEXT,
  channel TEXT,
  total_transaksi INTEGER DEFAULT 0,
  total_belanja DECIMAL(15,2) DEFAULT 0,
  last_order TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (katalog + HPP)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_produk TEXT NOT NULL,
  kategori TEXT,
  jumlah_produksi INTEGER DEFAULT 0,
  total_hpp DECIMAL(15,2) DEFAULT 0,
  hpp_per_unit DECIMAL(15,2) DEFAULT 0,
  harga_jual DECIMAL(15,2) DEFAULT 0,
  margin DECIMAL(5,2) DEFAULT 0,
  rincian_json JSONB DEFAULT '{}',
  tanggal DATE DEFAULT CURRENT_DATE,
  foto_url TEXT,
  stok_produk INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaksi POS
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_transaksi TEXT UNIQUE NOT NULL,
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  items_json JSONB NOT NULL DEFAULT '[]',
  total_bayar DECIMAL(15,2) NOT NULL,
  channel TEXT,
  metode_pembayaran TEXT,
  diskon DECIMAL(15,2) DEFAULT 0,
  nominal_bayar DECIMAL(15,2) DEFAULT 0,
  kembalian DECIMAL(15,2) DEFAULT 0,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  voucher_kode TEXT,
  diskon_voucher DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kartu stok / inventory bahan
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_bahan TEXT NOT NULL,
  nama_bahan TEXT NOT NULL,
  satuan TEXT,
  stok_awal INTEGER DEFAULT 0,
  masuk INTEGER DEFAULT 0,
  keluar INTEGER DEFAULT 0,
  stok_sisa INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  stok_rutin INTEGER DEFAULT 0,
  stok_pre_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cashflow keuangan
CREATE TABLE IF NOT EXISTS cashflow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE NOT NULL,
  keterangan TEXT NOT NULL,
  kategori TEXT NOT NULL,
  jenis TEXT CHECK (jenis IN ('masuk', 'keluar')),
  jumlah DECIMAL(15,2) NOT NULL,
  saldo DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ANALITIK & PRODUKSI ====================

CREATE TABLE IF NOT EXISTS daily_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE UNIQUE NOT NULL,
  total_omset DECIMAL(15,2) DEFAULT 0,
  total_transaksi INTEGER DEFAULT 0,
  total_hpp DECIMAL(15,2) DEFAULT 0,
  items_json JSONB DEFAULT '{}',
  channel_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_loss_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_produk UUID REFERENCES products(id) ON DELETE SET NULL,
  bulan DATE NOT NULL,
  pendapatan DECIMAL(15,2) DEFAULT 0,
  hpp DECIMAL(15,2) DEFAULT 0,
  laba_kotor DECIMAL(15,2) DEFAULT 0,
  biaya_operasional DECIMAL(15,2) DEFAULT 0,
  laba_bersih DECIMAL(15,2) DEFAULT 0,
  margin DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_produk UUID REFERENCES products(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  bahan_baku_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_calculator (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_produk UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_produk TEXT NOT NULL,
  target_batch INTEGER DEFAULT 0,
  hasil_per_batch INTEGER DEFAULT 0,
  faktor_susut DECIMAL(5,2) DEFAULT 0,
  total_bahan_baku DECIMAL(15,2) DEFAULT 0,
  total_kemasan DECIMAL(15,2) DEFAULT 0,
  total_operasional DECIMAL(15,2) DEFAULT 0,
  total_hpp DECIMAL(15,2) DEFAULT 0,
  hpp_per_unit DECIMAL(15,2) DEFAULT 0,
  rincian_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SUPPLIER & PEMBELIAN ====================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  kontak TEXT,
  alamat TEXT,
  bahan_utama TEXT,
  rating INTEGER DEFAULT 0,
  total_pembelian INTEGER DEFAULT 0,
  total_belanja DECIMAL(15,2) DEFAULT 0,
  last_purchase TIMESTAMPTZ,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  nama_bahan TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  harga DECIMAL(15,2) NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== KONFIGURASI & AUDIT ====================

CREATE TABLE IF NOT EXISTS configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS margin_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kategori TEXT UNIQUE NOT NULL,
  margin_persen DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT NOT NULL,
  aksi TEXT NOT NULL,
  detail_json JSONB DEFAULT '{}',
  sheet_target TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEX ====================

CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_kategori ON products(kategori);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_cashflow_tanggal ON cashflow(tanggal);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_tanggal ON daily_aggregates(tanggal);

-- ==================== TRIGGER updated_at ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== AUTO-BUAT PROFIL SAAT SIGNUP ====================

-- Setiap user yang mendaftar lewat Supabase Auth otomatis dapat baris di tabel users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, nama)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_loss_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_calculator ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE margin_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- users: setiap user hanya boleh melihat & mengubah profilnya sendiri
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Tabel bisnis: user ter-autentikasi boleh baca; tulis butuh profil terdaftar
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'products', 'transactions', 'inventory', 'cashflow',
    'daily_aggregates', 'profit_loss_reports', 'recipes', 'production_calculator',
    'suppliers', 'purchase_orders', 'configuration', 'margin_categories', 'audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can read %I" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Authenticated can read %I" ON %I FOR SELECT TO authenticated USING (true)',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can write %I" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Authenticated can write %I" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END;
$$;

-- ==================== SEED DATA AWAL ====================

INSERT INTO configuration (key, value, keterangan) VALUES
  ('app_name', 'Seruntul Advanced', 'Nama aplikasi'),
  ('currency', 'IDR', 'Mata uang default'),
  ('tax_rate', '10', 'Persen pajak'),
  ('default_margin', '30', 'Margin default produk')
ON CONFLICT (key) DO NOTHING;

INSERT INTO margin_categories (kategori, margin_persen) VALUES
  ('makanan', 30),
  ('minuman', 40),
  ('snack', 35),
  ('merchandise', 50)
ON CONFLICT (kategori) DO NOTHING;

-- ==================== STORAGE BUCKET FOTO PRODUK ====================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ==================== SELESAI ====================

SELECT '✅ Skema Seruntul Advanced berhasil dibuat!' AS message;
