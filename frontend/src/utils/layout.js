import { createElement as h } from "react";
import { Position } from "@xyflow/react";

export const LAYER_COLOR = {
  frontend: "#06b6d4",
  backend: "#6366f1",
  database: "#f59e0b",
  other: "#64748b",
};

const LAYER_ORDER = ["frontend", "backend", "database", "other"];
const LAYER_TITLE = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  other: "Other",
};

export function layoutByLayer(nodes, { find = "", selectedId = null, connectedIds = null, resolvedTheme = "dark" } = {}) {
  const grouped = {};
  for (const n of nodes) {
    const l = LAYER_ORDER.includes(n.layer) ? n.layer : "other";
    (grouped[l] ||= []).push(n);
  }
  const activeLayers = LAYER_ORDER.filter((l) => grouped[l]?.length);
  const colIndex = Object.fromEntries(activeLayers.map((l, idx) => [l, idx]));
  const isLight = resolvedTheme === "light";

  const out = [];
  for (const l of activeLayers) {
    const c = colIndex[l];
    const color = LAYER_COLOR[l];
    out.push({
      id: `__hdr_${l}`,
      type: "default",
      selectable: false,
      draggable: false,
      connectable: false,
      position: { x: c * 300, y: 0 },
      data: {
        label: h(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
          h(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: 6 } },
            h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: color } }),
            LAYER_TITLE[l]
          ),
          h("span", { style: { opacity: 0.7, fontSize: 11 } }, grouped[l].length)
        ),
      },
      style: {
        width: 220,
        background: isLight ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.75)",
        color: isLight ? "#0f172a" : "#e2e8f0",
        border: `1px solid ${color}55`,
        borderRadius: 999,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        pointerEvents: "none",
      },
    });
  }

  const row = {};
  for (const n of nodes) {
    const l = LAYER_ORDER.includes(n.layer) ? n.layer : "other";
    const c = colIndex[l] ?? 0;
    row[l] = (row[l] ?? -1) + 1;
    const color = LAYER_COLOR[l] || "#64748b";
    const hit = Boolean(find && n.id.toLowerCase().includes(find.toLowerCase()));
    const isSel = selectedId === n.id;
    const isNeighbor = connectedIds ? connectedIds.has(n.id) : false;
    const dimmed = (find && !hit) || (selectedId && !isSel && !isNeighbor);
    const title = n.label || n.id.split("/").pop();
    const dir = n.id.includes("/") ? n.id.slice(0, n.id.lastIndexOf("/")) : "(root)";
    const badgeParts = [];
    if (n.lines) badgeParts.push(`${n.lines}L`);
    if (n.functions?.length) badgeParts.push(`${n.functions.length} fn`);
    if (n.routes?.length) badgeParts.push(`${n.routes.length} route${n.routes.length > 1 ? "s" : ""}`);
    if (n.seed) badgeParts.push("match");

    out.push({
      id: n.id,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: c * 300, y: 66 + row[l] * 92 },
      data: {
        ...n,
        label: h(
          "div",
          { style: { textAlign: "left", lineHeight: 1.35 } },
          h(
            "div",
            { style: { fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            title
          ),
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4, fontSize: 10.5, opacity: 0.72 } },
            h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, dir),
            badgeParts.length > 0
              ? h("span", { style: { color, fontWeight: 600, flexShrink: 0 } }, badgeParts.join(" · "))
              : null
          )
        ),
      },
      style: {
        width: 220,
        border: `${isSel || hit ? 2.5 : 1.5}px solid ${isSel || hit ? color : color + "99"}`,
        background: isLight ? "linear-gradient(145deg, #ffffff, #f8fafc)" : "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.84))",
        color: isLight ? "#0f172a" : "#f1f5f9",
        borderRadius: 12,
        padding: "10px 12px",
        fontFamily: "'Inter', system-ui, sans-serif",
        opacity: dimmed ? 0.22 : 1,
        boxShadow: isSel || hit
          ? `0 0 0 3px ${color}33, 0 8px 24px ${color}30`
          : isLight ? "0 2px 10px rgba(15,23,42,0.06)" : "0 4px 16px rgba(0,0,0,0.35)",
      },
    });
  }
  return out;
}
