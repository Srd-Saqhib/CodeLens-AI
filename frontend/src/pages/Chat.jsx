import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import NeedRepo from "../components/NeedRepo.jsx";

const SUGGEST = ["How does authentication work?", "Where is the database connection created?", "How does the frontend talk to the backend?", "Which files define API routes?"];

function ChatBox({ id }) {
  const hist = useAsync(() => api.history(id), [id]);
  const [msgs, setMsgs] = useState([]), [q, setQ] = useState(""), [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState("rag"), [mode, setMode] = useState("beginner");
  useEffect(() => { if (hist.data) setMsgs(hist.data.map((m) => ({ role: m.role, text: m.text }))); }, [hist.data]);

  async function ask(question) {
    if (!question.trim() || busy) return;
    setQ(""); setBusy(true); setMsgs((m) => [...m, { role: "user", text: question }]);
    try {
      const a = await api.chat(id, question, mode, engine);
      setMsgs((m) => [...m, { role: "ai", text: a.answer, sources: a.sources, steps: a.steps }]);
    } catch (e) { setMsgs((m) => [...m, { role: "ai", text: e.message, error: true }]); }
    setBusy(false);
  }
  return (<>
    <h2>AI chat</h2>
    <select value={engine} onChange={(e) => setEngine(e.target.value)}><option value="rag">RAG (embeddings)</option><option value="agent">Agent (tool calling)</option></select>{" "}
    <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="beginner">Beginner</option><option value="developer">Developer</option></select>
    {msgs.length === 0 && !hist.loading && <div className="card"><b>Ask about this repository</b><div>
      {SUGGEST.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div></div>}
    {msgs.map((m, i) => <div key={i} className="card"><b>{m.role === "user" ? "You" : "CodeLens"}</b>
      {m.error ? <p className="err">{m.text}</p> : <div className="md"><ReactMarkdown>{m.text}</ReactMarkdown></div>}
      {m.sources?.map((s, j) => <div key={j}><code>{s.file}:{s.line}</code> <small>{s.text}</small></div>)}
      {m.steps?.length > 0 && <small>Tools used: {m.steps.map((s) => s.tool).join(" → ")}</small>}</div>)}
    {busy && <div className="skel" />}
    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder="Ask a question about the code…" />
    <button className="go" onClick={() => ask(q)} disabled={busy}>Ask</button>
  </>);
}
export default function Chat() { return <NeedRepo>{(r) => <ChatBox key={r.id} id={r.id} />}</NeedRepo>; }
