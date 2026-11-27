import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Info } from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import Status from "./Status.jsx";

export default function Summary({ id }) {
  const [mode, setMode] = useState("beginner");
  const s = useAsync(() => api.summary(id, mode), [id, mode]);
  const missingKey = s.error && s.error.includes("GEMINI_API_KEY");

  return (
    <div className="card">
      <div className="card-title">
        <span>AI Explanation</span>
        <div style={{ display: "flex", gap: "6px" }}>
          {["beginner", "developer"].map((m) => (
            <button
              key={m}
              className={mode === m ? "go" : "ghost"}
              onClick={() => setMode(m)}
              style={{ padding: "5px 12px", fontSize: "12px", textTransform: "capitalize" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {missingKey ? (
        <div className="callout">
          <Info size={16} style={{ flexShrink: 0, marginTop: "2px", color: "var(--accent2)" }} />
          <div>
            <b>Gemini API key not configured.</b> Static analysis, architecture graphs, execution flows, file exploration, and keyword search work normally. Add <code>GEMINI_API_KEY</code> to <code>backend/.env</code> and restart the backend to enable AI summaries and RAG chat.
          </div>
        </div>
      ) : (
        <Status s={s} />
      )}
      {s.data && <div className="md"><ReactMarkdown>{s.data.text}</ReactMarkdown></div>}
    </div>
  );
}
