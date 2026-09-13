import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Dashboard from "../components/Dashboard";
import { useAuth } from "../components/AuthProvider";
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);
  if (loading || !user) {
    return /* @__PURE__ */ jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: "spinner", style: { borderColor: "rgba(15,118,110,.25)", borderTopColor: "var(--primary)" } }),
      /* @__PURE__ */ jsx("span", { className: "text-muted", children: "Memuat dashboard..." })
    ] }) });
  }
  return /* @__PURE__ */ jsx(Dashboard, {});
}
