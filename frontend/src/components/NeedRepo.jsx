import { Link } from "react-router-dom";
import { useRepo } from "../hooks/useRepo.jsx";

// Wraps a page: shows an empty state until a repository has been analyzed.
export default function NeedRepo({ children }) {
  const { repo } = useRepo();
  if (!repo) return <div className="card"><b>No repository yet</b><p>Analyze a GitHub repository on the <Link to="/">Dashboard</Link> first.</p></div>;
  return children(repo);
}
