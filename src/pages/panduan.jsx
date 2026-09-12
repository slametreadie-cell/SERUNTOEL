import { useState } from 'react'
import Link from 'next/link'
import AppLayout from '../components/AppLayout'

const TAB = [
  { k: 'umum', l: '🚀 Mulai' },
  { k: 'produk', l: '🧾 Produk & HPP' },
  { k: 'kasir', l: '🏪 Kasir' },
  { k: 'stok', l: '📦 Stok' },
  { k: 'laporan', l: '📈 Laporan' },
  { k: 'fitur', l: '✨ Fitur Lanjutan' },
  { k: 'tips', l: '💡 Tips' },
]

const Langkah = ({ n, judul, children, link, linkLabel }) => (
  <div className="step">
    <div className="step-num">{n}</div>
    <div className="flex-1">
      <div className="font-bold">{judul}</div>
      <div className="text-sm text-muted">{children}</div>
      {link && <Link href={link} className="btn btn-sm btn-outline mt-2">{linkLabel || 'Buka'} →</Link>}
    </div>
  </div>
)

const Poin = ({ q, a }) => (
  <details className="faq">
    <summary>{q}</summary>
    <div className="text-sm text-muted">{a}</div>
  </details>
)

export default function Panduan() {
  const [tab, setTab] = useState('umum')

  return (
    <AppLayout title="Panduan" subtitle="Cara pakai aplikasi langkah demi langkah">
      <div className="card" style={{ padding: 8 }}>
        <div className="flex flex-wrap gap-2">
          {TAB.map((t) => (
            <button key={t.k} className={`btn btn-sm ${tab === t.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {tab === 'umum' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🚀</span> Mulai dari Sini</div></div>
          <p className="text-sm text-muted mb-3">
            Ikuti urutan ini agar aplikasi siap dipakai. Perkiraan waktu 15-20 menit.
          </p>
          <Langkah n="1" judul="Isi identitas toko" link="/settings" linkLabel="Pengaturan">
            Nama toko, alamat, telepon, dan ucapan di struk. Ini akan muncul di setiap struk yang dicetak.
          </Langkah>
          <Langkah n="2" judul="Buat kategori produk" link="/settings" linkLabel="Pengaturan">
            Kategori dipakai untuk mengelompokkan produk (mis. Makanan, Minuman, Frozen).
          </Langkah>
          <Langkah n="3" judul="Catat bahan baku" link="/inventory" linkLabel="Inventory">
            Masukkan bahan yang Anda pakai beserta harga beli. Harga ini dipakai untuk menghitung HPP.
          </Langkah>
          <Langkah n="4" judul="Buat produk + hitung HPP" link="/produk-hpp" linkLabel="Produk & HPP">
            Tentukan nama, harga jual, dan HPP. HPP bisa dihitung dari resep bahan. Upload foto agar kasir mudah mengenali.
          </Langkah>
          <Langkah n="5" judul="Takarkan stok awal" link="/inventory/stok" linkLabel="Stok & Opname">
            Hitung barang fisik di gudang, lalu koreksi stok sistem agar sesuai.
          </Langkah>
          <Langkah n="6" judul="Mulai jualan di POS" link="/pos" linkLabel="POS Kasir">
            Pilih produk → bayar → cetak struk. Stok otomatis berkurang.
          </Langkah>
          <Langkah n="7" judul="Tutup kas setiap akhir shift" link="/kasir/tutup" linkLabel="Tutup Kas">
            Hitung uang laci dan bandingkan dengan catatan sistem. Selisih otomatis dihitung.
          </Langkah>

          <div className="alert alert-info mt-3">
            💡 Sudah pernah pakai aplikasi versi lama? Data lama tidak otomatis pindah — masukkan ulang produk dan bahan
            satu kali, setelah itu semuanya otomatis.
          </div>
        </div>
      )}

      {tab === 'produk' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🧾</span> Produk & HPP</div></div>
          <Langkah n="1" judul="Tambahkan bahan dulu" link="/inventory" linkLabel="Inventory">
            Menu Inventory → tambah bahan. Isi nama, satuan, harga beli, dan supplier. Harga beli terakhir dipakai sebagai HPP bahan.
          </Langkah>
          <Langkah n="2" judul="Buat resep produk" link="/produksi" linkLabel="Resep Produksi">
            Menu Resep Produksi → pilih produk → masukkan bahan & qty. Sistem menjumlahkan biaya bahan per produk.
          </Langkah>
          <Langkah n="3" judul="Buat produk" link="/produk-hpp/baru" linkLabel="Produk Baru">
            Isi nama, kategori, jumlah produksi, HPP per unit, dan harga jual. Margin dihitung otomatis.
          </Langkah>
          <Langkah n="4" judul="Produk mirip? Pakai Duplikat" link="/produk-hpp/duplikat" linkLabel="Duplikat Produk">
            Menyalin produk yang sudah ada (termasuk foto) supaya tidak perlu entri dari nol.
          </Langkah>

          <div className="alert alert-warning">
            <b>Penting:</b> HPP harus benar. Semua laporan laba dan diagnosis bisnis bergantung pada angka HPP ini.
            HPP yang salah membuat laporan rugi terlihat untung.
          </div>
        </div>
      )}

      {tab === 'kasir' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">🏪</span> Panduan Kasir</div></div>
          <Langkah n="1" judul="Buka POS Kasir" link="/pos" linkLabel="POS Kasir">
            Cari produk, lalu klik untuk memasukkan ke keranjang.
          </Langkah>
          <Langkah n="2" judul="Atur channel penjualan">
            Pilih <b>Offline</b>, <b>Online</b>, atau <b>Reseller</b>. Channel Reseller otomatis memberi diskon
            (atur besarnya di menu Reseller).
          </Langkah>
          <Langkah n="3" judul="Diskon & Voucher">
            Ada dua jenis: <b>Diskon manual</b> (persen atau nominal) dan <b>Voucher</b> (masukkan kode lalu klik Pakai).
            Voucher yang kedaluwarsa akan ditolak otomatis.
          </Langkah>
          <Langkah n="4" judul="Poin pelanggan" link="/loyalty" linkLabel="Loyalty">
            Cari nama member atau daftarkan baru langsung di POS. Member bisa menukar poin jadi potongan harga.
          </Langkah>
          <Langkah n="5" judul="Bayar & cetak struk">
            Pilih metode bayar, isi nominal (ada tombol Uang Pas / Rp50rb / Rp100rb), lalu klik Bayar.
            Struk muncul otomatis — klik 🖨️ untuk mencetak.
          </Langkah>
          <Langkah n="6" judul="Tutup kas" link="/kasir/tutup" linkLabel="Tutup Kas">
            Akhir shift: masukkan modal awal dan hasil hitung uang fisik. Sistem menghitung selisih.
          </Langkah>
          <Langkah n="7" judul="Cari transaksi lama" link="/kasir" linkLabel="Riwayat Transaksi">
            Filter berdasarkan tanggal, metode bayar, atau channel. Bisa cetak ulang struk.
          </Langkah>

          <div className="alert alert-info">
            🖨️ Untuk mencetak struk, izinkan <b>popup</b> untuk situs ini di browser Anda.
          </div>
        </div>
      )}

      {tab === 'stok' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">📦</span> Kelola Stok</div></div>
          <Langkah n="1" judul="Catat stok opname rutin" link="/inventory/stok" linkLabel="Stok & Opname">
            Hitung barang fisik, isi hasilnya, sistem mencatat selisih dan alasannya. Lakukan minimal 1x seminggu.
          </Langkah>
          <Langkah n="2" judul="Catat barang rusak/terbuang" link="/gudang/waste" linkLabel="Waste Log">
            Setiap produk basi atau rusak dicatat di sini. Stok berkurang otomatis dan kerugian dihitung dari HPP.
          </Langkah>
          <Langkah n="3" judul="Pantau masa simpan" link="/gudang/kadaluarsa" linkLabel="Produk Kadaluarsa">
            Catat batch produksi. Sistem mengingatkan batch yang mendekati kedaluwarsa (≤2 hari ditandai kritis).
          </Langkah>
          <Langkah n="4" judul="Lihat rencana produksi" link="/forecast-doh" linkLabel="Forecast & DOH">
            Menampilkan berapa hari stok akan bertahan dan berapa yang perlu diproduksi agar stok aman.
          </Langkah>
        </div>
      )}

      {tab === 'laporan' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">📈</span> Laporan</div></div>
          <Langkah n="1" judul="Laporan Penjualan" link="/laporan" linkLabel="Laporan">
            Omset, laba kotor, produk terlaris, rincian per metode bayar dan channel. Bisa difilter per periode.
          </Langkah>
          <Langkah n="2" judul="Laporan Laba Rugi (P&L)" link="/laba-rugi" linkLabel="Laba Rugi">
            Laporan lengkap: pendapatan − HPP = laba kotor, dikurangi biaya operasional = <b>laba bersih</b>.
            Ini laporan paling penting untuk mengetahui apakah bisnis benar-benar untung.
          </Langkah>
          <Langkah n="3" judul="Diagnosis Bisnis" link="/diagnosis" linkLabel="Diagnosis">
            Memberi <b>skor kesehatan bisnis 0-100</b> beserta rekomendasi konkret: margin terlalu tipis,
            produk terlalu dominan, waste tinggi, dan lainnya.
          </Langkah>
          <Langkah n="4" judul="Export Excel / PDF">
            Di halaman Laporan dan Laba Rugi ada tombol <b>📊 Excel/CSV</b> dan <b>📄 PDF</b> untuk menyimpan
            atau mengirim laporan ke pihak lain.
          </Langkah>
        </div>
      )}

      {tab === 'fitur' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">✨</span> Fitur Lanjutan</div></div>
          <Langkah n="1" judul="Program loyalitas & tier" link="/loyalty" linkLabel="Loyalty">
            Atur berapa rupiah per 1 poin dan nilai tukarnya. Member naik tier otomatis (bronze → platinum) sesuai total belanja,
            dan tiap tier bisa punya diskon berbeda.
          </Langkah>
          <Langkah n="2" judul="Pre-Order" link="/preorder" linkLabel="Pre-Order">
            Catat pesanan pelanggan sebelum produksi, lengkap dengan DP dan sisa pembayaran.
          </Langkah>
          <Langkah n="3" judul="Hutang & Piutang" link="/keuangan/hutang" linkLabel="Hutang & Piutang">
            Catat tagihan ke pelanggan dan kewajiban ke supplier. Bisa bayar bertahap; setiap pembayaran otomatis tercatat di Cashflow.
          </Langkah>
          <Langkah n="4" judul="QC Checklist" link="/qc" linkLabel="QC Checklist">
            Pemeriksaan kualitas produksi dengan skor kepatuhan. Berguna untuk menjaga standar rasa dan kebersihan.
          </Langkah>
          <Langkah n="5" judul="Label Gizi" link="/label-gizi" linkLabel="Label Gizi">
            Buat label informasi nilai gizi untuk kemasan produk, siap dicetak.
          </Langkah>
          <Langkah n="6" judul="Karyawan & Absensi" link="/karyawan" linkLabel="Karyawan">
            Data karyawan, gaji, shift, dan absensi harian. Ada rekap 30 hari per orang.
          </Langkah>
          <Langkah n="7" judul="Target & Budget" link="/target" linkLabel="Target">
            Tetapkan target omset mingguan, target laba, dan budget operasional. Halaman ini menampilkan % pencapaian real-time.
          </Langkah>
          <Langkah n="8" judul="Forecast & Simulasi" link="/forecast" linkLabel="Simulasi">
            Uji skenario: kalau harga bahan naik 10%, bagaimana laba Anda? Berguna sebelum menaikkan harga jual.
          </Langkah>
        </div>
      )}

      {tab === 'tips' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="nav-icon">💡</span> Tips & Pertanyaan Umum</div></div>

          <Poin q="Kenapa laporan laba saya berbeda dari perkiraan?"
            a="Penyebab paling umum: HPP belum diisi atau salah. Pastikan setiap produk punya HPP per unit yang benar, dan setiap bahan punya harga beli terbaru. Laba kotor = omset − (HPP × qty terjual)." />

          <Poin q="Stok tidak cocok dengan barang fisik, bagaimana?"
            a="Gunakan menu Stok & Opname. Hitung fisik, masukkan hasilnya, dan sistem akan mengoreksi sekaligus mencatat selisih beserta alasannya. Lakukan rutin supaya laporan tetap akurat." />

          <Poin q="Bagaimana memberi harga khusus untuk reseller?"
            a="Menu Reseller → atur 'Diskon Otomatis (%)'. Saat kasir memilih channel Reseller di POS, diskon langsung diterapkan otomatis." />

          <Poin q="Pelanggan komplain tidak bisa tukar poin?"
            a="Cek di menu Loyalty → Aturan Poin: pastikan statusnya Aktif, dan minimal poin bisa ditukar sudah terpenuhi. Contoh: min 50 poin, berarti pelanggan butuh minimal 50 poin." />

          <Poin q="Struk tidak mau muncul saat diklik?"
            a="Browser memblokir popup. Klik ikon popup di address bar dan pilih 'Selalu izinkan' untuk situs ini, lalu klik ulang tombol struk." />

          <Poin q="Bisakah dipakai untuk beberapa jenis usaha?"
            a="Bisa. Satuan bahan mendukung kg/gram/liter/ml/pcs/pack/ikat, dan harga jual, diskon, serta poin semuanya bisa diatur sendiri. Struktur data tidak terikat pada satu jenis produk." />

          <Poin q="Apakah data aman kalau laptop mati?"
            a="Ya. Semua data tersimpan di Supabase (cloud), bukan di laptop. Anda bisa lanjut dari perangkat lain dengan login yang sama." />

          <Poin q="Berapa sering sebaiknya tutup kas?"
            a="Setiap akhir shift atau minimal sekali sehari. Ini membantu mendeteksi selisih uang lebih cepat sebelum menumpuk." />
        </div>
      )}

      <style jsx>{`
        .step { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px dashed var(--border); }
        .step-num { width: 26px; height: 26px; border-radius: 50%; background: var(--primary); color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; }
        .faq { border-bottom: 1px solid var(--border); padding: 10px 0; }
        .faq summary { cursor: pointer; font-weight: 600; font-size: 14px; }
        .faq > div { padding-top: 6px; }
      `}</style>
    </AppLayout>
  )
}
