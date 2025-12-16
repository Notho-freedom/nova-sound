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

// Helper function to get initial theme synchronously
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return "dark";
  const saved = localStorage.getItem("nexus-theme") as Theme | null;
  if (saved && themes.some(t => t.id === saved)) {
    return saved;
  }
  return "dark";
}

export function useTheme(): UseThemeReturn {
  // Initialize theme synchronously from localStorage to avoid flash
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme from localStorage and Firebase, and listen to Firebase sync updates
  useEffect(() => {
    const loadTheme = async () => {
      // Load from localStorage first (already done in initial state, but ensure it's applied)
      const saved = localStorage.getItem("nexus-theme") as Theme | null;
      if (saved && themes.some(t => t.id === saved)) {
        setThemeState(saved);
      }
      
      // Load from Firebase if authenticated (Firebase takes priority)
      try {
        const { firebaseSyncService } = await import('../services/firebase-sync');
        const firestoreData = await firebaseSyncService.loadFromFirestore();
        if (firestoreData?.theme && themes.some(t => t.id === firestoreData.theme)) {
          setThemeState(firestoreData.theme);
          localStorage.setItem("nexus-theme", firestoreData.theme);
        }
      } catch (error) {
        // Silently fail if Firebase sync is not available
      } finally {
        setIsLoaded(true);
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

  // Apply theme to document (only after initial load to avoid reset)
  useEffect(() => {
    if (!isLoaded) return; // Don't apply theme until we've loaded from storage
    
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
  }, [theme, systemTheme, isLoaded]);

  // Apply initial theme immediately on mount (before async load)
  useEffect(() => {
    const root = document.documentElement;
    const initialTheme = getInitialTheme();
    // For system theme, default to dark until we detect the actual system theme
    const resolvedTheme = initialTheme === "system" ? "dark" : initialTheme;

    // Remove all theme classes
    root.classList.remove("dark", "light", "cyberpunk", "minimal", "spotify", "apple-music", "youtube-music", "tidal", "deezer");

    // Add initial theme class
    root.classList.add(resolvedTheme);
  }, []); // Only run once on mount

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

