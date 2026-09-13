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
    return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "spinner", style: { borderColor: "rgba(15,118,110,.25)", borderTopColor: "var(--primary)" } }), /* @__PURE__ */ React.createElement("span", { className: "text-muted" }, "Memuat dashboard...")));
  }
  return /* @__PURE__ */ React.createElement(Dashboard, null);
}
