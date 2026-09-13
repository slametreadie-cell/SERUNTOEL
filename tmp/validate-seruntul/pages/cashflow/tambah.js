import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../components/AuthProvider";
import AppLayout from "../../components/AppLayout";
const KATEGORI_MASUK = ["Penjualan", "Modal", "Hutang", "Piutang", "Lainnya"];
const KATEGORI_KELUAR = ["Pembelian Bahan", "Operasional", "Gaji", "Sewa", "Utilitas", "Marketing", "Lainnya"];
export default function TambahCashflow() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tanggal: today,
    jenis: "masuk",
    kategori: "Penjualan",
    jumlah: "",
    keterangan: ""
  });
  const kategoriList = form.jenis === "masuk" ? KATEGORI_MASUK : KATEGORI_KELUAR;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const jumlah = Number(form.jumlah);
      if (!jumlah || jumlah <= 0) {
        setError("Jumlah harus lebih dari 0");
        setSaving(false);
        return;
      }
      const { error: error2 } = await supabase.from("cashflow").insert({
        tanggal: form.tanggal,
        jenis: form.jenis,
        kategori: form.kategori,
        jumlah,
        keterangan: form.keterangan || form.kategori
      });
      if (error2) throw error2;
      router.push("/cashflow");
    } catch (err) {
      setError(err.message || "Gagal menyimpan");
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx(AppLayout, { title: "Catat Transaksi", subtitle: "Tambah pemasukan atau pengeluaran", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    error && /* @__PURE__ */ jsxs("div", { className: "alert alert-danger", children: [
      "\u26A0\uFE0F ",
      error
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card", style: { maxWidth: 560 }, children: [
      /* @__PURE__ */ jsx("div", { className: "card-header", children: /* @__PURE__ */ jsxs("div", { className: "card-title", children: [
        /* @__PURE__ */ jsx("span", { className: "nav-icon", children: "\u{1F4B8}" }),
        " Detail Transaksi"
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "form-row", children: /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jenis" }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `btn ${form.jenis === "masuk" ? "btn-primary" : "btn-outline"}`,
              style: { flex: 1 },
              onClick: () => setForm({ ...form, jenis: "masuk", kategori: "Penjualan" }),
              children: "\u2191 Masuk"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `btn ${form.jenis === "keluar" ? "btn-danger" : "btn-outline"}`,
              style: { flex: 1 },
              onClick: () => setForm({ ...form, jenis: "keluar", kategori: "Pembelian Bahan" }),
              children: "\u2193 Keluar"
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Tanggal" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "date", value: form.tanggal, onChange: (e) => setForm({ ...form, tanggal: e.target.value }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Jumlah (Rp)" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", type: "number", required: true, value: form.jumlah, onChange: (e) => setForm({ ...form, jumlah: e.target.value }), placeholder: "0" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Kategori" }),
          /* @__PURE__ */ jsx("select", { className: "form-control", value: form.kategori, onChange: (e) => setForm({ ...form, kategori: e.target.value }), children: kategoriList.map((k) => /* @__PURE__ */ jsx("option", { value: k, children: k }, k)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Keterangan" }),
          /* @__PURE__ */ jsx("input", { className: "form-control", value: form.keterangan, onChange: (e) => setForm({ ...form, keterangan: e.target.value }), placeholder: "Contoh: Jual abon 10 pcs" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 justify-end mt-3", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/cashflow"), children: "Batal" }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", disabled: saving, children: saving ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "spinner" }),
          " Menyimpan..."
        ] }) : "\u{1F4BE} Simpan" })
      ] })
    ] })
  ] }) });
}
