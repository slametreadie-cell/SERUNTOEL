-- ============================================================
-- SERUNTUL ADVANCED — FULL DATABASE SCHEMA (migration 002)
-- PostgreSQL / Supabase
-- Lebih advance dari Google Sheets: relasi FK, enum, trigger, RLS
-- ============================================================

-- ============================================================
-- 0. RESET (data masih kosong, aman untuk drop & rebuild)
-- ============================================================
DROP TABLE IF EXISTS cash_closings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS waste_logs CASCADE;
DROP TABLE IF EXISTS voucher_usages CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS loyalty_history CASCADE;
DROP TABLE IF EXISTS loyalty_members CASCADE;
DROP TABLE IF EXISTS loyalty_config CASCADE;
DROP TABLE IF EXISTS nutrition_labels CASCADE;
DROP TABLE IF EXISTS qc_checklists CASCADE;
DROP TABLE IF EXISTS tier_config CASCADE;
DROP TABLE IF EXISTS pre_orders CASCADE;
DROP TABLE IF EXISTS receivables_payables CASCADE;
DROP TABLE IF EXISTS expired_products CASCADE;
DROP TABLE IF EXISTS notification_config CASCADE;
DROP TABLE IF EXISTS legal_config CASCADE;
DROP TABLE IF EXISTS configuration CASCADE;
DROP TABLE IF EXISTS target_budgets CASCADE;
DROP TABLE IF EXISTS simulation_scenarios CASCADE;
DROP TABLE IF EXISTS hpp_calculations CASCADE;
DROP TABLE IF EXISTS profit_loss_reports CASCADE;
DROP TABLE IF EXISTS daily_aggregates CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS finished_goods_inventory CASCADE;
DROP TABLE IF EXISTS stock_cards CASCADE;
DROP TABLE IF EXISTS supplier_purchases CASCADE;
DROP TABLE IF EXISTS ingredient_prices CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS resellers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS cashflow CASCADE;
DROP TABLE IF EXISTS margin_categories CASCADE;

