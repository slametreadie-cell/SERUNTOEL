import Icon from "./Icons";
export function StatCard({ label, value, icon, tone = "", hint, delta, href }) {
  const deltaClass = delta == null ? "" : delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat";
  const deltaIcon = delta == null ? null : delta > 0 ? "trendingUp" : delta < 0 ? "trendingDown" : null;
  const inner = /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-head" }, /* @__PURE__ */ React.createElement("span", { className: "stat-label" }, label), icon && /* @__PURE__ */ React.createElement("span", { className: `stat-icon ${tone ? `is-${tone}` : ""}`, "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 15 }))), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, value), /* @__PURE__ */ React.createElement("div", { className: "stat-foot" }, delta != null && /* @__PURE__ */ React.createElement("span", { className: `delta ${deltaClass}` }, deltaIcon && /* @__PURE__ */ React.createElement(Icon, { name: deltaIcon, size: 12 }), delta > 0 ? "+" : "", delta.toFixed(1), "%"), hint && /* @__PURE__ */ React.createElement("span", { className: "stat-hint" }, hint)));
  if (href) {
    return /* @__PURE__ */ React.createElement("a", { href, className: "stat-card", style: { textDecoration: "none" } }, inner);
  }
  return /* @__PURE__ */ React.createElement("div", { className: "stat-card" }, inner);
}
export function Sparkline({ values = [], labels = [], height = 34, ariaLabel }) {
  const w = 100;
  const h = height;
  const safe = values.length ? values : [0];
  const max = Math.max(...safe);
  const min = Math.min(...safe, 0);
  const span = max - min || 1;
  const step = safe.length > 1 ? w / (safe.length - 1) : w;
  const points = safe.map((v, i) => [
    i * step,
    h - (v - min) / span * (h - 8) - 4
  ]);
  const line = points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = points[points.length - 1];
  const flat = max === min;
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      className: "spark",
      viewBox: `0 0 ${w} ${h}`,
      preserveAspectRatio: "none",
      role: "img",
      "aria-label": ariaLabel || "Grafik tren 7 hari terakhir"
    },
    !flat && /* @__PURE__ */ React.createElement("polygon", { className: "spark-area", points: area }),
    /* @__PURE__ */ React.createElement("polyline", { className: "spark-line", points: line, vectorEffect: "non-scaling-stroke" }),
    last && /* @__PURE__ */ React.createElement("circle", { className: "spark-dot", cx: last[0], cy: last[1], r: "1.6", vectorEffect: "non-scaling-stroke" })
  );
}
export function SkeletonStat() {
  return /* @__PURE__ */ React.createElement("div", { className: "stat-card", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "stat-head" }, /* @__PURE__ */ React.createElement("div", { className: "skeleton skeleton-text", style: { width: 78, marginBottom: 0 } }), /* @__PURE__ */ React.createElement("div", { className: "skeleton", style: { width: 28, height: 28, borderRadius: 6 } })), /* @__PURE__ */ React.createElement("div", { className: "skeleton skeleton-metric", style: { marginTop: 8 } }), /* @__PURE__ */ React.createElement("div", { className: "skeleton skeleton-text", style: { width: 96, marginTop: 8 } }));
}
export function SkeletonRows({ rows = 4 }) {
  return /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true" }, Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ React.createElement("div", { className: "list-item", key: i }, /* @__PURE__ */ React.createElement("div", { className: "skeleton", style: { width: 30, height: 30, borderRadius: 6 } }), /* @__PURE__ */ React.createElement("div", { className: "list-body" }, /* @__PURE__ */ React.createElement("div", { className: "skeleton skeleton-text", style: { width: `${55 + i * 13 % 30}%` } }), /* @__PURE__ */ React.createElement("div", { className: "skeleton skeleton-text", style: { width: "30%", marginBottom: 0 } })))));
}
export function EmptyBlock({ icon = "inbox", title, message, action }) {
  return /* @__PURE__ */ React.createElement("div", { className: "empty-state", role: "status" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 30 }), /* @__PURE__ */ React.createElement("h3", null, title), message && /* @__PURE__ */ React.createElement("p", { className: "text-sm" }, message), action);
}
export function StockBar({ value, max = 20 }) {
  const pct = Math.min(100, Math.max(2, (Number(value) || 0) / max * 100));
  const tone = Number(value) <= 0 ? "is-danger" : Number(value) <= 5 ? "is-warning" : "";
  return /* @__PURE__ */ React.createElement("div", { className: "bar", role: "presentation" }, /* @__PURE__ */ React.createElement("div", { className: `bar-fill ${tone}`, style: { width: `${pct}%` } }));
}
