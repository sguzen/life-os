"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("life-os-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
  }, []);

  // Sync class on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    if (theme === "dark") root.classList.add("dark");
    localStorage.setItem("life-os-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
