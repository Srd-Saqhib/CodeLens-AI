import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "codelens-theme";
const ThemeCtx = createContext({ theme: "system", resolvedTheme: "dark", setTheme: () => {} });

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
    } catch {
      return "system";
    }
  });
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = (next) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };

  return <ThemeCtx.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
