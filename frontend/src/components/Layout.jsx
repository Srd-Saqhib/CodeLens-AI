import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Network, MessageSquare, GitBranch, BarChart3 } from "lucide-react";
import { useRepo } from "../hooks/useRepo.jsx";

const items = [["/", LayoutDashboard, "Dashboard"], ["/architecture", Network, "Architecture"], ["/chat", MessageSquare, "AI Chat"],
  ["/flow", GitBranch, "Execution flow"], ["/analytics", BarChart3, "Analytics"]];

export default function Layout() {
  const { repo } = useRepo();
  return (
    <div className="app">
      <nav className="side">
        <h3>CodeLens AI</h3>
        {items.map(([to, Icon, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "on" : "")}><Icon size={15} /> {label}</NavLink>
        ))}
        <div className="hdr">{repo ? repo.name : "No repository selected"}</div>
      </nav>
      <main className="main"><Outlet /></main>
    </div>
  );
}
