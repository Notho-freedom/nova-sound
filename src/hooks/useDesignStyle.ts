import { useState, useEffect, useCallback } from "react";
import { useTheme } from "./useTheme";

export type DesignStyle = "nexus" | "apple";

interface UseDesignStyleReturn {
  designStyle: DesignStyle;
  setDesignStyle: (style: DesignStyle) => void;
  styles: { id: DesignStyle; name: string; description: string }[];
}

const styles: { id: DesignStyle; name: string; description: string }[] = [
  { 
    id: "nexus", 
    name: "Nexus", 
    description: "Style futuriste avec effets néon et glassmorphism" 
  },
  { 
    id: "apple", 
    name: "Apple", 
    description: "Style minimaliste et élégant inspiré d'Apple" 
  },
];

export function useDesignStyle(): UseDesignStyleReturn {
  const { setTheme } = useTheme();
  const [designStyle, setDesignStyleState] = useState<DesignStyle>(() => {
    // Load from localStorage or default to nexus
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("nexus-design-style") as DesignStyle | null;
      const style = saved && styles.some(s => s.id === saved) ? saved : "nexus";
      // Apply immediately on mount
      const root = document.documentElement;
      root.classList.remove("design-nexus", "design-apple");
      root.classList.add(`design-${style}`);
      return style;
    }
    return "nexus";
  });

  // Apply design style to document when it changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all design style classes
    root.classList.remove("design-nexus", "design-apple");
    
    // Add current design style class
    root.classList.add(`design-${designStyle}`);

    // Save to localStorage
    localStorage.setItem("nexus-design-style", designStyle);
    
    // Auto-apply Apple theme when Apple design style is selected
    if (designStyle === "apple") {
      const currentTheme = localStorage.getItem("nexus-theme");
      // Only apply if not already an Apple-related theme
      if (currentTheme !== "apple" && currentTheme !== "apple-music") {
        setTheme("apple");
      }
    }
    
    // Sync to Firebase
    (async () => {
      try {
        const { firebaseSyncService } = await import('../services/firebase-sync');
        firebaseSyncService.queueSync('designStyle', designStyle);
      } catch (error) {
        // Silently fail if Firebase sync is not available
      }
    })();
  }, [designStyle, setTheme]);

  const setDesignStyle = useCallback((newStyle: DesignStyle) => {
    setDesignStyleState(newStyle);
  }, []);

  return {
    designStyle,
    setDesignStyle,
    styles,
  };
}

