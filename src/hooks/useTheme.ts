import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light" | "cyberpunk" | "minimal" | "spotify" | "apple-music" | "youtube-music" | "tidal" | "deezer" | "system";

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
  { id: "spotify", name: "Spotify" },
  { id: "apple-music", name: "Apple Music" },
  { id: "youtube-music", name: "YouTube Music" },
  { id: "tidal", name: "Tidal" },
  { id: "deezer", name: "Deezer" },
  { id: "system", name: "Système" },
];

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");

  // Load theme from localStorage and Firebase, and listen to Firebase sync updates
  useEffect(() => {
    const loadTheme = async () => {
      // Load from localStorage first
      const saved = localStorage.getItem("nexus-theme") as Theme | null;
      if (saved && themes.some(t => t.id === saved)) {
        setThemeState(saved);
      }
      
      // Load from Firebase if authenticated
      try {
        const { firebaseSyncService } = await import('../services/firebase-sync');
        const firestoreData = await firebaseSyncService.loadFromFirestore();
        if (firestoreData?.theme && themes.some(t => t.id === firestoreData.theme)) {
          setThemeState(firestoreData.theme);
          localStorage.setItem("nexus-theme", firestoreData.theme);
        }
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    };
    
    loadTheme();

    // Listen to Firebase sync updates
    const handleSyncUpdate = (event: CustomEvent) => {
      if (event.detail?.theme && themes.some(t => t.id === event.detail.theme)) {
        setThemeState(event.detail.theme);
      }
    };

    window.addEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
    return () => {
      window.removeEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
    };

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
    root.classList.remove("dark", "light", "cyberpunk", "minimal", "spotify", "apple-music", "youtube-music", "tidal", "deezer");

    // Add current theme class
    root.classList.add(resolvedTheme);

    // Save to localStorage
    localStorage.setItem("nexus-theme", theme);
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('../services/firebase-sync');
        firebaseSyncService.queueSync('theme', theme);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
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

