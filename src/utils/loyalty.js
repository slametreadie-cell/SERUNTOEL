/**
 * Logika loyalitas pelanggan: poin, tier, dan diskon tier.
 * Konfigurasi disimpan di tabel `loyalty_config` (key/value) dan `tier_config`.
 * Nilai di bawah hanya DEFAULT kalau baris konfigurasi belum ada.
 */

export const LOYALTY_DEFAULT = {
  aktif: 'true',
  poin_per_rupiah: '10000', // 1 poin setiap kelipatan Rp10.000
  nilai_poin: '100',        // 1 poin bernilai Rp100 saat ditukar
  min_tukar: '50',          // minimal poin yang boleh ditukar
}

export const TIER_DEFAULT = [
  { tier: 'bronze',   diskon_persen: 0, target_bulanan: 0,        keterangan: 'Pemula' },
  { tier: 'silver',   diskon_persen: 3, target_bulanan: 1000000,  keterangan: 'Total belanja ≥ Rp1jt' },
  { tier: 'gold',     diskon_persen: 5, target_bulanan: 3000000,  keterangan: 'Total belanja ≥ Rp3jt' },
  { tier: 'platinum', diskon_persen: 8, target_bulanan: 6000000,  keterangan: 'Total belanja ≥ Rp6jt' },
]

export const TIER_EMOJI = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }

export const ORDER_TIER = ['bronze', 'silver', 'gold', 'platinum']

/** Ambil konfigurasi loyalitas dengan default. */
export function parseLoyaltyConfig(rows = []) {
  const map = {}
  rows.forEach((r) => { map[r.key] = r.value })
  const num = (k) => Number(map[k] ?? LOYALTY_DEFAULT[k]) || 0
  return {
    aktif: String(map.aktif ?? LOYALTY_DEFAULT.aktif) !== 'false',
    poin_per_rupiah: num('poin_per_rupiah') || Number(LOYALTY_DEFAULT.poin_per_rupiah),
    nilai_poin: num('nilai_poin') || Number(LOYALTY_DEFAULT.nilai_poin),
    min_tukar: num('min_tukar'),
  }
}

/** Poin yang didapat dari sebuah total belanja. */
export function hitungPoin(total, poinPerRupiah) {
  if (!poinPerRupiah || poinPerRupiah <= 0) return 0
  return Math.floor((Number(total) || 0) / poinPerRupiah)
}

/** Nilai rupiah dari sejumlah poin yang ditukar. */
export function nilaiPoin(poin, nilaiPerPoin) {
  return (Number(poin) || 0) * (Number(nilaiPerPoin) || 0)
}

/** Tier otomatis berdasarkan total belanja member. */
export function tierDari(totalBelanja, tiers = TIER_DEFAULT) {
  let hasil = 'bronze'
  ORDER_TIER.forEach((t) => {
    const cfg = tiers.find((x) => x.tier === t)
    if (cfg && (Number(totalBelanja) || 0) >= (Number(cfg.target_bulanan) || 0)) hasil = t
  })
  return hasil
}

/** Diskon persen yang berlaku untuk sebuah tier. */
export function diskonTier(tier, tiers = TIER_DEFAULT) {
  const cfg = tiers.find((t) => t.tier === tier)
  return Number(cfg?.diskon_persen) || 0
}
