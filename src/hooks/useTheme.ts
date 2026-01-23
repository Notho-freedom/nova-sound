import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Theme types with categories
export type BaseTheme = "dark" | "light" | "system";
export type MusicTheme = "cyberpunk" | "minimal" | "spotify" | "apple-music" | "youtube-music" | "tidal" | "deezer";
export type Theme = BaseTheme | MusicTheme;

export interface ThemeDefinition {
  id: Theme;
  name: string;
  category: "base" | "music";
  description: string;
  accentColor: string; // HSL gradient for preview
}

const themeDefinitions: ThemeDefinition[] = [
  // Base themes
  { id: "light", name: "Clair", category: "base", description: "Mode clair Vision Pro", accentColor: "from-amber-400 to-orange-500" },
  { id: "dark", name: "Sombre", category: "base", description: "Mode sombre spatial", accentColor: "from-indigo-500 to-purple-600" },
  { id: "system", name: "Système", category: "base", description: "Suivre les préférences système", accentColor: "from-gray-400 to-gray-600" },
  // Music themes
  { id: "cyberpunk", name: "Cyberpunk", category: "music", description: "Néons jaune et rose sur violet", accentColor: "from-yellow-400 via-pink-500 to-purple-600" },
  { id: "minimal", name: "Minimal", category: "music", description: "Monochrome épuré", accentColor: "from-gray-700 to-gray-900" },
  { id: "spotify", name: "Spotify", category: "music", description: "Vert signature sur gris sombre", accentColor: "from-green-500 to-green-700" },
  { id: "apple-music", name: "Apple Music", category: "music", description: "Rouge vibrant sur noir raffiné", accentColor: "from-red-500 to-pink-600" },
  { id: "youtube-music", name: "YouTube Music", category: "music", description: "Rouge audacieux sur noir pur", accentColor: "from-red-600 to-red-800" },
  { id: "tidal", name: "Tidal", category: "music", description: "Cyan sur bleu océan profond", accentColor: "from-cyan-400 to-cyan-600" },
  { id: "deezer", name: "Deezer", category: "music", description: "Dégradé cyan vers rose", accentColor: "from-cyan-400 via-pink-500 to-purple-500" },
];

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: Exclude<Theme, "system">;
  setTheme: (theme: Theme) => void;
  themes: ThemeDefinition[];
  baseThemes: ThemeDefinition[];
  musicThemes: ThemeDefinition[];
  isDark: boolean;
  isLight: boolean;
  toggleLightDark: () => void;
}

// All valid theme IDs
const validThemeIds = themeDefinitions.map(t => t.id);

// Helper function to get initial theme synchronously
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return "dark";
  const saved = localStorage.getItem("nexus-theme") as Theme | null;
  if (saved && validThemeIds.includes(saved)) {
    return saved;
  }
  return "dark";
}

// Determine if a theme is "dark-based" (for system theme resolution)
function isDarkBasedTheme(theme: Exclude<Theme, "system">): boolean {
  // Light is the only truly light theme
  return theme !== "light";
}

export function useTheme(): UseThemeReturn {
  // Initialize theme synchronously from localStorage to avoid flash
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [systemPreference, setSystemPreference] = useState<"dark" | "light">("dark");
  const [isLoaded, setIsLoaded] = useState(false);
  // Track if user changed theme in current session to avoid remote override
  const userChangedThemeRef = useRef(false);

  // Compute resolved theme (handle "system" option)
  const resolvedTheme = useMemo((): Exclude<Theme, "system"> => {
    if (theme === "system") {
      return systemPreference;
    }
    return theme;
  }, [theme, systemPreference]);

  // Apply theme to document immediately when theme changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("dark", "light", "cyberpunk", "minimal", "spotify", "apple-music", "youtube-music", "tidal", "deezer");

    // Add current resolved theme class
    root.classList.add(resolvedTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const bgColor = getComputedStyle(root).getPropertyValue('--background');
    if (metaThemeColor && bgColor) {
      metaThemeColor.setAttribute('content', `hsl(${bgColor})`);
    }

    // Save to localStorage and sync to Firebase (only if not initial load)
    if (isLoaded) {
      localStorage.setItem("nexus-theme", theme);
      
      // Sync to Firebase
      (async () => {
        try {
          const { firebaseSyncService } = await import('@/services/firebase-sync');
          firebaseSyncService.queueSync('theme', theme);
        } catch (error) {
          // Silently fail if Firebase sync is not available
        }
      })();
    }
  }, [theme, resolvedTheme, isLoaded]);

  // Load theme and listen for updates
  useEffect(() => {
    // Apply initial theme immediately
    const initialTheme = getInitialTheme();
    if (initialTheme !== theme) {
      setThemeState(initialTheme);
    }
    
    // Apply initial theme to document
    const root = document.documentElement;
    const resolvedInitialTheme = initialTheme === "system" ? "dark" : initialTheme;
    root.classList.remove("dark", "light", "cyberpunk", "minimal", "spotify", "apple-music", "youtube-music", "tidal", "deezer");
    root.classList.add(resolvedInitialTheme);

    const loadTheme = async () => {
      // Load from localStorage first
      const saved = localStorage.getItem("nexus-theme") as Theme | null;
      if (saved && validThemeIds.includes(saved) && saved !== theme) {
        setThemeState(saved);
      }
      
      // Load from Firebase if authenticated
      try {
        const { firebaseSyncService } = await import('@/services/firebase-sync');
        const firestoreData = await firebaseSyncService.loadFromFirestore();
        // Do not override if user changed theme in this session
        if (!userChangedThemeRef.current && firestoreData?.theme && validThemeIds.includes(firestoreData.theme)) {
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
      if (userChangedThemeRef.current) return;
      if (event.detail?.theme && validThemeIds.includes(event.detail.theme) && event.detail.theme !== theme) {
        console.log('[useTheme] Firebase sync: updating theme from', theme, 'to', event.detail.theme);
        setThemeState(event.detail.theme);
      }
    };

    // Watch system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPreference(mediaQuery.matches ? "dark" : "light");

    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    window.addEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
    mediaQuery.addEventListener("change", handleSystemChange);
    
    return () => {
      window.removeEventListener('firebase-sync-update', handleSyncUpdate as EventListener);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [theme]);

  // Set theme with user flag
  const setTheme = useCallback((newTheme: Theme) => {
    userChangedThemeRef.current = true;
    setThemeState(newTheme);
  }, []);

  // Toggle between light and dark (or to light if using a music theme)
  const toggleLightDark = useCallback(() => {
    if (resolvedTheme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  }, [resolvedTheme, setTheme]);

  // Memoized theme lists
  const baseThemes = useMemo(() => themeDefinitions.filter(t => t.category === "base"), []);
  const musicThemes = useMemo(() => themeDefinitions.filter(t => t.category === "music"), []);

  return {
    theme,
    resolvedTheme,
    setTheme,
    themes: themeDefinitions,
    baseThemes,
    musicThemes,
    isDark: isDarkBasedTheme(resolvedTheme),
    isLight: resolvedTheme === "light",
    toggleLightDark,
  };
}

