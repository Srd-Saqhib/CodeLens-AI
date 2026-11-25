import { useState } from "react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { useRepo } from "../hooks/useRepo.jsx";
import Status from "../components/Status.jsx";
import Summary from "../components/Summary.jsx";

export default function Dashboard() {
  const { repo, setRepo } = useRepo();
  const [url, setUrl] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const recent = useAsync(() => api.repos(), [busy]);
  const info = useAsync(() => (repo ? api.analysis(repo.id) : Promise.resolve(null)), [repo?.id]);

  async function analyze() {
    setBusy(true); setErr("");
    try { const r = await api.add(url); setRepo({ id: r.id, name: r.name }); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  const st = info.data?.stats;
  return (<>
    <h2>Understand any public GitHub repository</h2>
    <input placeholder="https://github.com/owner/repo" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} />
    <button className="go" onClick={analyze} disabled={busy || !url}>{busy ? "Downloading and analyzing…" : "Analyze repository"}</button>
    {busy && <div className="skel" />}
    {err && <p className="err">{err}</p>}
    {recent.data?.length > 0 && <div className="card"><b>Recently analyzed</b><div>
      {recent.data.map((r) => <button key={r.id} className={"chip" + (repo?.id === r.id ? " on" : "")} onClick={() => setRepo(r)}>{r.name}</button>)}</div></div>}
    {!repo && !busy && <p className="hdr">Paste a URL above to get a summary, architecture graph, execution flows and a chat grounded in the code.</p>}
    {repo && <>
      <Status s={info} />
      {st && <>
        <div className="grid">{[["Files", st.files], ["Lines", st.lines], ["Functions", st.functions], ["Classes", st.classes], ["Dependencies", st.dependencies], ["Import links", st.edges]]
          .map(([k, v]) => <div className="card stat" key={k}><b>{v}</b><small>{k}</small></div>)}</div>
        <div className="card"><b>Technology stack</b>
          <div>{Object.entries(st.languages).map(([l, n]) => <span className="chip" key={l}>{l} ({n})</span>)}</div>
          {Object.entries(info.data.dependencies).map(([k, v]) => <p key={k}><small>{k}:</small> {v.slice(0, 20).join(", ")}</p>)}</div>
        <div className="card"><b>Folders</b><div>{Object.entries(st.folders).map(([f, n]) => <span className="chip" key={f}>{f} ({n})</span>)}</div></div>
        <Summary id={repo.id} />
      </>}
    </>}
  </>);
}
