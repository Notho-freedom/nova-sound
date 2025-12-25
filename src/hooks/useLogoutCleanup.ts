import React, { useEffect, useRef, useState } from 'react';
import { useLogoutCleanupListener, DEFAULT_RESET_VALUES } from '@/lib/logout-cleanup';

/**
 * Hook permettant aux composants de s'auto-nettoyer lors du logout
 * Usage:
 * 
 * const myRef = useRef(null);
 * const [myState, setMyState] = useState('initial');
 * 
 * useLogoutCleanup(() => {
 *   myRef.current = null;
 *   setMyState('initial');
 * });
 */
export function useLogoutCleanup(cleanupFunction: () => void): void {
  const cleanupRef = useRef(cleanupFunction);
  
  // Mettre à jour la référence à chaque render
  cleanupRef.current = cleanupFunction;
  
  useEffect(() => {
    const cleanup = useLogoutCleanupListener(() => {
      cleanupRef.current();
    });
    
    return cleanup;
  }, []);
}

/**
 * Hook pour auto-reset un state lors du logout
 * Usage:
 * 
 * const [value, setValue] = useAutoResetState('initial');
 * // Lors du logout, setValue sera automatiquement appelé avec 'initial'
 */
export function useAutoResetState<T>(
  initialValue: T
): [T, (value: T | ((prevValue: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue);
  
  useLogoutCleanup(() => {
    setValue(initialValue);
  });
  
  return [value, setValue];
}

/**
 * Hook pour auto-reset un ref lors du logout
 * Usage:
 * 
 * const myRef = useAutoResetRef<string | null>(null);
 * // Lors du logout, myRef.current sera automatiquement null
 */
export function useAutoResetRef<T>(initialValue: T): React.MutableRefObject<T> {
  const ref = useRef<T>(initialValue);
  
  useLogoutCleanup(() => {
    ref.current = initialValue;
  });
  
  return ref;
}

/**
 * Hook pour auto-reset plusieurs states lors du logout
 * Usage:
 * 
 * const [user, setUser] = useState(null);
 * const [config, setConfig] = useState({});
 * 
 * useMultiStateReset({
 *   user: [setUser, null],
 *   config: [setConfig, {}]
 * });
 */
export function useMultiStateReset(
  resetConfig: Record<string, [React.Dispatch<React.SetStateAction<any>>, any]>
): void {
  useLogoutCleanup(() => {
    Object.entries(resetConfig).forEach(([key, [setter, resetValue]]) => {
      setter(resetValue);
    });
  });
}

/**
 * Hook pour nettoyer le localStorage spécifique à un composant
 * Usage:
 * 
 * useLocalStorageCleanup(['myKey1', 'myKey2']);
 */
export function useLocalStorageCleanup(keys: string[]): void {
  useLogoutCleanup(() => {
    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`, error);
      }
    });
  });
}