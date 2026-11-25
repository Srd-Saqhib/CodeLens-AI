import { useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { layoutByLayer, LAYER_COLOR } from "../utils/layout.js";
import NeedRepo from "../components/NeedRepo.jsx";
import Status from "../components/Status.jsx";

function Graph({ id }) {
  const s = useAsync(() => api.architecture(id), [id]);
  const [find, setFind] = useState(""), [sel, setSel] = useState(null);
  const g = s.data;
  const edges = g?.edges.map((e, i) => ({ id: "e" + i, source: e.source, target: e.target })) ?? [];
  return (<>
    <h2>Architecture</h2>
    <input placeholder="Search files…" value={find} onChange={(e) => setFind(e.target.value)} />
    {Object.entries(LAYER_COLOR).map(([k, c]) => <span key={k} style={{ color: c, marginLeft: 10 }}>● {k}</span>)}
    <Status s={s} />
    {g && !g.nodes.length && <p>No import relationships were detected in this repository.</p>}
    {g?.nodes.length > 0 && <>
      <div className="flow"><ReactFlow nodes={layoutByLayer(g.nodes, find)} edges={edges} fitView colorMode="dark" onNodeClick={(_, n) => setSel(n.data)}>
        <Background /><Controls /><MiniMap nodeColor={(n) => LAYER_COLOR[n.data?.layer] || "#888"} /></ReactFlow></div>
      <p><small>Edges are verified import relationships only (top 40 most connected files).</small></p>
    </>}
    {sel && <div className="card"><b>{sel.path}</b> <small>{sel.layer}, {sel.lines} lines</small>
      <p>Functions: {sel.functions.join(", ") || "none detected"}</p>
      {sel.routes.map((r, i) => <div key={i}><code>{r.method} {r.path}</code> line {r.line}</div>)}
      <p>Imports: {g.edges.filter((e) => e.source === sel.id).map((e) => e.target).join(", ") || "none"}</p>
      <p>Imported by: {g.edges.filter((e) => e.target === sel.id).map((e) => e.source).join(", ") || "none"}</p></div>}
  </>);
}
export default function Architecture() { return <NeedRepo>{(r) => <Graph id={r.id} />}</NeedRepo>; }
