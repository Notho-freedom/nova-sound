/**
 * EXEMPLE D'UTILISATION DES HOOKS DE NETTOYAGE DE LOGOUT
 * 
 * Ce fichier démontre comment utiliser le système de nettoyage lors de la déconnexion
 * dans vos composants et hooks personnalisés.
 */

import React, { useState, useRef } from 'react';
import { 
  useLogoutCleanup, 
  useAutoResetState, 
  useAutoResetRef,
  useMultiStateReset,
  useLocalStorageCleanup 
} from '@/hooks/useLogoutCleanup';

// =====================================
// EXEMPLE 1: Hook personnalisé avec nettoyage
// =====================================

function useCustomHookWithCleanup() {
  const [data, setData] = useState([]);
  const cacheRef = useRef(new Map());
  
  // Nettoyage personnalisé lors du logout
  useLogoutCleanup(() => {
    console.log('Cleaning up custom hook...');
    setData([]);
    cacheRef.current.clear();
  });
  
  return { data, setData, cache: cacheRef.current };
}

// =====================================
// EXEMPLE 2: Composant avec auto-reset des states
// =====================================

function ExampleComponent() {
  // Auto-reset states - se remettent automatiquement aux valeurs initiales lors du logout
  const [tracks, setTracks] = useAutoResetState([]);
  const [currentTrack, setCurrentTrack] = useAutoResetState(null);
  const [volume, setVolume] = useAutoResetState(100);
  
  // Auto-reset ref - se remet automatiquement à null lors du logout
  const audioRef = useAutoResetRef(null);
  
  return (
    <div>
      <h2>Player Component</h2>
      <p>Tracks: {tracks.length}</p>
      <p>Volume: {volume}%</p>
      <audio ref={audioRef} />
    </div>
  );
}

// =====================================
// EXEMPLE 3: Nettoyage de multiple states à la fois
// =====================================

function MultiStateComponent() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({});
  const [cache, setCache] = useState(new Map());
  
  // Nettoyer plusieurs states en une fois
  useMultiStateReset({
    user: [setUser, null],
    preferences: [setPreferences, {}],
    cache: [setCache, new Map()]
  });
  
  return <div>Multi-state component</div>;
}

// =====================================
// EXEMPLE 4: Nettoyage du localStorage spécifique
// =====================================

function LocalStorageComponent() {
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('myComponentSettings') || '{}');
    } catch {
      return {};
    }
  });
  
  // Nettoyer les clés localStorage spécifiques à ce composant
  useLocalStorageCleanup([
    'myComponentSettings',
    'myComponentCache',
    'myComponentHistory'
  ]);
  
  // Nettoyage personnalisé additionnel
  useLogoutCleanup(() => {
    console.log('Component specific cleanup');
    setSettings({});
  });
  
  return <div>LocalStorage Component</div>;
}

// =====================================
// EXEMPLE 5: Composant de service avec nettoyage avancé
// =====================================

function ServiceComponent() {
  const [isConnected, setIsConnected] = useState(false);
  const websocketRef = useRef(null);
  const timersRef = useRef([]);
  
  useLogoutCleanup(() => {
    console.log('Cleaning up service connections...');
    
    // Fermer websocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    // Nettoyer les timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
    
    // Réinitialiser état
    setIsConnected(false);
  });
  
  return <div>Service Component</div>;
}

// =====================================
// EXEMPLE 6: Hook pour service externe
// =====================================

function useYouTubeService() {
  const [cache, setCache] = useState(new Map());
  const [quotaUsed, setQuotaUsed] = useState(0);
  const apiKeyRef = useRef(null);
  
  useLogoutCleanup(() => {
    console.log('Cleaning up YouTube service...');
    
    // Vider le cache
    setCache(new Map());
    
    // Reset quota
    setQuotaUsed(0);
    
    // Effacer la clé API
    apiKeyRef.current = null;
    
    // Nettoyer le cache localStorage si utilisé
    try {
      localStorage.removeItem('youtube-cache');
      localStorage.removeItem('youtube-quota');
    } catch (error) {
      console.warn('Failed to clean YouTube localStorage:', error);
    }
  });
  
  return { cache, quotaUsed, apiKey: apiKeyRef.current };
}

// Export des exemples pour référence
export {
  useCustomHookWithCleanup,
  ExampleComponent,
  MultiStateComponent,
  LocalStorageComponent,
  ServiceComponent,
  useYouTubeService
};