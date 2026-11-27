import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, Search } from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { useTheme } from "../hooks/useTheme.jsx";
import { layoutByLayer, LAYER_COLOR } from "../utils/layout.js";
import NeedRepo from "../components/NeedRepo.jsx";
import Status from "../components/Status.jsx";

function Graph({ repo }) {
  const { resolvedTheme } = useTheme();
  const s = useAsync(() => api.architecture(repo.id), [repo.id]);
  const [find, setFind] = useState("");
  const [selId, setSelId] = useState(null);
  const g = s.data;

  const sel = useMemo(() => g?.nodes.find((n) => n.id === selId) || null, [g, selId]);

  const connectedIds = useMemo(() => {
    if (!selId || !g) return null;
    const set = new Set([selId]);
    for (const e of g.edges) {
      if (e.source === selId) set.add(e.target);
      if (e.target === selId) set.add(e.source);
    }
    return set;
  }, [g, selId]);

  const nodes = useMemo(
    () => (g?.nodes ? layoutByLayer(g.nodes, { find, selectedId: selId, connectedIds, resolvedTheme }) : []),
    [g, find, selId, connectedIds, resolvedTheme]
  );

  const edges = useMemo(() => {
    if (!g?.edges) return [];
    const baseStroke = resolvedTheme === "light" ? "rgba(71, 85, 105, 0.35)" : "rgba(148, 163, 184, 0.28)";
    return g.edges.map((e, i) => {
      const isOut = selId && e.source === selId;
      const isIn = selId && e.target === selId;
      const active = isOut || isIn;
      const stroke = isOut ? "#06b6d4" : isIn ? "#6366f1" : baseStroke;
      return {
        id: "e" + i,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: Boolean(active),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
        style: {
          stroke,
          strokeWidth: active ? 2.5 : 1.5,
          opacity: selId && !active ? 0.14 : 1,
        },
      };
    });
  }, [g, selId, resolvedTheme]);

  const bgDots = resolvedTheme === "light" ? "rgba(15, 23, 42, 0.12)" : "rgba(148, 163, 184, 0.14)";
  const minimapBg = resolvedTheme === "light" ? "rgba(255, 255, 255, 0.92)" : "rgba(15, 23, 42, 0.9)";

  return (<>
    <div className="page-head">
      <div>
        <h2>Architecture</h2>
        <p className="hdr" style={{ marginBottom: 0 }}>
          Layered module graph built from verified static imports (top 40 connected files).
        </p>
      </div>
      <span className="repo-pill">{repo.name}</span>
    </div>

    <div className="controls">
      <div style={{ position: "relative", width: "min(280px, 100%)" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mute)" }} />
        <input
          placeholder="Highlight files…"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          style={{ width: "100%", paddingLeft: 34 }}
        />
      </div>
      <div className="legend">
        {Object.entries(LAYER_COLOR).map(([k, c]) => (
          <span className="legend-item" key={k}>
            <span className="legend-dot" style={{ background: c }} />
            <span style={{ textTransform: "capitalize" }}>{k}</span>
          </span>
        ))}
      </div>
    </div>

    <Status s={s} />
    {g && !g.nodes.length && <div className="empty-state"><p>No import relationships were detected in this repository.</p></div>}
    {g?.nodes.length > 0 && <>
      <div className="flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          colorMode={resolvedTheme}
          onNodeClick={(_, n) => !n.id.startsWith("__hdr_") && setSelId((cur) => (cur === n.id ? null : n.id))}
          onPaneClick={() => setSelId(null)}
        >
          <Background color={bgDots} gap={22} size={1.5} />
          <Controls />
          <MiniMap nodeColor={(n) => LAYER_COLOR[n.data?.layer] || "#64748b"} style={{ background: minimapBg }} />
        </ReactFlow>
      </div>
      <p style={{ marginTop: 8 }}>
        <small style={{ color: "var(--mute)" }}>
          {g.nodes.length} nodes · {g.edges.length} verified import edges · Click any file node to highlight its imports and dependents.
        </small>
      </p>
    </>}

    {sel && (
      <div className="node-detail">
        <div className="node-detail-head">
          <h4>{sel.path}</h4>
          <button className="ghost" onClick={() => setSelId(null)} style={{ padding: "4px 10px" }}>
            <X size={14} /> Clear
          </button>
        </div>
        <div className="meta" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="chip" style={{ borderColor: LAYER_COLOR[sel.layer], color: LAYER_COLOR[sel.layer], margin: 0 }}>
            {sel.layer}
          </span>
          <small style={{ color: "var(--mute)" }}>{sel.lines} lines</small>
        </div>
        <p style={{ fontSize: 14, marginBottom: 8 }}>
          <b>Functions:</b> {sel.functions?.join(", ") || "none detected"}
        </p>
        {sel.routes?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {sel.routes.map((r, i) => (
              <div key={i} style={{ marginTop: 4 }}>
                <span className="method-badge">{r.method}</span> <code>{r.path}</code>{" "}
                <small style={{ color: "var(--mute)" }}>line {r.line}</small>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <b style={{ fontSize: 13 }}>Imports:</b>{" "}
          {g.edges.filter((e) => e.source === sel.id).length ? (
            g.edges.filter((e) => e.source === sel.id).map((e) => (
              <button key={e.target} className="chip" onClick={() => setSelId(e.target)}>{e.target}</button>
            ))
          ) : (
            <small style={{ color: "var(--mute)" }}>none</small>
          )}
        </div>
        <div style={{ marginTop: 6 }}>
          <b style={{ fontSize: 13 }}>Imported by:</b>{" "}
          {g.edges.filter((e) => e.target === sel.id).length ? (
            g.edges.filter((e) => e.target === sel.id).map((e) => (
              <button key={e.source} className="chip" onClick={() => setSelId(e.source)}>{e.source}</button>
            ))
          ) : (
            <small style={{ color: "var(--mute)" }}>none</small>
          )}
        </div>
      </div>
    )}
  </>);
}

export default function Architecture() { return <NeedRepo>{(r) => <Graph repo={r} />}</NeedRepo>; }
