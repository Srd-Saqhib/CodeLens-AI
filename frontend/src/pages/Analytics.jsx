import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import NeedRepo from "../components/NeedRepo.jsx";
import Status from "../components/Status.jsx";

const COLORS = ["#4cc2b0", "#7aa2f7", "#e0af68", "#bb9af7", "#f7768e", "#8497ab"];
const rows = (o) => Object.entries(o || {}).map(([name, value]) => ({ name, value }));

function Bars({ title, data }) {
  return <div className="card"><b>{title}</b><ResponsiveContainer width="100%" height={230}><BarChart data={data}>
    <XAxis dataKey="name" stroke="#8497ab" /><YAxis stroke="#8497ab" /><Tooltip /><Bar dataKey="value" fill="#4cc2b0" /></BarChart></ResponsiveContainer></div>;
}

function Charts({ id }) {
  const s = useAsync(() => api.analysis(id), [id]);
  const st = s.data?.stats;
  return (<>
    <h2>Analytics</h2><Status s={s} />
    {st && <>
      <div className="grid">{[["Files", st.files], ["Lines", st.lines], ["Functions", st.functions], ["Classes", st.classes], ["Dependencies", st.dependencies], ["Import links", st.edges]]
        .map(([k, v]) => <div className="card stat" key={k}><b>{v}</b><small>{k}</small></div>)}</div>
      <div className="card"><b>Language distribution (files)</b><ResponsiveContainer width="100%" height={230}><PieChart>
        <Pie data={rows(st.languages)} dataKey="value" nameKey="name" label>{rows(st.languages).map((_, i) => <Cell key={i} fill={COLORS[i % 6]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
      <Bars title="Files per top-level folder" data={rows(st.folders)} />
      <Bars title="Files per layer" data={rows(st.layers)} />
      <Bars title="Most connected modules (imports in + out)" data={st.most_connected.map((m) => ({ name: m.name.split("/").pop(), value: m.value }))} />
      <Bars title="Dependencies per ecosystem" data={Object.entries(s.data.dependencies).map(([name, v]) => ({ name, value: v.length }))} />
    </>}
  </>);
}
export default function Analytics() { return <NeedRepo>{(r) => <Charts id={r.id} />}</NeedRepo>; }
