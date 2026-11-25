export const LAYER_COLOR = { frontend: "#4cc2b0", backend: "#7aa2f7", database: "#e0af68", other: "#8497ab" };
const COL = { frontend: 0, backend: 1, database: 2, other: 3 };

// One column per layer so frontend / backend / database are visually separated.
export function layoutByLayer(nodes, find = "") {
  const row = {};
  return nodes.map((n) => {
    const c = COL[n.layer] ?? 3; row[c] = (row[c] ?? -1) + 1;
    const hit = find && n.id.toLowerCase().includes(find.toLowerCase());
    return { id: n.id, data: { label: n.label || n.id.split("/").pop(), ...n }, position: { x: c * 260, y: row[c] * 90 },
      style: { border: `2px solid ${LAYER_COLOR[n.layer]}`, background: "#171e26", color: "#dbe4ee", borderRadius: 8, fontSize: 12,
               opacity: find && !hit ? 0.25 : 1, boxShadow: hit ? `0 0 12px ${LAYER_COLOR[n.layer]}` : "none" } };
  });
}
