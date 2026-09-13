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
  return /* @__PURE__ */ React.createElement(AppLayout, { title: "Catat Transaksi", subtitle: "Tambah pemasukan atau pengeluaran" }, /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, error && /* @__PURE__ */ React.createElement("div", { className: "alert alert-danger" }, "\u26A0\uFE0F ", error), /* @__PURE__ */ React.createElement("div", { className: "card", style: { maxWidth: 560 } }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("div", { className: "card-title" }, /* @__PURE__ */ React.createElement("span", { className: "nav-icon" }, "\u{1F4B8}"), " Detail Transaksi")), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jenis"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: `btn ${form.jenis === "masuk" ? "btn-primary" : "btn-outline"}`,
      style: { flex: 1 },
      onClick: () => setForm({ ...form, jenis: "masuk", kategori: "Penjualan" })
    },
    "\u2191 Masuk"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: `btn ${form.jenis === "keluar" ? "btn-danger" : "btn-outline"}`,
      style: { flex: 1 },
      onClick: () => setForm({ ...form, jenis: "keluar", kategori: "Pembelian Bahan" })
    },
    "\u2193 Keluar"
  )))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Tanggal"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "date", value: form.tanggal, onChange: (e) => setForm({ ...form, tanggal: e.target.value }) })), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Jumlah (Rp)"), /* @__PURE__ */ React.createElement("input", { className: "form-control", type: "number", required: true, value: form.jumlah, onChange: (e) => setForm({ ...form, jumlah: e.target.value }), placeholder: "0" }))), /* @__PURE__ */ React.createElement("div", { className: "form-row" }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Kategori"), /* @__PURE__ */ React.createElement("select", { className: "form-control", value: form.kategori, onChange: (e) => setForm({ ...form, kategori: e.target.value }) }, kategoriList.map((k) => /* @__PURE__ */ React.createElement("option", { key: k, value: k }, k)))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Keterangan"), /* @__PURE__ */ React.createElement("input", { className: "form-control", value: form.keterangan, onChange: (e) => setForm({ ...form, keterangan: e.target.value }), placeholder: "Contoh: Jual abon 10 pcs" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 justify-end mt-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-outline", onClick: () => router.push("/cashflow") }, "Batal"), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn btn-primary", disabled: saving }, saving ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "spinner" }), " Menyimpan...") : "\u{1F4BE} Simpan")))));
}
