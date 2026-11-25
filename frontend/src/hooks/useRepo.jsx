import { createContext, useContext, useState } from "react";
const Ctx = createContext(null);
export const useRepo = () => useContext(Ctx);

// Keeps the selected repository ({id, name}) across pages and reloads.
export function RepoProvider({ children }) {
  const [repo, setRepoState] = useState(() => { try { return JSON.parse(localStorage.getItem("repo")); } catch { return null; } });
  const setRepo = (r) => { setRepoState(r); try { localStorage.setItem("repo", JSON.stringify(r)); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ repo, setRepo }}>{children}</Ctx.Provider>;
}
