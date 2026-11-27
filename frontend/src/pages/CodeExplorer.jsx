import { useMemo, useState } from "react";
import { Copy, Check, FileCode2, Search } from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import NeedRepo from "../components/NeedRepo.jsx";
import Status from "../components/Status.jsx";

function Explorer({ repo }) {
  const list = useAsync(() => api.files(repo.id), [repo.id]);
  const [search, setSearch] = useState("");
  const [lang, setLang] = useState("All");
  const [selectedPath, setSelectedPath] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const langs = useMemo(() => {
    const set = new Set((list.data || []).map((f) => f.lang));
    return ["All", ...Array.from(set).sort()];
  }, [list.data]);

  const filtered = useMemo(() => {
    return (list.data || []).filter((f) => {
      const okLang = lang === "All" || f.lang === lang;
      const okSearch = !search || f.path.toLowerCase().includes(search.toLowerCase());
      return okLang && okSearch;
    });
  }, [list.data, lang, search]);

  const activePath = selectedPath || filtered[0]?.path || "";
  const fileRes = useAsync(
    () => (activePath ? api.fileContent(repo.id, activePath) : Promise.resolve(null)),
    [repo.id, activePath]
  );

  async function copyCode() {
    if (!fileRes.data?.content) return;
    if (!navigator.clipboard?.writeText) {
      setCopyError("Clipboard access is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(fileRes.data.content);
      setCopyError("");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError("Could not copy to clipboard.");
    }
  }

  const lines = fileRes.data?.content ? fileRes.data.content.split("\n") : [];

  return (<>
    <div className="page-head">
      <div>
        <h2>Code Explorer</h2>
        <p className="hdr" style={{ marginBottom: 0 }}>Browse analyzed repository files, detected symbols, and source code.</p>
      </div>
      <span className="repo-pill">{repo.name}</span>
    </div>

    <Status s={list} />
    {list.data && (
      <div className="explorer-grid">
        <div className="explorer-list">
          <div className="explorer-filter">
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--mute)" }} />
              <input
                placeholder="Filter files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30 }}
              />
            </div>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {langs.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="explorer-items">
            {filtered.map((f) => (
              <button
                key={f.path}
                className={`explorer-item ${activePath === f.path ? "on" : ""}`}
                onClick={() => setSelectedPath(f.path)}
              >
                <span className="explorer-path">{f.path}</span>
                <span className="explorer-meta">
                  <span>{f.lang}</span>
                  <span>{f.lines}L{f.functions ? ` · ${f.functions} fn` : ""}</span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="hdr" style={{ padding: 12 }}>No files match filter.</p>}
          </div>
        </div>

        <div className="explorer-viewer">
          {activePath && fileRes.data ? <>
            <div className="explorer-viewer-head">
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                  {fileRes.data.path}
                </div>
                <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
                  {fileRes.data.info.lang} · {fileRes.data.info.lines} lines
                  {fileRes.data.info.functions?.length > 0 && ` · ${fileRes.data.info.functions.length} functions`}
                  {fileRes.data.info.classes?.length > 0 && ` · ${fileRes.data.info.classes.length} classes`}
                </div>
              </div>
              <button className="ghost" onClick={copyCode}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            {copyError && <p className="err" role="alert" style={{ margin: "8px 12px 0" }}>{copyError}</p>}
            <div className="code-scroll">
              {lines.map((line, idx) => (
                <div className="code-line" key={idx}>
                  <span className="code-ln">{idx + 1}</span>
                  <span className="code-txt">{line || " "}</span>
                </div>
              ))}
            </div>
          </> : (
            <div className="empty-state" style={{ border: "none", margin: "auto" }}>
              <FileCode2 size={36} />
              <p>Select a file from the list to inspect its source.</p>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}

export default function CodeExplorer() { return <NeedRepo>{(r) => <Explorer repo={r} />}</NeedRepo>; }
