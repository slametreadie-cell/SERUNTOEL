import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../components/AuthProvider";
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, loading, router]);
  return /* @__PURE__ */ jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "spinner", style: { borderColor: "rgba(13,148,136,.3)", borderTopColor: "var(--primary)" } }),
    /* @__PURE__ */ jsx("span", { className: "text-muted", children: "Memuat..." })
  ] }) });
}
