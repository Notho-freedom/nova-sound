import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light" | "cyberpunk" | "minimal" | "system";

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: Exclude<Theme, "system">;
  setTheme: (theme: Theme) => void;
  themes: { id: Theme; name: string }[];
}

const themes: { id: Theme; name: string }[] = [
  { id: "dark", name: "Sombre" },
  { id: "light", name: "Clair" },
  { id: "cyberpunk", name: "Cyberpunk" },
  { id: "minimal", name: "Minimal" },
  { id: "system", name: "Système" },
];

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexus-theme") as Theme | null;
    if (saved && themes.some(t => t.id === saved)) {
      setThemeState(saved);
    }

    // Watch system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = theme === "system" ? systemTheme : theme;

    // Remove all theme classes
    root.classList.remove("dark", "light", "cyberpunk", "minimal");

    // Add current theme class
    root.classList.add(resolvedTheme);

    // Save to localStorage
    localStorage.setItem("nexus-theme", theme);
  }, [theme, systemTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  return {
    theme,
    resolvedTheme,
    setTheme,
    themes,
  };
}

