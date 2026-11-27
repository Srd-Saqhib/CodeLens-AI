import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch } from "lucide-react";
import { api } from "../services/api.js";
import { useTheme } from "../hooks/useTheme.jsx";
import { layoutByLayer, LAYER_COLOR } from "../utils/layout.js";
import NeedRepo from "../components/NeedRepo.jsx";

const SAMPLES = ["How does authentication work?", "How are API routes handled?", "How does database access work?"];

function Finder({ repo }) {
  const { resolvedTheme } = useTheme();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(query = q) {
    if (!query || query.trim().length < 2) return;
    setQ(query);
    setBusy(true);
    setErr("");
    try { setRes(await api.flow(repo.id, query)); } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const nodes = useMemo(
    () => (res?.nodes?.length ? layoutByLayer(res.nodes, { resolvedTheme }) : []),
    [res, resolvedTheme]
  );

  const edges = useMemo(() => {
    if (!res?.edges?.length) return [];
    const stroke = resolvedTheme === "light" ? "rgba(8, 145, 178, 0.55)" : "rgba(34, 211, 238, 0.5)";
    return res.edges.map((e, i) => ({
      id: "f" + i,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
      style: { stroke, strokeWidth: 2 },
    }));
  }, [res, resolvedTheme]);

  const bgDots = resolvedTheme === "light" ? "rgba(15, 23, 42, 0.12)" : "rgba(148, 163, 184, 0.14)";
  const minimapBg = resolvedTheme === "light" ? "rgba(255, 255, 255, 0.92)" : "rgba(15, 23, 42, 0.9)";

  return (<>
    <div className="page-head">
      <div>
        <h2>Execution Flow</h2>
        <p className="hdr" style={{ marginBottom: 0 }}>Describe a feature to trace matching files and 1-hop static import connections.</p>
      </div>
      <span className="repo-pill">{repo.name}</span>
    </div>

    <div className="chat-input" style={{ position: "static", marginTop: 8 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && run()}
        placeholder="How does user authentication work?"
      />
      <button className="go" onClick={() => run()} disabled={busy || q.trim().length < 2}>
        {busy ? "Searching…" : "Find flow"}
      </button>
    </div>

    <div className="suggestions">
      {SAMPLES.map((sample) => (
        <button key={sample} className="chip" onClick={() => run(sample)}>{sample}</button>
      ))}
    </div>

    {err && <p className="err">{err}</p>}
    {!res && !busy && !err && (
      <div className="empty-state" style={{ marginTop: 14 }}>
        <GitBranch size={40} />
        <p><b>Trace a feature statically</b></p>
        <p>Enter a question or pick a prompt above to map keyword-matched files and their direct import links.</p>
      </div>
    )}
    {res && !res.nodes.length && <div className="empty-state" style={{ marginTop: 14 }}><p>{res.note}</p></div>}

    {res?.nodes.length > 0 && <>
      <div className="flow" style={{ marginTop: 16 }}>
        <ReactFlow fitView fitViewOptions={{ padding: 0.18 }} colorMode={resolvedTheme} nodes={nodes} edges={edges}>
          <Background color={bgDots} gap={22} size={1.5} />
          <Controls />
          <MiniMap nodeColor={(n) => LAYER_COLOR[n.data?.layer] || "#64748b"} style={{ background: minimapBg }} />
        </ReactFlow>
      </div>
      <div style={{ marginTop: 16 }}>
        {res.steps.map((s, i) => (
          <div className="card" key={s.file}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <b style={{ color: "var(--accent)" }}>{i + 1}.</b>
              <code>{s.file}</code>
              <span className="chip" style={{ borderColor: LAYER_COLOR[s.layer], color: LAYER_COLOR[s.layer], margin: 0, padding: "2px 10px", fontSize: 12 }}>
                {s.layer}
              </span>
              <small style={{ color: "var(--mute)" }}>{s.why}</small>
            </div>
            {s.refs.map((r) => (
              <div key={r.line} style={{ fontSize: 13, marginTop: 4 }}>
                <code>:{r.line}</code> <span style={{ color: "var(--text-secondary)" }}>{r.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>}
  </>);
}

export default function FlowPage() { return <NeedRepo>{(r) => <Finder key={r.id} repo={r} />}</NeedRepo>; }
