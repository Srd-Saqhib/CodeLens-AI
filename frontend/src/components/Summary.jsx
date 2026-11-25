import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import Status from "./Status.jsx";

export default function Summary({ id }) {
  const [mode, setMode] = useState("beginner");
  const s = useAsync(() => api.summary(id, mode), [id, mode]);
  return (
    <div className="card">
      <b>AI explanation</b>{" "}
      {["beginner", "developer"].map((m) => <button key={m} className={"go" + (mode === m ? "" : " ghost")} onClick={() => setMode(m)}>{m}</button>)}
      <Status s={s} />
      {s.data && <div className="md"><ReactMarkdown>{s.data.text}</ReactMarkdown></div>}
    </div>
  );
}
