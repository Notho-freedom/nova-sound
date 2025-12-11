import { useEffect, useRef, useState, useCallback } from 'react';
import { getOrCreateAudioContext, getOrCreateMediaElementSource, releaseMediaElementSource } from './audio-context-manager';

export interface AudioVibesData {
  bass: number;        // 0-255 : Énergie des basses (0-100Hz)
  mid: number;         // 0-255 : Énergie des médiums (100-2000Hz)
  treble: number;      // 0-255 : Énergie des aigus (2000Hz+)
  energy: number;      // 0-255 : Énergie globale moyenne
  waveform: number[];  // Array de valeurs pour waveform
  frequency: number[]; // Array de valeurs FFT
  peak: number;        // 0-255 : Pic maximum actuel
  rms: number;         // 0-255 : Root Mean Square (puissance moyenne)
}

export interface UseAudioVibesOptions {
  fftSize?: number;           // Taille de la FFT (256, 512, 1024, 2048)
  smoothingTimeConstant?: number; // Lissage (0.0 - 1.0)
  bassFrequency?: number;     // Fréquence de coupure pour les basses (Hz)
  midFrequency?: number;       // Fréquence de coupure pour les médiums (Hz)
  enableBassFilter?: boolean; // Activer le filtre passe-bas pour les basses
  onAnalyze?: (data: AudioVibesData) => void; // Callback personnalisé
}

const DEFAULT_OPTIONS: Required<Omit<UseAudioVibesOptions, 'onAnalyze'>> = {
  fftSize: 1024,
  smoothingTimeConstant: 0.8,
  bassFrequency: 100,
  midFrequency: 2000,
  enableBassFilter: true,
};

/**
 * Hook React pour analyser l'audio en temps réel et extraire les vibrations
 * Utilise le Web Audio API pour détecter les basses, médiums, aigus et l'énergie globale
 * 
 * @param audioElement - Élément audio HTML ou source audio
 * @param options - Options de configuration de l'analyseur
 * @returns Données d'analyse audio en temps réel
 */