-- ============================================================
-- 1. EXTENSION & ENUM TYPES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'produksi', 'kasir', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales_channel AS ENUM ('offline', 'online', 'reseller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'transfer', 'ewallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cashflow_type AS ENUM ('masuk', 'keluar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE debt_status AS ENUM ('aktif', 'lunas', 'lewat_tempo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'dp', 'lunas', 'selesai', 'batal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE voucher_type AS ENUM ('persen', 'nominal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('hadir', 'izin', 'sakit', 'alpa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expiry_status AS ENUM ('aktif', 'kadaluarsa', 'habis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. USER & AUTH
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  nama TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. MASTER DATA
-- ============================================================

-- Kategori produk (advance: kategori terpisah, bukan string bebas)
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT UNIQUE NOT NULL,
  margin_persen DECIMAL(5,2) DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pelanggan
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  kontak TEXT,
  channel sales_channel DEFAULT 'offline',
  total_transaksi INTEGER DEFAULT 0,
  total_belanja DECIMAL(15,2) DEFAULT 0,
  last_order TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reseller (extends customers)
CREATE TABLE resellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  kontak TEXT,
  alamat TEXT,
  tier TEXT,
  tgl_gabung DATE DEFAULT CURRENT_DATE,
  total_transaksi INTEGER DEFAULT 0,
  total_belanja DECIMAL(15,2) DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier
CREATE TABLE suppliers (
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

-- ============================================================
-- 4. PRODUK & RESEP
-- ============================================================

-- Produk jadi (Produk_HPP)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_produk TEXT NOT NULL,
  kategori_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
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

-- Resep standar (ResepStandar)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  bahan_baku_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bahan baku (advance: bahan jadi entitas, bukan hanya kartu stok)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_bahan TEXT NOT NULL,
  satuan TEXT DEFAULT 'pcs',
  stok_sisa INTEGER DEFAULT 0,
  stok_minimum INTEGER DEFAULT 5,
  stok_rutin INTEGER DEFAULT 0,
  stok_pre_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'aktif',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Harga bahan harian (Harga_Bahan_Harian)
CREATE TABLE ingredient_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bahan_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  nama_bahan TEXT NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  harga DECIMAL(15,2) DEFAULT 0,
  satuan TEXT DEFAULT 'pcs',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kartu stok (Kartu_Stok)
CREATE TABLE stock_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bahan_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  nama_bahan TEXT NOT NULL,
  satuan TEXT DEFAULT 'pcs',
  stok_awal INTEGER DEFAULT 0,
  masuk INTEGER DEFAULT 0,
  keluar INTEGER DEFAULT 0,
  stok_sisa INTEGER DEFAULT 0,
  status TEXT DEFAULT 'aktif',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory produk jadi (Inventory_Produk_Jadi)
CREATE TABLE finished_goods_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
  nama_produk TEXT NOT NULL,
  tanggal DATE DEFAULT CURRENT_DATE,
  stok INTEGER DEFAULT 0,
  kategori TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TRANSAKSI / POS
-- ============================================================

-- Transaksi POS (advance: item terpisah di transaction_items, bukan JSON)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_transaksi TEXT UNIQUE NOT NULL,
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  total_bayar DECIMAL(15,2) NOT NULL DEFAULT 0,
  channel sales_channel DEFAULT 'offline',
  metode_pembayaran payment_method DEFAULT 'cash',
  diskon DECIMAL(15,2) DEFAULT 0,
  nominal_bayar DECIMAL(15,2) DEFAULT 0,
  kembalian DECIMAL(15,2) DEFAULT 0,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer TEXT,
  voucher_kode TEXT,
  diskon_voucher DECIMAL(15,2) DEFAULT 0,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item transaksi (advance: relasional, lebih mudah dianalisis)
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaksi_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  produk_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_produk TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  harga_satuan DECIMAL(15,2) NOT NULL DEFAULT 0,
  hpp_satuan DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. KEUANGAN
-- ============================================================

-- Cashflow
CREATE TABLE cashflow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT NOT NULL,
  kategori TEXT NOT NULL,
  jenis cashflow_type NOT NULL DEFAULT 'masuk',
  jumlah DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregat harian (Daily_Aggregate)
CREATE TABLE daily_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE UNIQUE NOT NULL,
  total_omset DECIMAL(15,2) DEFAULT 0,
  total_transaksi INTEGER DEFAULT 0,
  total_hpp DECIMAL(15,2) DEFAULT 0,
  items_json JSONB DEFAULT '{}',
  channel_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Laporan laba rugi (Laporan_Laba_Rugi)
CREATE TABLE profit_loss_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE SET NULL,
  bulan DATE NOT NULL,
  pendapatan DECIMAL(15,2) DEFAULT 0,
  hpp DECIMAL(15,2) DEFAULT 0,
  laba_kotor DECIMAL(15,2) DEFAULT 0,
  biaya_operasional DECIMAL(15,2) DEFAULT 0,
  laba_bersih DECIMAL(15,2) DEFAULT 0,
  margin DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hutang piutang (Hutang_Piutang)
CREATE TABLE receivables_payables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  nama_customer TEXT,
  jenis TEXT NOT NULL, -- 'hutang' atau 'piutang'
  jumlah DECIMAL(15,2) NOT NULL DEFAULT 0,
  jatuh_tempo DATE,
  status debt_status DEFAULT 'aktif',
  keterangan TEXT,
  tgl_lunas DATE,
  metode_bayar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre order
CREATE TABLE pre_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tgl_order DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  nama_customer TEXT,
  kontak TEXT,
  produk TEXT,
  qty INTEGER DEFAULT 0,
  harga DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  dp DECIMAL(15,2) DEFAULT 0,
  sisa DECIMAL(15,2) DEFAULT 0,
  status order_status DEFAULT 'pending',
  tgl_target DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tutup kas (Tutup_Kas)
CREATE TABLE cash_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  saldo_sistem DECIMAL(15,2) DEFAULT 0,
  uang_fisik DECIMAL(15,2) DEFAULT 0,
  selisih DECIMAL(15,2) DEFAULT 0,
  penjualan_hari_ini DECIMAL(15,2) DEFAULT 0,
  trx_hari_ini INTEGER DEFAULT 0,
  modal_awal DECIMAL(15,2) DEFAULT 0,
  catatan TEXT,
  user_email TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PRODUKSI & ANALISIS
-- ============================================================

-- Kalkulator HPP
CREATE TABLE hpp_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
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

-- Simulasi skenario
CREATE TABLE simulation_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  kenaikan_bahan DECIMAL(5,2) DEFAULT 0,
  penurunan_penjualan DECIMAL(5,2) DEFAULT 0,
  kenaikan_op DECIMAL(5,2) DEFAULT 0,
  perubahan_margin DECIMAL(5,2) DEFAULT 0,
  hpp_baru DECIMAL(15,2) DEFAULT 0,
  harga_jual_baru DECIMAL(15,2) DEFAULT 0,
  laba_unit DECIMAL(15,2) DEFAULT 0,
  margin_baru DECIMAL(5,2) DEFAULT 0,
  bep_baru DECIMAL(15,2) DEFAULT 0,
  saldo_proyeksi DECIMAL(15,2) DEFAULT 0,
  bulan_bertahan DECIMAL(5,1) DEFAULT 0,
  keterangan TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Target budget
CREATE TABLE target_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bulan DATE NOT NULL,
  m1 DECIMAL(15,2) DEFAULT 0,
  m2 DECIMAL(15,2) DEFAULT 0,
  m3 DECIMAL(15,2) DEFAULT 0,
  m4 DECIMAL(15,2) DEFAULT 0,
  target_profit DECIMAL(15,2) DEFAULT 0,
  budget_op DECIMAL(15,2) DEFAULT 0,
  budget_mk DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. OPERASIONAL
-- ============================================================

-- Pembelian supplier
CREATE TABLE supplier_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  bahan_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  nama_bahan TEXT,
  qty INTEGER DEFAULT 0,
  harga DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produk kadaluarsa
CREATE TABLE expired_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_produk TEXT,
  batch_id TEXT,
  tgl_produksi DATE,
  masa_simpan INTEGER DEFAULT 0, -- hari
  tgl_kadaluarsa DATE,
  qty INTEGER DEFAULT 0,
  sisa_qty INTEGER DEFAULT 0,
  status expiry_status DEFAULT 'aktif',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QC checklist
CREATE TABLE qc_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  petugas TEXT,
  jenis TEXT,
  items_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Label gizi
CREATE TABLE nutrition_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produk_id UUID REFERENCES products(id) ON DELETE CASCADE,
  nama_produk TEXT,
  takaran_saji TEXT,
  kalori DECIMAL(10,2) DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  lemak DECIMAL(10,2) DEFAULT 0,
  karbohidrat DECIMAL(10,2) DEFAULT 0,
  gula DECIMAL(10,2) DEFAULT 0,
  natrium DECIMAL(10,2) DEFAULT 0,
  serat DECIMAL(10,2) DEFAULT 0,
  tanggal DATE DEFAULT CURRENT_DATE,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waste log
CREATE TABLE waste_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  produk_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_produk TEXT,
  qty_waste INTEGER DEFAULT 0,
  alasan TEXT,
  biaya_hpp DECIMAL(15,2) DEFAULT 0,
  petugas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. LOYALTY & VOUCHER
-- ============================================================

-- Loyalty member
CREATE TABLE loyalty_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  kontak TEXT,
  poin INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze',
  total_transaksi INTEGER DEFAULT 0,
  total_belanja DECIMAL(15,2) DEFAULT 0,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty riwayat
CREATE TABLE loyalty_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  jenis TEXT, -- 'tambah' / 'tukar'
  poin INTEGER DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voucher
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode TEXT UNIQUE NOT NULL,
  tipe voucher_type DEFAULT 'persen',
  nilai DECIMAL(15,2) DEFAULT 0,
  kategori TEXT,
  tanggal_mulai DATE,
  tanggal_berakhir DATE,
  aktif BOOLEAN DEFAULT TRUE,
  deskripsi TEXT,
  total_dipakai INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voucher usage
CREATE TABLE voucher_usages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  kode_voucher TEXT,
  transaksi_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer TEXT,
  tanggal_pakai TIMESTAMPTZ DEFAULT NOW(),
  diskon DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. SDM (KARYAWAN)
-- ============================================================

-- Karyawan
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama TEXT NOT NULL,
  kontak TEXT,
  jabatan TEXT,
  gaji DECIMAL(15,2) DEFAULT 0,
  tgl_masuk DATE,
  status TEXT DEFAULT 'aktif',
  shift TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Absensi
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal DATE DEFAULT CURRENT_DATE,
  karyawan_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  nama TEXT,
  status attendance_status DEFAULT 'hadir',
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. KONFIGURASI
-- ============================================================

-- Konfigurasi umum (key-value)
CREATE TABLE configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Konfigurasi legal
CREATE TABLE legal_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Konfigurasi notifikasi
CREATE TABLE notification_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Konfigurasi tier reseller
CREATE TABLE tier_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier TEXT UNIQUE NOT NULL,
  diskon_persen DECIMAL(5,2) DEFAULT 0,
  target_bulanan DECIMAL(15,2) DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Konfigurasi loyalty
CREATE TABLE loyalty_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Margin kategori (legacy alias, tetap dipertahankan)
CREATE TABLE margin_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kategori TEXT UNIQUE NOT NULL,
  margin_persen DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  aksi TEXT NOT NULL,
  detail_json JSONB DEFAULT '{}',
  sheet_target TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. TRIGGER updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','customers','resellers','suppliers','products','recipes','ingredients',
    'receivables_payables','pre_orders','employees','loyalty_members','configuration'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 14. INDEXES (performa)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaksi ON transaction_items(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_produk ON transaction_items(produk_id);
CREATE INDEX IF NOT EXISTS idx_products_kategori ON products(kategori_id);
CREATE INDEX IF NOT EXISTS idx_products_nama ON products(nama_produk);
CREATE INDEX IF NOT EXISTS idx_cashflow_tanggal ON cashflow(tanggal);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_tanggal ON daily_aggregates(tanggal);
CREATE INDEX IF NOT EXISTS idx_ingredients_nama ON ingredients(nama_bahan);
CREATE INDEX IF NOT EXISTS idx_stock_cards_bahan ON stock_cards(bahan_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_tanggal ON supplier_purchases(tanggal);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables_payables(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tanggal ON audit_logs(tanggal);
CREATE INDEX IF NOT EXISTS idx_vouchers_kode ON vouchers(kode);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal ON attendance(tanggal);
CREATE INDEX IF NOT EXISTS idx_employees_nama ON employees(nama);

-- ============================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: user authenticated bisa baca semua (untuk MVP multi-modul)
-- Bisa diperketat per role nanti.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','products','transactions','transaction_items','customers','cashflow',
    'daily_aggregates','ingredients','suppliers','employees','audit_logs',
    'product_categories','recipes','ingredient_prices','stock_cards',
    'finished_goods_inventory','profit_loss_reports','receivables_payables',
    'pre_orders','cash_closings','hpp_calculations','simulation_scenarios',
    'target_budgets','supplier_purchases','expired_products','qc_checklists',
    'nutrition_labels','waste_logs','loyalty_members','loyalty_history',
    'vouchers','voucher_usages','attendance','configuration','legal_config',
    'notification_config','tier_config','loyalty_config','margin_categories'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "authenticated_read_%I" ON %I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_write_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "authenticated_write_%I" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 16. SEED DATA
-- ============================================================
INSERT INTO configuration (key, value, keterangan) VALUES
  ('app_name', 'Seruntul Advanced', 'Nama aplikasi'),
  ('currency', 'IDR', 'Mata uang default'),
  ('tax_rate', '0', 'Persentase pajak (PPN)'),
  ('default_margin', '30', 'Margin default produk (%)'),
  ('low_stock_threshold', '5', 'Ambang stok minimum')
ON CONFLICT (key) DO NOTHING;

INSERT INTO product_categories (nama, margin_persen, keterangan) VALUES
  ('Makanan', 30, 'Produk makanan jadi'),
  ('Minuman', 40, 'Produk minuman'),
  ('Snack', 35, 'Camilan'),
  ('Merchandise', 50, 'Produk non-makanan')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO margin_categories (kategori, margin_persen) VALUES
  ('Makanan', 30),
  ('Minuman', 40),
  ('Snack', 35),
  ('Merchandise', 50)
ON CONFLICT (kategori) DO NOTHING;

INSERT INTO tier_config (tier, diskon_persen, target_bulanan, keterangan) VALUES
  ('bronze', 0, 0, 'Reseller baru'),
  ('silver', 5, 1000000, 'Reseller reguler'),
  ('gold', 10, 5000000, 'Reseller aktif'),
  ('platinum', 15, 15000000, 'Reseller utama')
ON CONFLICT (tier) DO NOTHING;

INSERT INTO loyalty_config (key, value, keterangan) VALUES
  ('poin_per_rp', '10000', 'Poin diberikan per kelipatan Rp'),
  ('nilai_per_poin', '1000', 'Nilai tukar 1 poin (Rp)'),
  ('tier_bronze_min', '0', 'Ambang bronze'),
  ('tier_silver_min', '500', 'Ambang silver'),
  ('tier_gold_min', '2000', 'Ambang gold')
ON CONFLICT (key) DO NOTHING;

INSERT INTO notification_config (key, value, keterangan) VALUES
  ('stok_kritis', 'true', 'Notifikasi saat stok menipis'),
  ('kadaluarsa', 'true', 'Notifikasi produk hampir kadaluarsa'),
  ('hutang_jatuh_tempo', 'true', 'Notifikasi hutang jatuh tempo')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 17. FUNGSI BANTUAN
-- ============================================================

-- Fungsi hitung agregat harian
CREATE OR REPLACE FUNCTION refresh_daily_aggregate(p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_aggregates (tanggal, total_omset, total_transaksi, total_hpp)
  SELECT
    DATE(t.tanggal),
    COALESCE(SUM(t.total_bayar), 0),
    COUNT(t.id),
    COALESCE(SUM(COALESCE((ti.hpp_satuan * ti.qty), 0)), 0)
  FROM transactions t
  LEFT JOIN transaction_items ti ON ti.transaksi_id = t.id
  WHERE DATE(t.tanggal) = p_date
  GROUP BY DATE(t.tanggal)
  ON CONFLICT (tanggal) DO UPDATE SET
    total_omset = EXCLUDED.total_omset,
    total_transaksi = EXCLUDED.total_transaksi,
    total_hpp = EXCLUDED.total_hpp;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SELESAI
-- ============================================================
SELECT '✅ Skema database Seruntul Advanced berhasil dibuat!' AS hasil;
