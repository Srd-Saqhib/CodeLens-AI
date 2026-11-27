import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send } from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import NeedRepo from "../components/NeedRepo.jsx";

const SUGGEST = [
  "How does authentication work?",
  "Where is the database connection created?",
  "How does the frontend talk to the backend?",
  "Which files define API routes?",
];

function ChatBox({ repo }) {
  const hist = useAsync(() => api.history(repo.id), [repo.id]);
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState("rag");
  const [mode, setMode] = useState("beginner");

  useEffect(() => {
    if (hist.data) setMsgs(hist.data.map((m) => ({ role: m.role, text: m.text })));
  }, [hist.data]);

  async function ask(question) {
    if (!question.trim() || busy) return;
    setQ("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }]);
    try {
      const a = await api.chat(repo.id, question, mode, engine);
      setMsgs((m) => [...m, { role: "ai", text: a.answer, sources: a.sources, steps: a.steps }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "ai", text: e.message, error: true }]);
    }
    setBusy(false);
  }

  return (<>
    <div className="page-head">
      <div>
        <h2>AI Chat</h2>
        <p className="hdr" style={{ marginBottom: 0 }}>Ask questions grounded in analyzed code and imports.</p>
      </div>
      <span className="repo-pill">{repo.name}</span>
    </div>

    <div className="controls" style={{ justifyContent: "flex-start" }}>
      <select value={engine} onChange={(e) => setEngine(e.target.value)}>
        <option value="rag">RAG (embeddings)</option>
        <option value="agent">Agent (tool calling)</option>
      </select>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="beginner">Beginner</option>
        <option value="developer">Developer</option>
      </select>
    </div>

    {msgs.length === 0 && !hist.loading && (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 4 }}><span>Ask about this repository</span></div>
        <div className="suggestions">
          {SUGGEST.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
        </div>
      </div>
    )}

    {msgs.map((m, i) => (
      <div key={i} className={m.role === "user" ? "msg-user" : "msg-ai"}>
        <div className={`msg-role ${m.role === "user" ? "user" : "ai"}`}>{m.role === "user" ? "You" : "CodeLens AI"}</div>
        {m.error ? <p className="err">{m.text}</p> : <div className="md"><ReactMarkdown>{m.text}</ReactMarkdown></div>}
        {m.sources?.length > 0 && (
          <div className="msg-sources">
            {m.sources.map((s, j) => (
              <div key={j} style={{ fontSize: 13, marginTop: 4 }}>
                <code>{s.file}:{s.line}</code> <small style={{ color: "var(--mute)" }}>{s.text}</small>
              </div>
            ))}
          </div>
        )}
        {m.steps?.length > 0 && (
          <div className="msg-tools">
            Tools: {m.steps.map((s, j) => <span key={j}>{s.tool}</span>)}
          </div>
        )}
      </div>
    ))}
    {busy && <div className="skel" />}
    <div className="chat-input">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && ask(q)}
        placeholder="Ask a question about the code…"
      />
      <button className="go" onClick={() => ask(q)} disabled={busy}>
        <Send size={14} />
        <span>Ask</span>
      </button>
    </div>
  </>);
}

export default function Chat() { return <NeedRepo>{(r) => <ChatBox key={r.id} repo={r} />}</NeedRepo>; }
