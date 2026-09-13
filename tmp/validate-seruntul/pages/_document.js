import { jsx, jsxs } from "react/jsx-runtime";
import { Html, Head, Main, NextScript } from "next/document";
export default function Document() {
  return /* @__PURE__ */ jsxs(Html, { lang: "id", "data-theme": "light", children: [
    /* @__PURE__ */ jsxs(Head, { children: [
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }),
      /* @__PURE__ */ jsx("meta", { name: "theme-color", content: "#0F766E" }),
      /* @__PURE__ */ jsx("meta", { name: "application-name", content: "Seruntul" }),
      /* @__PURE__ */ jsx("link", { rel: "manifest", href: "/manifest.json" }),
      /* @__PURE__ */ jsx("link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }),
      /* @__PURE__ */ jsx("link", { rel: "apple-touch-icon", href: "/favicon.svg" }),
      /* @__PURE__ */ jsx("meta", { name: "apple-mobile-web-app-capable", content: "yes" }),
      /* @__PURE__ */ jsx("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" }),
      /* @__PURE__ */ jsx("meta", { name: "apple-mobile-web-app-title", content: "Seruntul" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
          rel: "stylesheet"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Main, {}),
      /* @__PURE__ */ jsx(NextScript, {})
    ] })
  ] });
}
