/**
 * Gestionnaire centralisé pour l'AudioContext et les sources audio
 * Permet de partager le même AudioContext et MediaElementSourceNode entre tous les hooks
 */

let globalAudioContext: AudioContext | null = null;
let globalSource: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | HTMLVideoElement | null = null;
let sourceReferenceCount: number = 0; // Compteur de références pour la source
let directDestinationConnection: GainNode | null = null; // Connexion directe source -> destination pour garantir le son

export function getOrCreateAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return globalAudioContext;
}

export function getOrCreateMediaElementSource(
  audioElement: HTMLAudioElement | HTMLVideoElement
): MediaElementAudioSourceNode | null {
  // Si c'est le même élément, retourner la source existante et incrémenter le compteur
  if (connectedElement === audioElement && globalSource) {
    sourceReferenceCount++;
    return globalSource;
  }

  // Si un autre élément est connecté, on ne peut pas créer une nouvelle source
  if (connectedElement && connectedElement !== audioElement) {
    console.warn('Audio element already connected to a different element');
    return null;
  }

  try {
    const audioContext = getOrCreateAudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    globalSource = source;
    connectedElement = audioElement;
    sourceReferenceCount = 1; // Première référence
    
    // Créer une connexion directe source -> destination pour garantir que le son passe toujours
    // même si tous les analyseurs sont déconnectés
    if (!directDestinationConnection) {
      directDestinationConnection = audioContext.createGain();
      directDestinationConnection.gain.value = 1.0;
      source.connect(directDestinationConnection);
      directDestinationConnection.connect(audioContext.destination);
    }
    
    return source;
  } catch (error: any) {
    console.warn('Failed to create MediaElementSourceNode:', error.message);
    return null;
  }
}

/**
 * Libère une référence à la source partagée
 * Ne déconnecte la source que si toutes les références sont libérées
 */
export function releaseMediaElementSource(): void {
  sourceReferenceCount = Math.max(0, sourceReferenceCount - 1);
  
  // Si plus aucune référence, on peut nettoyer (mais on garde la source pour éviter les reconnexions)
  // La source sera nettoyée uniquement si l'élément audio change
  if (sourceReferenceCount === 0) {
    // On garde la source en mémoire pour éviter les reconnexions fréquentes
    // Elle sera nettoyée automatiquement si un nouvel élément est connecté
  }
}

export function disconnectAudioElement() {
  // Déconnecter la connexion directe
  if (directDestinationConnection) {
    try {
      directDestinationConnection.disconnect();
    } catch (e) {
      // Ignorer les erreurs
    }
    directDestinationConnection = null;
  }
  
  // Déconnecter la source si elle existe
  if (globalSource) {
    try {
      globalSource.disconnect();
    } catch (e) {
      // Ignorer les erreurs
    }
  }
  globalSource = null;
  connectedElement = null;
  sourceReferenceCount = 0;
}

export function getAudioContext(): AudioContext | null {
  return globalAudioContext;
}

