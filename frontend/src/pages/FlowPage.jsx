import { useState } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../services/api.js";
import { layoutByLayer, LAYER_COLOR } from "../utils/layout.js";
import NeedRepo from "../components/NeedRepo.jsx";

function Finder({ id }) {
  const [q, setQ] = useState(""), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr("");
    try { setRes(await api.flow(id, q)); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (<>
    <h2>Execution flow</h2>
    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="How does user authentication work?" />
    <button className="go" onClick={run} disabled={busy || q.length < 2}>{busy ? "Searching…" : "Find flow"}</button>
    {err && <p className="err">{err}</p>}
    {!res && !busy && <p className="hdr">Describe a feature. The flow is inferred from code search and import links.</p>}
    {res && !res.nodes.length && <p>{res.note}</p>}
    {res?.nodes.length > 0 && <>
      <p><small>{res.note} Arrows are verified imports; matching files to your question is keyword-based.</small></p>
      <div className="flow"><ReactFlow fitView colorMode="dark" nodes={layoutByLayer(res.nodes)}
        edges={res.edges.map((e, i) => ({ id: "f" + i, source: e.source, target: e.target, animated: true }))}>
        <Background /><Controls /><MiniMap nodeColor={(n) => LAYER_COLOR[n.data?.layer] || "#888"} /></ReactFlow></div>
      {res.steps.map((s, i) => <div className="card" key={s.file}><b>{i + 1}. {s.file}</b> <small>({s.layer}; {s.why})</small>
        {s.refs.map((r) => <div key={r.line}><code>:{r.line}</code> {r.text}</div>)}</div>)}
    </>}
  </>);
}
export default function FlowPage() { return <NeedRepo>{(r) => <Finder key={r.id} id={r.id} />}</NeedRepo>; }
