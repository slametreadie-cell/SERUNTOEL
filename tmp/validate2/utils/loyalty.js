export const LOYALTY_DEFAULT = {
  aktif: "true",
  poin_per_rupiah: "10000",
  // 1 poin setiap kelipatan Rp10.000
  nilai_poin: "100",
  // 1 poin bernilai Rp100 saat ditukar
  min_tukar: "50"
  // minimal poin yang boleh ditukar
};
export const TIER_DEFAULT = [
  { tier: "bronze", diskon_persen: 0, target_bulanan: 0, keterangan: "Pemula" },
  { tier: "silver", diskon_persen: 3, target_bulanan: 1e6, keterangan: "Total belanja \u2265 Rp1jt" },
  { tier: "gold", diskon_persen: 5, target_bulanan: 3e6, keterangan: "Total belanja \u2265 Rp3jt" },
  { tier: "platinum", diskon_persen: 8, target_bulanan: 6e6, keterangan: "Total belanja \u2265 Rp6jt" }
];
export const TIER_EMOJI = { bronze: "\u{1F949}", silver: "\u{1F948}", gold: "\u{1F947}", platinum: "\u{1F48E}" };
export const ORDER_TIER = ["bronze", "silver", "gold", "platinum"];
export function parseLoyaltyConfig(rows = []) {
  const map = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  const num = (k) => Number(map[k] ?? LOYALTY_DEFAULT[k]) || 0;
  return {
    aktif: String(map.aktif ?? LOYALTY_DEFAULT.aktif) !== "false",
    poin_per_rupiah: num("poin_per_rupiah") || Number(LOYALTY_DEFAULT.poin_per_rupiah),
    nilai_poin: num("nilai_poin") || Number(LOYALTY_DEFAULT.nilai_poin),
    min_tukar: num("min_tukar")
  };
}
export function hitungPoin(total, poinPerRupiah) {
  if (!poinPerRupiah || poinPerRupiah <= 0) return 0;
  return Math.floor((Number(total) || 0) / poinPerRupiah);
}
export function nilaiPoin(poin, nilaiPerPoin) {
  return (Number(poin) || 0) * (Number(nilaiPerPoin) || 0);
}
export function tierDari(totalBelanja, tiers = TIER_DEFAULT) {
  let hasil = "bronze";
  ORDER_TIER.forEach((t) => {
    const cfg = tiers.find((x) => x.tier === t);
    if (cfg && (Number(totalBelanja) || 0) >= (Number(cfg.target_bulanan) || 0)) hasil = t;
  });
  return hasil;
}
export function diskonTier(tier, tiers = TIER_DEFAULT) {
  const cfg = tiers.find((t) => t.tier === tier);
  return Number(cfg?.diskon_persen) || 0;
}
