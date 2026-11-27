import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api.js";
const Ctx = createContext(null);
export const useRepo = () => useContext(Ctx);

// Keeps the selected repository ({id, name}) across pages and reloads.
export function RepoProvider({ children }) {
  const [repo, setRepoState] = useState(() => { try { return JSON.parse(localStorage.getItem("repo")); } catch { return null; } });
  const [repoError, setRepoError] = useState("");
  const setRepo = useCallback((r) => {
    setRepoState(r);
    setRepoError("");
    try { localStorage.setItem("repo", JSON.stringify(r)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!repo?.id) return undefined;
    let active = true;
    api.analysis(repo.id).catch(async (error) => {
      if (error.status !== 404) return;
      try {
        const repos = await api.repos();
        if (active) setRepo(repos[0] || null);
      } catch (recoveryError) {
        if (active) setRepoError(`Could not restore repository selection: ${recoveryError.message}`);
      }
    });
    return () => { active = false; };
  }, [repo?.id, setRepo]);

  return <Ctx.Provider value={{ repo, setRepo, repoError }}>{children}</Ctx.Provider>;
}
