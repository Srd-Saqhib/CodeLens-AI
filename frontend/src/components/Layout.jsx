import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Network, MessageSquare, GitBranch, BarChart3,
  FileCode2, Code2, Sun, Moon, Monitor
} from "lucide-react";
import { api } from "../services/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { useTheme } from "../hooks/useTheme.jsx";

const items = [
  ["/", LayoutDashboard, "Dashboard"],
  ["/architecture", Network, "Architecture"],
  ["/flow", GitBranch, "Execution Flow"],
  ["/analytics", BarChart3, "Analytics"],
  ["/files", FileCode2, "Code Explorer"],
  ["/chat", MessageSquare, "AI Chat"],
];

const THEMES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "Auto", Icon: Monitor },
];

export default function Layout() {
  const { theme, setTheme } = useTheme();
  const status = useAsync(() => api.status(), []);
  const aiActive = status.data?.ai;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="brand-badge"><Code2 size={18} /></div>
          <div>
            <div className="brand-title">CodeLens AI</div>
            <div className="brand-sub">Repo Intelligence</div>
          </div>
        </div>

        <nav className="nav-links">
        {items.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "on" : "")}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
        ))}
        </nav>

        <div className="side-footer">
          {status.data && (
            <div className="ai-badge" title={aiActive ? "Gemini API key configured" : "Add GEMINI_API_KEY in backend/.env for AI summaries and RAG"}>
              <span className={`status-dot ${aiActive ? "live" : "static"}`} />
              <span>{aiActive ? "Gemini AI Active" : "Static Mode"}</span>
            </div>
          )}

          <div className="theme-switch" role="group" aria-label="Theme selector">
            {THEMES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`theme-btn ${theme === id ? "on" : ""}`}
                onClick={() => setTheme(id)}
                title={`Theme: ${id === "system" ? "System Default" : label}`}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
