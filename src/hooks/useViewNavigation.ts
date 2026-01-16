import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ViewType } from '@/components/Sidebar';

interface NavigationState {
  current: ViewType;
  history: ViewType[];
  historyIndex: number;
}

interface ViewParams {
  albumId?: string;
  artistId?: string;
  playlistId?: string;
  trackId?: string;
}

interface NavigationOptions {
  replace?: boolean; // Replace current history entry instead of pushing
  params?: ViewParams;
}

const INITIAL_VIEW: ViewType = 'home';
const MAX_HISTORY = 50;

/**
 * Orchestrateur de navigation entre vues
 * - Navigation directe vers n'importe quelle vue
 * - Historique de navigation avec back/forward
 * - Raccourcis clavier (Alt+Left/Right, Backspace)
 * - Transitions optimisées avec startTransition
 */
export function useViewNavigation() {
  const [state, setState] = useState<NavigationState>({
    current: INITIAL_VIEW,
    history: [INITIAL_VIEW],
    historyIndex: 0,
  });

  const [viewParams, setViewParams] = useState<ViewParams>({});

  // Navigation vers une vue spécifique
  const navigateTo = useCallback((view: ViewType, options?: NavigationOptions) => {
    const { replace = false, params } = options || {};

    setState(prev => {
      // Si c'est la même vue, ne rien faire (sauf si params changent)
      if (prev.current === view && !params) {
        return prev;
      }

      let newHistory: ViewType[];
      let newIndex: number;

      if (replace) {
        // Remplacer l'entrée actuelle
        newHistory = [...prev.history];
        newHistory[prev.historyIndex] = view;
        newIndex = prev.historyIndex;
      } else {
        // Couper l'historique après la position actuelle et ajouter la nouvelle vue
        newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push(view);
        
        // Limiter la taille de l'historique
        if (newHistory.length > MAX_HISTORY) {
          newHistory = newHistory.slice(-MAX_HISTORY);
        }
        
        newIndex = newHistory.length - 1;
      }

      return {
        current: view,
        history: newHistory,
        historyIndex: newIndex,
      };
    });

    // Mettre à jour les paramètres si fournis
    if (params) {
      setViewParams(params);
    }
  }, []);

  // Retour arrière dans l'historique
  const goBack = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex <= 0) {
        return prev;
      }

      const newIndex = prev.historyIndex - 1;
      return {
        ...prev,
        current: prev.history[newIndex],
        historyIndex: newIndex,
      };
    });
  }, []);

  // Avancer dans l'historique
  const goForward = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex >= prev.history.length - 1) {
        return prev;
      }

      const newIndex = prev.historyIndex + 1;
      return {
        ...prev,
        current: prev.history[newIndex],
        historyIndex: newIndex,
      };
    });
  }, []);

  // Aller à une position spécifique dans l'historique
  const goToHistoryIndex = useCallback((index: number) => {
    setState(prev => {
      if (index < 0 || index >= prev.history.length) {
        return prev;
      }

      return {
        ...prev,
        current: prev.history[index],
        historyIndex: index,
      };
    });
  }, []);

  // Raccourcis de navigation
  const shortcuts = useMemo(() => ({
    home: () => navigateTo('home'),
    search: () => navigateTo('search'),
    library: () => navigateTo('library'),
    favorites: () => navigateTo('favorites'),
    playlists: () => navigateTo('playlists'),
    settings: () => navigateTo('settings'),
    notifications: () => navigateTo('notifications'),
    videos: () => navigateTo('videos'),
    cloud: () => navigateTo('cloud'),
    audioSenses: () => navigateTo('audio-senses'),
    albums: () => navigateTo('albums'),
    artists: () => navigateTo('artists'),
    recent: () => navigateTo('recent'),
    // Navigation avec paramètres
    album: (albumId: string) => navigateTo('album-detail', { params: { albumId } }),
    artist: (artistId: string) => navigateTo('artist-detail', { params: { artistId } }),
    playlist: (playlistId: string) => navigateTo('playlists', { params: { playlistId } }),
  }), [navigateTo]);

  // État de navigation
  const canGoBack = state.historyIndex > 0;
  const canGoForward = state.historyIndex < state.history.length - 1;

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Alt + Left = Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
        return;
      }

      // Alt + Right = Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
        return;
      }

      // Backspace = Back (si pas dans un input)
      if (e.key === 'Backspace' && canGoBack) {
        e.preventDefault();
        goBack();
        return;
      }

      // Ctrl/Cmd + H = Home
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        shortcuts.home();
        return;
      }

      // Ctrl/Cmd + F = Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        shortcuts.search();
        return;
      }

      // Ctrl/Cmd + L = Library
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        shortcuts.library();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward, canGoBack, shortcuts]);

  return {
    // État actuel
    currentView: state.current,
    viewParams,
    history: state.history,
    historyIndex: state.historyIndex,
    
    // Navigation
    navigateTo,
    goBack,
    goForward,
    goToHistoryIndex,
    
    // État de navigation
    canGoBack,
    canGoForward,
    
    // Raccourcis
    shortcuts,
    
    // Alias pour compatibilité
    setCurrentView: navigateTo,
  };
}

export type { ViewParams, NavigationOptions };
