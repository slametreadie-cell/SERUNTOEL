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
  return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" } }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "spinner", style: { borderColor: "rgba(13,148,136,.3)", borderTopColor: "var(--primary)" } }), /* @__PURE__ */ React.createElement("span", { className: "text-muted" }, "Memuat...")));
}
