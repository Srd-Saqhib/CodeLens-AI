import { useState } from "react";
import { FileCode2, AlignLeft, Braces, Boxes, Package, GitFork, X, Sparkles } from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { useRepo } from "../hooks/useRepo.jsx";
import Status from "../components/Status.jsx";
import Summary from "../components/Summary.jsx";

const STAT_META = [
  ["Files", "files", FileCode2],
  ["Lines", "lines", AlignLeft],
  ["Functions", "functions", Braces],
  ["Classes", "classes", Boxes],
  ["Dependencies", "dependencies", Package],
  ["Import links", "edges", GitFork],
];

export default function Dashboard() {
  const { repo, setRepo } = useRepo();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const recent = useAsync(() => api.repos(), [busy, refreshTick]);
  const info = useAsync(() => (repo ? api.analysis(repo.id) : Promise.resolve(null)), [repo?.id]);

  async function analyze() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.add(url.trim());
      setRepo({ id: r.id, name: r.name });
      setUrl("");
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function removeRepo(e, item) {
    e.stopPropagation();
    try {
      await api.remove(item.id);
      if (repo?.id === item.id) setRepo(null);
      setRefreshTick((t) => t + 1);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  const st = info.data?.stats;
  const maxFolder = st ? Math.max(1, ...Object.values(st.folders || {})) : 1;

  return (<>
    <div className="page-head">
      <div>
        <h2>Understand any public GitHub repository</h2>
        <p className="hdr" style={{ marginBottom: 0 }}>
          Analyze structure, dependencies, architecture graphs, execution flows, and ask grounded questions.
        </p>
      </div>
      {repo && <span className="repo-pill">{repo.name}</span>}
    </div>

    <div className="chat-input" style={{ position: "static", marginTop: 8 }}>
      <input
        placeholder="https://github.com/owner/repo"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && analyze()}
      />
      <button className="go" onClick={analyze} disabled={busy || !url.trim()}>
        <Sparkles size={15} />
        <span>{busy ? "Analyzing…" : "Analyze"}</span>
      </button>
    </div>

    {busy && <div className="skel" />}
    {err && <p className="err">{err}</p>}

    {recent.data?.length > 0 && (
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>
          <span>Recently analyzed</span>
          <span className="card-sub">{recent.data.length} saved</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {recent.data.map((r) => (
            <div key={r.id} className={"chip" + (repo?.id === r.id ? " on" : "")} onClick={() => setRepo(r)}>
              <span>{r.name}</span>
              <button
                type="button"
                className="chip-del"
                title={`Remove ${r.name}`}
                onClick={(e) => removeRepo(e, r)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    )}

    {repo && <>
      <Status s={info} />
      {st && <>
        <div className="grid">
          {STAT_META.map(([label, key, Icon]) => (
            <div className="card stat" key={key}>
              <div className="stat-top">
                <small>{label}</small>
                <span className="stat-icon"><Icon size={15} /></span>
              </div>
              <b>{st[key]?.toLocaleString?.() ?? st[key]}</b>
            </div>
          ))}
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-title">
              <span>Technology Stack</span>
              <span className="card-sub">{Object.keys(st.languages).length} languages</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(st.languages).map(([l, n]) => (
                <span className="chip" key={l} style={{ cursor: "default" }}>{l} ({n})</span>
              ))}
            </div>
            {Object.entries(info.data.dependencies).map(([k, v]) => (
              <p key={k} style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                <small style={{ color: "var(--mute)", textTransform: "uppercase", fontWeight: 600 }}>{k}: </small>
                {v.slice(0, 18).join(", ")}{v.length > 18 ? ` +${v.length - 18} more` : ""}
              </p>
            ))}
          </div>

          <div className="card">
            <div className="card-title">
              <span>Folder Breakdown</span>
              <span className="card-sub">{Object.keys(st.folders).length} root entries</span>
            </div>
            <div className="folder-bars">
              {Object.entries(st.folders)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7)
                .map(([f, n]) => (
                  <div className="folder-row" key={f}>
                    <div className="folder-meta">
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>{f}</span>
                      <span style={{ color: "var(--mute)", fontSize: 12 }}>{n} files</span>
                    </div>
                    <div className="folder-track">
                      <div className="folder-fill" style={{ width: `${(n / maxFolder) * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {info.data.routes?.length > 0 && (
          <div className="card">
            <div className="card-title">
              <span>Detected API Routes</span>
              <span className="card-sub">{info.data.routes.length} endpoints</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {info.data.routes.slice(0, 16).map((rt, i) => (
                <div key={i} className="chip" style={{ cursor: "default" }}>
                  <span className="method-badge">{rt.method}</span>
                  <code>{rt.path}</code>
                  <small style={{ color: "var(--mute)" }}>{rt.file}:{rt.line}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        <Summary id={repo.id} />
      </>}
    </>}
  </>);
}
