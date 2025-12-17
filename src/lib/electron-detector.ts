/**
 * Utilitaire centralisé pour détecter l'environnement Electron
 * 
 * Cette fonction vérifie de manière fiable si l'application s'exécute
 * dans Electron en vérifiant la présence de window.electronAPI
 */

/**
 * Vérifie si l'application s'exécute dans Electron
 * @returns true si Electron est détecté, false sinon
 */
export function isElectron(): boolean {
  // Vérifier que nous sommes dans un environnement navigateur
  if (typeof window === 'undefined') {
    return false;
  }

  // Vérifier la présence de window.electronAPI
  // electronAPI est injecté par le preload script dans Electron
  return typeof window.electronAPI !== 'undefined' && window.electronAPI !== null;
}

/**
 * Hook React pour détecter Electron de manière réactive
 * @returns true si Electron est détecté, false sinon
 */
export function useIsElectron(): boolean {
  // Utiliser une vérification synchrone pour éviter les re-renders inutiles
  // window.electronAPI est disponible immédiatement au chargement de la page
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof window.electronAPI !== 'undefined' && window.electronAPI !== null;
}

/**
 * Vérifie si l'application s'exécute dans un navigateur web
 * @returns true si c'est un navigateur web, false si c'est Electron
 */
export function isWeb(): boolean {
  return !isElectron();
}

/**
 * Obtient l'API Electron de manière sécurisée
 * @returns L'API Electron ou null si non disponible
 */
export function getElectronAPI(): typeof window.electronAPI {
  if (isElectron()) {
    return window.electronAPI!;
  }
  return undefined;
}
