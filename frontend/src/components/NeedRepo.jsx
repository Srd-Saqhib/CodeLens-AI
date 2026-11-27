import { Link } from "react-router-dom";
import { FolderSearch } from "lucide-react";
import { useRepo } from "../hooks/useRepo.jsx";

export default function NeedRepo({ children }) {
  const { repo, repoError } = useRepo();
  if (repoError) return (
    <div className="empty-state">
      <p className="err">{repoError}</p>
      <p>Visit the <Link to="/" style={{color: "var(--accent)"}}>Dashboard</Link> to select a repository.</p>
    </div>
  );
  if (!repo) return (
    <div className="empty-state">
      <FolderSearch size={48} />
      <p><b>No repository yet</b></p>
      <p>Analyze a GitHub repository on the <Link to="/" style={{color: "var(--accent)"}}>Dashboard</Link> first.</p>
    </div>
  );
  return children(repo);
}