export function useAudioVibes(
  audioElement: HTMLAudioElement | HTMLVideoElement | null,
  options: UseAudioVibesOptions = {}
): AudioVibesData | null {
  const [vibesData, setVibesData] = useState<AudioVibesData | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array | null>(null);
  const waveformBufferRef = useRef<Uint8Array | null>(null);
  const optionsRef = useRef(options);

  // Mettre à jour les options
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
  }, [options]);

  // Initialiser l'analyseur audio
  useEffect(() => {
    if (!audioElement) {
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let bassFilter: BiquadFilterNode | null = null;

    try {
      // Utiliser le gestionnaire centralisé pour obtenir ou créer l'AudioContext et la source
      audioContext = getOrCreateAudioContext();
      audioContextRef.current = audioContext;
      
      // S'assurer que l'AudioContext est actif (résumé si suspendu)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
          console.warn('Failed to resume AudioContext:', err);
        });
      }

      // Obtenir ou créer la source depuis l'élément audio/vidéo
      source = getOrCreateMediaElementSource(audioElement);
      sourceRef.current = source;

      // Créer l'analyseur
      analyser = audioContext.createAnalyser();
      // S'assurer que fftSize est valide (doit être une puissance de 2 entre 32 et 32768)
      const validFFTSize = optionsRef.current.fftSize && optionsRef.current.fftSize >= 32 && optionsRef.current.fftSize <= 32768
        ? optionsRef.current.fftSize
        : DEFAULT_OPTIONS.fftSize;
      analyser.fftSize = validFFTSize;
      // S'assurer que smoothingTimeConstant est valide (doit être un nombre fini entre 0 et 1)
      const validSmoothing = typeof optionsRef.current.smoothingTimeConstant === 'number' 
        && isFinite(optionsRef.current.smoothingTimeConstant)
        && optionsRef.current.smoothingTimeConstant >= 0
        && optionsRef.current.smoothingTimeConstant <= 1
        ? optionsRef.current.smoothingTimeConstant
        : DEFAULT_OPTIONS.smoothingTimeConstant;
      analyser.smoothingTimeConstant = validSmoothing;
      analyserRef.current = analyser;

      // Créer les buffers
      const bufferLength = analyser.frequencyBinCount;
      bufferRef.current = new Uint8Array(bufferLength);
      waveformBufferRef.current = new Uint8Array(bufferLength);

      // Si on a une source, la connecter
      if (source) {
        // IMPORTANT: La source est déjà connectée à la destination via directDestinationConnection
        // dans audio-context-manager. On n'a qu'à connecter l'analyseur à la source pour l'analyse.
        // Le son passera toujours grâce à la connexion directe source -> destination.
        
        // Optionnel : Filtrer les basses pour une meilleure détection
        if (optionsRef.current.enableBassFilter) {
          bassFilter = audioContext.createBiquadFilter();
          bassFilter.type = 'lowshelf';
          bassFilter.frequency.value = optionsRef.current.bassFrequency;
          bassFilter.gain.value = 20; // Amplifier les basses

          // Connecter source -> filtre -> analyseur (pour l'analyse uniquement)
          // Le son passe déjà via directDestinationConnection dans audio-context-manager
          source.connect(bassFilter);
          bassFilter.connect(analyser);
          bassFilterRef.current = bassFilter;
        } else {
          // Connecter source -> analyseur (pour l'analyse uniquement)
          // Le son passe déjà via directDestinationConnection dans audio-context-manager
          source.connect(analyser);
        }
      } else {
        // Si pas de source (élément déjà connecté), on ne peut pas analyser
        // mais l'élément audio devrait quand même jouer car il est connecté ailleurs
        console.warn('Cannot create MediaElementSourceNode, audio analysis disabled but playback should still work');
      }

      // Fonction d'analyse
      const analyze = () => {
        // Si on n'a pas de source, on ne peut pas analyser
        if (!source || !analyser || !bufferRef.current || !waveformBufferRef.current) {
          return;
        }

        // Obtenir les données de fréquence (FFT)
        analyser.getByteFrequencyData(bufferRef.current);
        
        // Obtenir les données de waveform (amplitude temporelle)
        analyser.getByteTimeDomainData(waveformBufferRef.current);

        const frequencyData = bufferRef.current;
        const waveformData = waveformBufferRef.current;
        const bufferLength = frequencyData.length;

        // Calculer les bandes de fréquence
        const sampleRate = audioContext?.sampleRate || 44100;
        const nyquist = sampleRate / 2;
        const binWidth = nyquist / bufferLength;

        // Basses : 0-100Hz (environ les premiers bins)
        const bassBins = Math.floor(optionsRef.current.bassFrequency / binWidth);
        const bassEnergy = Array.from(frequencyData.slice(0, bassBins))
          .reduce((sum, val) => sum + val, 0) / bassBins;

        // Médiums : 100-2000Hz
        const midStartBin = bassBins;
        const midEndBin = Math.floor(optionsRef.current.midFrequency / binWidth);
        const midEnergy = Array.from(frequencyData.slice(midStartBin, midEndBin))
          .reduce((sum, val) => sum + val, 0) / (midEndBin - midStartBin);

        // Aigus : 2000Hz+
        const trebleEnergy = Array.from(frequencyData.slice(midEndBin))
          .reduce((sum, val) => sum + val, 0) / (bufferLength - midEndBin);

        // Énergie globale
        const energy = Array.from(frequencyData)
          .reduce((sum, val) => sum + val, 0) / bufferLength;

        // Pic maximum
        const peak = Math.max(...Array.from(frequencyData));

        // RMS (Root Mean Square) - puissance moyenne
        const rms = Math.sqrt(
          Array.from(frequencyData)
            .reduce((sum, val) => sum + val * val, 0) / bufferLength
        );

        // Créer l'objet de données
        const data: AudioVibesData = {
          bass: Math.min(255, Math.max(0, bassEnergy)),
          mid: Math.min(255, Math.max(0, midEnergy)),
          treble: Math.min(255, Math.max(0, trebleEnergy)),
          energy: Math.min(255, Math.max(0, energy)),
          waveform: Array.from(waveformData),
          frequency: Array.from(frequencyData),
          peak: Math.min(255, Math.max(0, peak)),
          rms: Math.min(255, Math.max(0, rms)),
        };

        setVibesData(data);

        // Callback personnalisé
        if (optionsRef.current.onAnalyze) {
          optionsRef.current.onAnalyze(data);
        }

        // Continuer l'analyse
        animationFrameRef.current = requestAnimationFrame(analyze);
      };

      // Démarrer l'analyse
      analyze();

    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'analyseur audio:', error);
    }

    // Nettoyage
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // IMPORTANT: Ne pas déconnecter la source partagée car elle est utilisée par d'autres hooks
      // Seulement déconnecter l'analyseur et le filtre de cette instance
      if (bassFilter) {
        try {
          bassFilter.disconnect();
        } catch (e) {
          // Ignorer les erreurs de déconnexion
        }
      }
      if (analyser) {
        try {
          analyser.disconnect();
        } catch (e) {
          // Ignorer les erreurs de déconnexion
        }
      }
      
      // Libérer la référence à la source partagée
      if (source) {
        releaseMediaElementSource();
      }
      
      // NE PAS déconnecter la source car elle est partagée via audio-context-manager
      // La source sera nettoyée uniquement quand tous les hooks sont démontés
      
      // NE PAS fermer l'AudioContext car il est partagé

      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      bassFilterRef.current = null;
    };
  }, [audioElement]);

  return vibesData;
}

/**
 * Hook simplifié pour obtenir uniquement les basses
 */
export function useBassDetection(
  audioElement: HTMLAudioElement | HTMLVideoElement | null
): number {
  const [bass, setBass] = useState(0);

  const vibesData = useAudioVibes(audioElement, {
    enableBassFilter: true,
    onAnalyze: (data) => {
      setBass(data.bass);
    },
  });

  return bass;
}

/**
 * Hook pour obtenir l'énergie globale
 */
export function useAudioEnergy(
  audioElement: HTMLAudioElement | HTMLVideoElement | null
): number {
  const [energy, setEnergy] = useState(0);

  const vibesData = useAudioVibes(audioElement, {
    onAnalyze: (data) => {
      setEnergy(data.energy);
    },
  });

  return energy;
}

