import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../components/AuthProvider";
import AppLayout from "../components/AppLayout";
import { logAudit } from "../utils/audit";
import { cetakStruk } from "../utils/struk";
import {
  parseLoyaltyConfig,
  TIER_DEFAULT,
  TIER_EMOJI,
  hitungPoin,
  nilaiPoin,
  tierDari
} from "../utils/loyalty";
const formatRupiah = (v) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v || 0);
const METODE = [
  { key: "cash", label: "\u{1F4B5} Tunai" },
  { key: "qris", label: "\u{1F4F1} QRIS" },
  { key: "transfer", label: "\u{1F3E6} Transfer" },
  { key: "ewallet", label: "\u{1F45B} E-Wallet" }
];
export default function POS() {
  const { user } = useAuth();
  const [produk, setProduk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kategori, setKategori] = useState("");
  const [loyalty, setLoyalty] = useState(parseLoyaltyConfig([]));
  const [tiers, setTiers] = useState(TIER_DEFAULT);
  const [diskonReseller, setDiskonReseller] = useState(10);
  const [toko, setToko] = useState({});
  const [cart, setCart] = useState([]);
  const [metode, setMetode] = useState("cash");
  const [nominalBayar, setNominalBayar] = useState("");
  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState("offline");
  const [saving, setSaving] = useState(false);
  const [sukses, setSukses] = useState(null);
  const [diskonMode, setDiskonMode] = useState("none");
  const [diskonInput, setDiskonInput] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState(null);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [cekPod, setCekPod] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [member, setMember] = useState(null);
  const [memberMsg, setMemberMsg] = useState("");
  const [poinPakai, setPoinPakai] = useState("");
  const fetchProduk = useCallback(async () => {
    setLoading(true);
    const { data, error: error2 } = await supabase.from("products").select("*").order("nama_produk");
    if (error2) setError(error2.message);
    else setProduk(data || []);
    setLoading(false);
  }, []);
  const fetchMaster = useCallback(async () => {
    const [loy, tier, conf] = await Promise.all([
      supabase.from("loyalty_config").select("*"),
      supabase.from("tier_config").select("*"),
      supabase.from("configuration").select("key, value")
    ]);
    setLoyalty(parseLoyaltyConfig(loy.data || []));
    if (tier.data && tier.data.length) setTiers(tier.data);
    const cm = {};
    (conf.data || []).forEach((c) => {
      cm[c.key] = c.value;
    });
    setToko(cm);
    const dr = Number(cm.diskon_reseller);
    setDiskonReseller(Number.isFinite(dr) && dr > 0 ? dr : 10);
  }, []);
  useEffect(() => {
    fetchProduk();
    fetchMaster();
  }, [fetchProduk, fetchMaster]);
  const kategoriList = useMemo(() => {
    const s = new Set(produk.map((p) => p.kategori).filter(Boolean));
    return [...s].sort();
  }, [produk]);
  const produkFiltered = produk.filter((p) => {
    const matchSearch = !search || (p.nama_produk || "").toLowerCase().includes(search.toLowerCase());
    const matchKat = !kategori || p.kategori === kategori;
    return matchSearch && matchKat;
  });
  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) {
        if (existing.qty + 1 > (p.stok_produk || 0)) {
          alert(`Stok ${p.nama_produk} tidak cukup (sisa ${p.stok_produk})`);
          return prev;
        }
        return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      if ((p.stok_produk || 0) < 1) {
        alert(`Stok ${p.nama_produk} habis!`);
        return prev;
      }
      return [...prev, {
        id: p.id,
        nama: p.nama_produk,
        harga: Number(p.harga_jual) || 0,
        qty: 1,
        stok: p.stok_produk,
        foto: p.foto_url,
        hpp: Number(p.hpp_per_unit) || 0
      }];
    });
  };
  const updateQty = (id, delta) => {
    setCart(
      (prev) => prev.map((i) => {
        if (i.id !== id) return i;
        const newQty = i.qty + delta;
        if (newQty < 1) return i;
        if (newQty > i.stok) {
          alert(`Stok maksimal ${i.stok}`);
          return i;
        }
        return { ...i, qty: newQty };
      })
    );
  };
  const removeItem = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const resetCart = () => {
    setCart([]);
    setNominalBayar("");
    setCustomer("");
    setMetode("cash");
    setChannel("offline");
    setDiskonMode("none");
    setDiskonInput("");
    setVoucher(null);
    setVoucherInput("");
    setVoucherMsg("");
    setMember(null);
    setMemberQuery("");
    setMemberMsg("");
    setPoinPakai("");
  };
  const subtotalNormal = cart.reduce((s, i) => s + i.harga * i.qty, 0);
  const diskonResellerRp = channel === "reseller" ? Math.round(subtotalNormal * diskonReseller / 100) : 0;
  const subtotal = Math.max(0, subtotalNormal - diskonResellerRp);
  const diskonManual = diskonMode === "persen" ? Math.round(subtotal * (Number(diskonInput) || 0) / 100) : diskonMode === "nominal" ? Math.min(subtotal, Number(diskonInput) || 0) : 0;
  const setelahDiskon = Math.max(0, subtotal - diskonManual);
  const diskonVoucher = useMemo(() => {
    if (!voucher) return 0;
    if (voucher.tipe === "persen") return Math.round(setelahDiskon * (Number(voucher.nilai) || 0) / 100);
    return Math.min(setelahDiskon, Number(voucher.nilai) || 0);
  }, [voucher, setelahDiskon]);
  const setelahVoucher = Math.max(0, setelahDiskon - diskonVoucher);
  const maxPoin = loyalty.nilai_poin > 0 ? Math.floor(setelahVoucher / loyalty.nilai_poin) : 0;
  const bolehTukar = member && loyalty.aktif && (member.poin || 0) >= loyalty.min_tukar && maxPoin > 0;
  const poinDipakai = bolehTukar ? Math.min(Number(poinPakai) || 0, member.poin || 0, maxPoin) : 0;
  const diskonPoin = nilaiPoin(poinDipakai, loyalty.nilai_poin);
  const total = Math.max(0, setelahVoucher - diskonPoin);
  const kembalian = Math.max(0, (Number(nominalBayar) || 0) - total);
  const poinDidapat = loyalty.aktif && member ? hitungPoin(total, loyalty.poin_per_rupiah) : 0;
  const diskonTierRp = diskonResellerRp + diskonPoin;
  const cekVoucher = async () => {
    const kode = (voucherInput || "").trim().toUpperCase();
    if (!kode) {
      setVoucherMsg("Masukkan kode voucher dulu");
      return;
    }
    setCekPod(true);
    setVoucherMsg("");
    try {
      const { data, error: error2 } = await supabase.from("vouchers").select("*").ilike("kode", kode).eq("aktif", true).limit(1).maybeSingle();
      if (error2) throw error2;
      if (!data) {
        setVoucher(null);
        setVoucherMsg("\u274C Voucher tidak ditemukan / tidak aktif");
        return;
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (data.tanggal_mulai && today < data.tanggal_mulai) {
        setVoucher(null);
        setVoucherMsg(`\u274C Voucher berlaku mulai ${data.tanggal_mulai}`);
        return;
      }
      if (data.tanggal_berakhir && today > data.tanggal_berakhir) {
        setVoucher(null);
        setVoucherMsg("\u274C Voucher sudah kedaluwarsa");
        return;
      }
      setVoucher(data);
      setVoucherMsg(`\u2705 Voucher aktif: ${data.tipe === "persen" ? `${data.nilai}%` : formatRupiah(data.nilai)}`);
    } catch (e) {
      setVoucherMsg("\u274C " + e.message);
    } finally {
      setCekPod(false);
    }
  };
  const cariMember = async () => {
    const q = (memberQuery || "").trim();
    if (!q) {
      setMemberMsg("Masukkan nama atau kontak");
      return;
    }
    setMemberMsg("");
    const { data } = await supabase.from("loyalty_members").select("*").or(`nama.ilike.%${q}%,kontak.ilike.%${q}%`).order("total_belanja", { ascending: false }).limit(1).maybeSingle();
    if (!data) {
      setMember(null);
      setMemberMsg("Member belum terdaftar \u2014 akan otomatis dibuat saat bayar.");
      if (!customer) setCustomer(q);
      return;
    }
    setMember(data);
    setCustomer(data.nama);
    setPoinPakai("");
    setMemberMsg(`\u2705 ${data.nama} \u2014 ${data.poin} poin (${TIER_EMOJI[data.tier] || ""} ${data.tier})`);
  };
  const buatMemberBaru = async () => {
    const nama = (customer || memberQuery || "").trim();
    if (!nama) {
      setMemberMsg("Isi nama pelanggan dulu");
      return;
    }
    const { data, error: error2 } = await supabase.from("loyalty_members").insert({ nama, kontak: null, poin: 0, tier: "bronze", total_transaksi: 0, total_belanja: 0 }).select().single();
    if (error2) {
      setMemberMsg("\u274C " + error2.message);
      return;
    }
    setMember(data);
    setMemberMsg(`\u2705 Member baru: ${data.nama}`);
  };
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Keranjang masih kosong");
      return;
    }
    if (metode === "cash" && (Number(nominalBayar) || 0) < total) {
      alert("Nominal bayar kurang dari total!");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const idTransaksi = "TRX-" + Date.now().toString().slice(-10) + "-" + Math.floor(Math.random() * 1e3);
      const itemsPayload = cart.map((i) => ({
        produk_id: i.id,
        nama_produk: i.nama,
        qty: i.qty,
        harga_satuan: i.harga,
        hpp_satuan: i.hpp,
        subtotal: i.harga * i.qty
      }));
      const namaCustomer = (customer || member?.nama || "").trim();
      let customerId = member?.customer_id || null;
      if (namaCustomer && !customerId) {
        try {
          const { data: existing } = await supabase.from("customers").select("id, total_transaksi, total_belanja").ilike("nama", namaCustomer).limit(1).maybeSingle();
          if (existing) {
            await supabase.from("customers").update({
              total_transaksi: (existing.total_transaksi || 0) + 1,
              total_belanja: Number(existing.total_belanja || 0) + total,
              last_order: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", existing.id);
            customerId = existing.id;
          } else {
            const { data: baru } = await supabase.from("customers").insert({
              nama: namaCustomer,
              channel,
              total_transaksi: 1,
              total_belanja: total,
              last_order: (/* @__PURE__ */ new Date()).toISOString()
            }).select("id").single();
            customerId = baru?.id || null;
          }
        } catch (e) {
          customerId = customerId || null;
        }
      }
      const { data: trx, error: trxErr } = await supabase.from("transactions").insert({
        id_transaksi: idTransaksi,
        total_bayar: total,
        channel,
        metode_pembayaran: metode,
        diskon: diskonManual + diskonTierRp,
        nominal_bayar: metode === "cash" ? Number(nominalBayar) || 0 : total,
        kembalian: metode === "cash" ? kembalian : 0,
        customer: namaCustomer || null,
        customer_id: customerId,
        voucher_kode: voucher?.kode || null,
        diskon_voucher: diskonVoucher,
        user_id: user?.id
      }).select("id").single();
      if (trxErr) throw trxErr;
      const { error: itemsErr } = await supabase.from("transaction_items").insert(itemsPayload.map((i) => ({ ...i, transaksi_id: trx.id })));
      if (itemsErr) throw itemsErr;
      for (const i of cart) {
        const { data: prod } = await supabase.from("products").select("stok_produk").eq("id", i.id).single();
        const stokBaru = Math.max(0, (prod?.stok_produk || 0) - i.qty);
        await supabase.from("products").update({ stok_produk: stokBaru }).eq("id", i.id);
      }
      if (voucher) {
        await supabase.from("voucher_usages").insert({
          voucher_id: voucher.id,
          kode_voucher: voucher.kode,
          transaksi_id: trx.id,
          customer_id: customerId,
          customer: namaCustomer || null,
          diskon: diskonVoucher
        });
        await supabase.from("vouchers").update({ total_dipakai: (voucher.total_dipakai || 0) + 1 }).eq("id", voucher.id);
      }
      let totalPoinBaru = member?.poin || 0;
      if (loyalty.aktif && namaCustomer) {
        let m = member;
        if (!m) {
          const { data: found } = await supabase.from("loyalty_members").select("*").ilike("nama", namaCustomer).limit(1).maybeSingle();
          m = found;
        }
        const totalBelanjaBaru = Number(m?.total_belanja || 0) + total;
        const poinBaru = Math.max(0, (m?.poin || 0) - poinDipakai) + poinDidapat;
        const tierBaru = tierDari(totalBelanjaBaru, tiers);
        if (m) {
          await supabase.from("loyalty_members").update({
            poin: poinBaru,
            tier: tierBaru,
            total_transaksi: (m.total_transaksi || 0) + 1,
            total_belanja: totalBelanjaBaru,
            customer_id: customerId,
            last_visit: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", m.id);
          totalPoinBaru = poinBaru;
          if (poinDipakai > 0) {
            await supabase.from("loyalty_history").insert({
              member_id: m.id,
              jenis: "tukar",
              poin: poinDipakai,
              keterangan: `Tukar poin di ${idTransaksi}`
            });
          }
          if (poinDidapat > 0) {
            await supabase.from("loyalty_history").insert({
              member_id: m.id,
              jenis: "tambah",
              poin: poinDidapat,
              keterangan: `Belanja ${idTransaksi}`
            });
          }
        } else {
          const { data: nm } = await supabase.from("loyalty_members").insert({
            nama: namaCustomer,
            customer_id: customerId,
            poin: poinDidapat,
            tier: "bronze",
            total_transaksi: 1,
            total_belanja: total,
            last_visit: (/* @__PURE__ */ new Date()).toISOString()
          }).select().single();
          totalPoinBaru = poinDidapat;
          if (nm && poinDidapat > 0) {
            await supabase.from("loyalty_history").insert({
              member_id: nm.id,
              jenis: "tambah",
              poin: poinDidapat,
              keterangan: `Belanja ${idTransaksi}`
            });
          }
        }
      }
      logAudit({
        aksi: "transaksi",
        user,
        sheetTarget: "transactions",
        detail: {
          id_transaksi: idTransaksi,
          total,
          metode,
          channel,
          items: cart.length,
          customer: namaCustomer || null,
          voucher: voucher?.kode || null,
          diskon: diskonManual + diskonTierRp,
          diskon_voucher: diskonVoucher,
          poin_ditukar: poinDipakai,
          poin_didapat: poinDidapat
        }
      });
      setSukses({
        id: idTransaksi,
        total,
        kembalian,
        metode,
        channel,
        items: itemsPayload,
        customer: namaCustomer,
        diskon: diskonManual + diskonTierRp,
        diskon_voucher: diskonVoucher,
        voucher_kode: voucher?.kode || null,
        poin_didapat: poinDidapat,
        poin_ditukar: poinDipakai,
        total_poin: totalPoinBaru,
        nominal_bayar: metode === "cash" ? Number(nominalBayar) || 0 : total,
        tanggal: (/* @__PURE__ */ new Date()).toISOString()
      });
      resetCart();
      fetchProduk();
    } catch (err) {
      setError(err.message || "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };
  const cetak = (s) => cetakStruk({
    ...s,
    nama_toko: toko.nama_toko,
    alamat_toko: toko.alamat_toko,
    telepon_toko: toko.telepon_toko,
    footer_struk: toko.footer_struk
  });
  return /* @__PURE__ */ jsxs(
    AppLayout,
    {
      title: "POS Kasir",
      subtitle: "Transaksi penjualan cepat",
      actions: /* @__PURE__ */ jsx(Link, { href: "/kasir/tutup", className: "btn btn-outline btn-sm", children: "\u{1F512} Tutup Kas" }),
      children: [
        error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
          "\u26A0\uFE0F ",
          error
        ] }),
        sukses && /* @__PURE__ */ jsxs("div", { className: "alert alert-success", style: { position: "sticky", top: 70, zIndex: 20, boxShadow: "var(--shadow-lg)" }, children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
            /* @__PURE__ */ jsx("b", { children: "\u2705 Transaksi berhasil!" }),
            /* @__PURE__ */ jsx("br", {}),
            /* @__PURE__ */ jsx("span", { className: "text-sm", children: sukses.id }),
            sukses.poin_didapat > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsxs("span", { className: "text-sm", children: [
                "Poin +",
                sukses.poin_didapat,
                " (total ",
                sukses.total_poin,
                ")"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
            /* @__PURE__ */ jsx("div", { className: "font-extrabold", children: formatRupiah(sukses.total) }),
            sukses.metode === "cash" && /* @__PURE__ */ jsxs("div", { className: "text-sm", children: [
              "Kembalian: ",
              formatRupiah(sukses.kembalian)
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-primary", onClick: () => cetak(sukses), children: "\u{1F5A8}\uFE0F Struk" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-sm btn-outline", onClick: () => setSukses(null), children: "\u2715" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "pos-layout", children: [
          /* @__PURE__ */ jsxs("div", { className: "card pos-katalog", style: { padding: 16 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mb-3", children: [
              /* @__PURE__ */ jsx("input", { className: "form-control", placeholder: "\u{1F50D} Cari produk...", value: search, onChange: (e) => setSearch(e.target.value) }),
              /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 160 }, value: kategori, onChange: (e) => setKategori(e.target.value), children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Semua" }),
                kategoriList.map((k) => /* @__PURE__ */ jsx("option", { value: k, children: k }, k))
              ] })
            ] }),
            loading ? /* @__PURE__ */ jsx("p", { className: "text-muted text-center", children: "Memuat produk..." }) : produkFiltered.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
              /* @__PURE__ */ jsx("div", { className: "nav-icon", style: { fontSize: 40 }, children: "\u{1F6D2}" }),
              /* @__PURE__ */ jsx("h3", { children: "Belum ada produk" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm", children: "Tambahkan produk di menu Produk & HPP dulu." })
            ] }) : /* @__PURE__ */ jsx("div", { className: "pos-grid", children: produkFiltered.map((p) => {
              const habis = (p.stok_produk || 0) < 1;
              return /* @__PURE__ */ jsxs("button", { className: `pos-produk ${habis ? "pos-habis" : ""}`, onClick: () => addToCart(p), disabled: habis, children: [
                /* @__PURE__ */ jsx("div", { className: "pos-produk-img", children: p.foto_url ? /* @__PURE__ */ jsx("img", { src: p.foto_url, alt: p.nama_produk }) : /* @__PURE__ */ jsx("span", { children: "\u{1F371}" }) }),
                /* @__PURE__ */ jsxs("div", { className: "pos-produk-info", children: [
                  /* @__PURE__ */ jsx("div", { className: "pos-produk-nama", children: p.nama_produk }),
                  /* @__PURE__ */ jsx("div", { className: "pos-produk-harga", children: formatRupiah(p.harga_jual) }),
                  /* @__PURE__ */ jsx("div", { className: `text-xs ${habis ? "text-danger" : "text-muted"}`, children: habis ? "Habis" : `Stok ${p.stok_produk}` })
                ] })
              ] }, p.id);
            }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "card pos-keranjang", style: { padding: 16 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "card-title mb-3", children: [
              /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F9FA}" }),
              " Keranjang (",
              cart.length,
              ")"
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Channel" }),
              /* @__PURE__ */ jsx("div", { className: "channel-grid", children: [
                { k: "offline", l: "\u{1F3EA} Offline" },
                { k: "online", l: "\u{1F310} Online" },
                { k: "reseller", l: `\u{1F4E6} Reseller (-${diskonReseller}%)` }
              ].map((c) => /* @__PURE__ */ jsx("button", { type: "button", className: `metode-btn ${channel === c.k ? "active" : ""}`, onClick: () => setChannel(c.k), children: c.l }, c.k)) })
            ] }),
            cart.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "text-center text-muted py-4", children: [
              "Keranjang kosong.",
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { className: "text-sm", children: "Klik produk untuk menambahkan." })
            ] }) : /* @__PURE__ */ jsx("div", { className: "cart-list", children: cart.map((i) => /* @__PURE__ */ jsxs("div", { className: "cart-item", children: [
              /* @__PURE__ */ jsxs("div", { className: "cart-item-info", children: [
                /* @__PURE__ */ jsx("div", { className: "font-bold", style: { fontSize: 13 }, children: i.nama }),
                /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted", children: [
                  formatRupiah(i.harga),
                  " \xD7 ",
                  i.qty
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "cart-item-actions", children: [
                /* @__PURE__ */ jsx("button", { className: "qty-btn", onClick: () => updateQty(i.id, -1), children: "\u2212" }),
                /* @__PURE__ */ jsx("span", { className: "font-bold", children: i.qty }),
                /* @__PURE__ */ jsx("button", { className: "qty-btn", onClick: () => updateQty(i.id, 1), children: "\uFF0B" }),
                /* @__PURE__ */ jsx("button", { className: "qty-btn qty-del", onClick: () => removeItem(i.id), children: "\u2715" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "font-bold text-primary", style: { fontSize: 13 }, children: formatRupiah(i.harga * i.qty) })
            ] }, i.id)) }),
            /* @__PURE__ */ jsxs("div", { className: "form-group mt-3", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Diskon" }),
              /* @__PURE__ */ jsxs("div", { className: "diskon-row", children: [
                /* @__PURE__ */ jsxs("select", { className: "form-control", style: { maxWidth: 120 }, value: diskonMode, onChange: (e) => {
                  setDiskonMode(e.target.value);
                  setDiskonInput("");
                }, children: [
                  /* @__PURE__ */ jsx("option", { value: "none", children: "Tanpa" }),
                  /* @__PURE__ */ jsx("option", { value: "persen", children: "Persen %" }),
                  /* @__PURE__ */ jsx("option", { value: "nominal", children: "Nominal Rp" })
                ] }),
                diskonMode !== "none" && /* @__PURE__ */ jsx(
                  "input",
                  {
                    className: "form-control",
                    type: "number",
                    placeholder: diskonMode === "persen" ? "0" : "0",
                    value: diskonInput,
                    onChange: (e) => setDiskonInput(e.target.value)
                  }
                ),
                diskonManual > 0 && /* @__PURE__ */ jsxs("span", { className: "text-sm text-danger font-bold", children: [
                  "\u2212",
                  formatRupiah(diskonManual)
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kode Voucher" }),
              /* @__PURE__ */ jsxs("div", { className: "diskon-row", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    className: "form-control",
                    placeholder: "mis. PROMO10",
                    value: voucherInput,
                    onChange: (e) => setVoucherInput(e.target.value.toUpperCase())
                  }
                ),
                /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline btn-sm", onClick: cekVoucher, disabled: cekPod, children: cekPod ? "..." : "Pakai" }),
                voucher && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-danger", onClick: () => {
                  setVoucher(null);
                  setVoucherInput("");
                  setVoucherMsg("");
                }, children: "\u2715" })
              ] }),
              voucherMsg && /* @__PURE__ */ jsx("div", { className: "text-xs mt-1", children: voucherMsg }),
              voucher && diskonVoucher > 0 && /* @__PURE__ */ jsxs("div", { className: "text-sm text-danger font-bold mt-1", children: [
                "\u2212",
                formatRupiah(diskonVoucher)
              ] })
            ] }),
            loyalty.aktif && /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Member / Pelanggan" }),
              /* @__PURE__ */ jsxs("div", { className: "diskon-row", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    className: "form-control",
                    placeholder: "Nama / kontak",
                    value: memberQuery,
                    onChange: (e) => setMemberQuery(e.target.value)
                  }
                ),
                /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline btn-sm", onClick: cariMember, children: "Cari" })
              ] }),
              memberMsg && /* @__PURE__ */ jsx("div", { className: "text-xs mt-1", children: memberMsg }),
              member && /* @__PURE__ */ jsxs("div", { className: "member-box mt-2", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsxs("div", { className: "font-bold", children: [
                      TIER_EMOJI[member.tier] || "\u{1F949}",
                      " ",
                      member.nama
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-xs text-muted", children: [
                      "Tier ",
                      member.tier,
                      " \xB7 ",
                      member.poin,
                      " poin"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => {
                    setMember(null);
                    setPoinPakai("");
                    setMemberMsg("");
                  }, children: "Ganti" })
                ] }),
                bolehTukar && /* @__PURE__ */ jsxs("div", { className: "diskon-row mt-2", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      className: "form-control",
                      type: "number",
                      placeholder: `maks ${Math.min(member.poin, maxPoin)}`,
                      value: poinPakai,
                      onChange: (e) => setPoinPakai(e.target.value)
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      className: "btn btn-sm btn-primary",
                      onClick: () => setPoinPakai(String(Math.min(member.poin, maxPoin))),
                      children: "Maks"
                    }
                  )
                ] }),
                diskonPoin > 0 && /* @__PURE__ */ jsxs("div", { className: "text-sm text-danger font-bold mt-1", children: [
                  "Tukar poin \u2212",
                  formatRupiah(diskonPoin)
                ] }),
                poinDidapat > 0 && /* @__PURE__ */ jsxs("div", { className: "text-sm text-success mt-1", children: [
                  "Akan dapat +",
                  poinDidapat,
                  " poin"
                ] })
              ] }),
              !member && memberQuery.trim() && memberMsg.includes("belum terdaftar") && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline mt-2", onClick: buatMemberBaru, children: "\uFF0B Daftarkan sebagai member" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "cart-total", children: [
              diskonResellerRp > 0 && /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsx("span", { children: "Harga normal" }),
                /* @__PURE__ */ jsx("b", { className: "text-muted", children: formatRupiah(subtotalNormal) })
              ] }),
              diskonResellerRp > 0 && /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "Diskon reseller ",
                  diskonReseller,
                  "%"
                ] }),
                /* @__PURE__ */ jsxs("b", { className: "text-danger", children: [
                  "\u2212",
                  formatRupiah(diskonResellerRp)
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsx("span", { children: "Subtotal" }),
                /* @__PURE__ */ jsx("b", { children: formatRupiah(subtotal) })
              ] }),
              diskonManual > 0 && /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsx("span", { children: "Diskon" }),
                /* @__PURE__ */ jsxs("b", { className: "text-danger", children: [
                  "\u2212",
                  formatRupiah(diskonManual)
                ] })
              ] }),
              diskonVoucher > 0 && /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "Voucher ",
                  voucher?.kode
                ] }),
                /* @__PURE__ */ jsxs("b", { className: "text-danger", children: [
                  "\u2212",
                  formatRupiah(diskonVoucher)
                ] })
              ] }),
              diskonPoin > 0 && /* @__PURE__ */ jsxs("div", { className: "baw-row", children: [
                /* @__PURE__ */ jsxs("span", { children: [
                  "Tukar ",
                  poinDipakai,
                  " poin"
                ] }),
                /* @__PURE__ */ jsxs("b", { className: "text-danger", children: [
                  "\u2212",
                  formatRupiah(diskonPoin)
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "baw-row total", children: [
                /* @__PURE__ */ jsx("span", { children: "TOTAL" }),
                /* @__PURE__ */ jsx("b", { className: "text-primary", children: formatRupiah(total) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group mt-3", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Metode Pembayaran" }),
              /* @__PURE__ */ jsx("div", { className: "metode-grid", children: METODE.map((m) => /* @__PURE__ */ jsx("button", { type: "button", className: `metode-btn ${metode === m.key ? "active" : ""}`, onClick: () => setMetode(m.key), children: m.label }, m.key)) })
            ] }),
            metode === "cash" && /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nominal Bayar" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", value: nominalBayar, onChange: (e) => setNominalBayar(e.target.value), placeholder: "0" }),
              /* @__PURE__ */ jsxs("div", { className: "text-sm text-muted mt-2", children: [
                "Kembalian: ",
                /* @__PURE__ */ jsx("b", { className: "text-success", children: formatRupiah(kembalian) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex gap-2 mt-2 flex-wrap", children: [total, 5e4, 1e5, 2e5].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4).map((v) => /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-sm btn-outline", onClick: () => setNominalBayar(String(v)), children: v === total ? "Uang Pas" : formatRupiah(v) }, v)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Nama Pelanggan (opsional)" }),
              /* @__PURE__ */ jsx("input", { className: "form-control", value: customer, onChange: (e) => setCustomer(e.target.value), placeholder: "Tanpa nama" })
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-block", style: { padding: 14, fontSize: 16 }, onClick: handleCheckout, disabled: saving || cart.length === 0, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { className: "spinner" }),
              " Memproses..."
            ] }) : `\u{1F4B3} Bayar ${formatRupiah(total)}` })
          ] })
        ] }),
        /* @__PURE__ */ jsx("style", { jsx: true, children: `
        .pos-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 1024px) { .pos-layout { grid-template-columns: 1.4fr .9fr; align-items: start; } }

        .pos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 640px) { .pos-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1200px) { .pos-grid { grid-template-columns: repeat(4, 1fr); } }

        .pos-produk {
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          overflow: hidden; background: var(--card); cursor: pointer;
          transition: all .15s; text-align: left; padding: 0;
        }
        .pos-produk:hover { transform: translateY(-2px); border-color: var(--primary); box-shadow: var(--shadow-hover); }
        .pos-produk.pos-habis { opacity: .5; cursor: not-allowed; }
        .pos-produk-img { height: 80px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .pos-produk-img img { width: 100%; height: 100%; object-fit: cover; }
        .pos-produk-info { padding: 8px 10px; }
        .pos-produk-nama { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pos-produk-harga { font-size: 13px; font-weight: 800; color: var(--primary); }

        .cart-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
        .cart-item {
          display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center;
          padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);
        }
        .cart-item-actions { display: flex; align-items: center; gap: 6px; }
        .qty-btn {
          width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-weight: 700;
          background: var(--bg); transition: all .15s;
        }
        .qty-btn:hover { border-color: var(--primary); color: var(--primary); }
        .qty-del { color: var(--danger); }
        .qty-del:hover { border-color: var(--danger); }

        .cart-total { margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--border); }
        .baw-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .baw-row span { color: var(--muted); }
        .baw-row.total { border-top: 1px solid var(--border); margin-top: 6px; padding-top: 8px; }
        .baw-row.total b { font-size: 20px; }

        .metode-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .channel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .channel-grid .metode-btn { font-size: 11px; padding: 8px 4px; }
        .metode-btn {
          padding: 10px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-weight: 600; font-size: 13px; transition: all .15s; background: var(--card);
        }
        .metode-btn.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary-dark); }

        .diskon-row { display: flex; align-items: center; gap: 8px; }
        .member-box { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: var(--bg); }
      ` })
      ]
    }
  );
}
