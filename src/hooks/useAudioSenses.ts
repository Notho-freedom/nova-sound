import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioVibes, type AudioVibesData } from './useAudioVibes';

export interface AudioSensesData extends AudioVibesData {
  // Energy Bands détaillées
  energyBands: {
    bass: number;        // 20-200Hz
    lowMid: number;      // 200-500Hz
    mid: number;         // 500-2000Hz
    highMid: number;     // 2k-5kHz
    treble: number;      // 5k-20kHz
  };
  
  // Volume & RMS
  volume: number;        // 0-1 : Volume normalisé
  rms: number;           // 0-1 : RMS normalisé
  
  // Peak Detection
  peak: number;          // 0-1 : Pic maximum
  peakHistory: number[]; // Historique des pics
  
  // Envelope Following
  envelope: {
    attack: number;      // Temps d'attaque (ms)
    decay: number;       // Temps de decay (ms)
    sustain: number;     // Niveau de sustain (0-1)
    release: number;     // Temps de release (ms)
  };
  
  // Pitch Detection
  pitch: {
    frequency: number;   // Fréquence détectée (Hz)
    note: string;        // Note musicale (C, C#, D, etc.)
    octave: number;      // Octave (0-8)
    confidence: number;  // Confiance (0-1)
  };
  
  // BPM / Tempo
  tempo: {
    bpm: number;         // BPM estimé
    confidence: number;  // Confiance (0-1)
    beatPhase: number;   // Phase du beat (0-1)
  };
}

export interface UseAudioSensesOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  enablePitchDetection?: boolean;
  enableBPMDetection?: boolean;
  onAnalyze?: (data: AudioSensesData) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseAudioSensesOptions, 'onAnalyze'>> = {
  fftSize: 2048,
  smoothingTimeConstant: 0.3,
  enablePitchDetection: true,
  enableBPMDetection: true,
};

// Notes musicales
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convertit une fréquence en note musicale
 */
function frequencyToNote(frequency: number): { note: string; octave: number } {
  if (frequency <= 0) return { note: 'C', octave: 0 };
  
  // A4 = 440Hz
  const A4 = 440;
  const semitones = Math.round(12 * Math.log2(frequency / A4));
  const octave = 4 + Math.floor(semitones / 12);
  const noteIndex = ((semitones % 12) + 12) % 12;
  
  return {
    note: NOTES[noteIndex],
    octave: Math.max(0, Math.min(8, octave)),
  };
}

/**
 * Détecte le pitch dominant dans les données FFT
 */
function detectPitch(frequencyData: number[], sampleRate: number): {
  frequency: number;
  note: string;
  octave: number;
  confidence: number;
} {
  const nyquist = sampleRate / 2;
  const binWidth = nyquist / frequencyData.length;
  
  // Trouver le pic dominant
  let maxIndex = 0;
  let maxValue = 0;
  
  for (let i = 0; i < frequencyData.length; i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }
  
  const frequency = maxIndex * binWidth;
  const { note, octave } = frequencyToNote(frequency);
  
  // Confiance basée sur l'amplitude relative
  const totalEnergy = frequencyData.reduce((sum, val) => sum + val, 0);
  const confidence = totalEnergy > 0 ? Math.min(1, maxValue / (totalEnergy / frequencyData.length)) : 0;
  
  return { frequency, note, octave, confidence };
}

/**
 * Estime le BPM à partir de l'historique des pics
 * Utilise une détection adaptative basée sur les variations d'énergie
 */
function estimateBPM(peakHistory: number[], analysisFps: number = 60): {
  bpm: number;
  confidence: number;
  beatPhase: number;
} {
  if (peakHistory.length < 30) {
    return { bpm: 0, confidence: 0, beatPhase: 0 };
  }
  
  // Calculer la moyenne et l'écart-type pour un seuil adaptatif
  const mean = peakHistory.reduce((sum, val) => sum + val, 0) / peakHistory.length;
  const variance = peakHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / peakHistory.length;
  const stdDev = Math.sqrt(variance);
  
  // Seuil adaptatif : moyenne + 1.5 * écart-type (plus sensible que 0.7 fixe)
  const threshold = Math.max(0.3, Math.min(0.8, mean + 1.5 * stdDev));
  
  // Détecter les pics (montées significatives)
  const peaks: number[] = [];
  for (let i = 2; i < peakHistory.length; i++) {
    // Détecter une montée significative (pic)
    const current = peakHistory[i];
    const previous = peakHistory[i - 1];
    const beforePrevious = peakHistory[i - 2];
    
    // Pic si : montée rapide ET valeur au-dessus du seuil
    if (current > threshold && current > previous && previous > beforePrevious) {
      peaks.push(i);
    }
  }
  
  if (peaks.length < 3) {
    return { bpm: 0, confidence: 0, beatPhase: 0 };
  }
  
  // Calculer les intervalles entre les pics (en frames)
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }
  
  if (intervals.length < 2) {
    return { bpm: 0, confidence: 0, beatPhase: 0 };
  }
  
  // Trier les intervalles et prendre la médiane pour éviter les outliers
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  
  // Filtrer les intervalles proches de la médiane (dans ±30%)
  const filteredIntervals = intervals.filter(
    interval => interval >= medianInterval * 0.7 && interval <= medianInterval * 1.3
  );
  
  if (filteredIntervals.length < 2) {
    return { bpm: 0, confidence: 0, beatPhase: 0 };
  }
  
  // Calculer la moyenne des intervalles filtrés (en frames)
  const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
  
  // Convertir en BPM : chaque frame = 1/analysisFps secondes
  // BPM = 60 secondes / (intervalle en secondes)
  // intervalle en secondes = avgInterval / analysisFps
  const bpm = (60 * analysisFps) / avgInterval;
  
  // Confiance basée sur la régularité des intervalles
  const intervalVariance = filteredIntervals.reduce(
    (sum, val) => sum + Math.pow(val - avgInterval, 2), 
    0
  ) / filteredIntervals.length;
  const intervalStdDev = Math.sqrt(intervalVariance);
  const coefficientOfVariation = intervalStdDev / avgInterval;
  const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  
  // Phase du beat (0-1) : position actuelle dans le cycle
  const currentTime = peakHistory.length;
  const beatPhase = ((currentTime - (peaks[peaks.length - 1] || 0)) % avgInterval) / avgInterval;
  
  return {
    bpm: Math.max(60, Math.min(200, Math.round(bpm))),
    confidence,
    beatPhase: Math.max(0, Math.min(1, beatPhase)),
  };
}

/**
 * Calcule les bandes d'énergie détaillées
 */
function calculateEnergyBands(frequencyData: number[], sampleRate: number): {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
} {
  const nyquist = sampleRate / 2;
  const binWidth = nyquist / frequencyData.length;
  
  const bassBins = Math.floor(200 / binWidth);
  const lowMidBins = Math.floor(500 / binWidth);
  const midBins = Math.floor(2000 / binWidth);
  const highMidBins = Math.floor(5000 / binWidth);
  
  const bass = Array.from(frequencyData.slice(0, bassBins))
    .reduce((sum, val) => sum + val, 0) / bassBins;
  
  const lowMid = Array.from(frequencyData.slice(bassBins, lowMidBins))
    .reduce((sum, val) => sum + val, 0) / (lowMidBins - bassBins);
  
  const mid = Array.from(frequencyData.slice(lowMidBins, midBins))
    .reduce((sum, val) => sum + val, 0) / (midBins - lowMidBins);
  
  const highMid = Array.from(frequencyData.slice(midBins, highMidBins))
    .reduce((sum, val) => sum + val, 0) / (highMidBins - midBins);
  
  const treble = Array.from(frequencyData.slice(highMidBins))
    .reduce((sum, val) => sum + val, 0) / (frequencyData.length - highMidBins);
  
  return {
    bass: Math.min(255, Math.max(0, bass)),
    lowMid: Math.min(255, Math.max(0, lowMid)),
    mid: Math.min(255, Math.max(0, mid)),
    treble: Math.min(255, Math.max(0, treble)),
    highMid: Math.min(255, Math.max(0, highMid)),
  };
}

/**
 * Calcule l'enveloppe ADSR
 */
function calculateEnvelope(
  currentEnergy: number,
  previousEnergy: number,
  envelopeState: { attack: number; decay: number; sustain: number; release: number; state: 'attack' | 'decay' | 'sustain' | 'release' }
): { attack: number; decay: number; sustain: number; release: number } {
  const delta = currentEnergy - previousEnergy;
  const threshold = 0.1;
  
  if (delta > threshold) {
    // Attack
    envelopeState.state = 'attack';
    envelopeState.attack += 16; // ~1 frame à 60fps
  } else if (currentEnergy > 0.5 && envelopeState.state === 'attack') {
    // Decay
    envelopeState.state = 'decay';
    envelopeState.decay += 16;
  } else if (currentEnergy > 0.3 && (envelopeState.state === 'decay' || envelopeState.state === 'sustain')) {
    // Sustain
    envelopeState.state = 'sustain';
    envelopeState.sustain = currentEnergy;
  } else if (currentEnergy < 0.1 && envelopeState.state !== 'release') {
    // Release
    envelopeState.state = 'release';
    envelopeState.release += 16;
  }
  
  return {
    attack: envelopeState.attack,
    decay: envelopeState.decay,
    sustain: envelopeState.sustain,
    release: envelopeState.release,
  };
}

/**
 * Hook complet pour tous les sens audio
 */
export function useAudioSenses(
  audioElement: HTMLAudioElement | HTMLVideoElement | null,
  options: UseAudioSensesOptions = {}
): AudioSensesData | null {
  const [sensesData, setSensesData] = useState<AudioSensesData | null>(null);
  const optionsRef = useRef(options);
  const peakHistoryRef = useRef<number[]>([]);
  const previousEnergyRef = useRef<number>(0);
  const envelopeStateRef = useRef({
    attack: 0,
    decay: 0,
    sustain: 0,
    release: 0,
    state: 'release' as 'attack' | 'decay' | 'sustain' | 'release',
  });

  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
  }, [options]);

  // Utiliser useAudioVibes pour les données de base
  const vibesData = useAudioVibes(audioElement, {
    fftSize: optionsRef.current.fftSize,
    smoothingTimeConstant: optionsRef.current.smoothingTimeConstant,
    enableBassFilter: false, // Pas de filtre pour avoir toutes les fréquences
    onAnalyze: (data) => {
      if (!data.frequency || !data.waveform) return;

      // Obtenir le sample rate (par défaut 44100 Hz)
      const sampleRate = 44100;

      // Energy Bands détaillées
      const energyBands = calculateEnergyBands(data.frequency, sampleRate);

      // Volume & RMS normalisés
      const volume = data.energy / 255;
      const rms = data.rms / 255;

      // Peak Detection - Utiliser l'énergie des basses pour une meilleure détection du rythme
      const peak = data.peak / 255;
      // Pour le BPM, utiliser l'énergie des basses plutôt que le pic global
      // car les basses sont plus représentatives du rythme
      const bassEnergyNormalized = data.bass / 255;
      // Combiner pic global et énergie des basses pour une détection plus robuste
      const combinedPeak = Math.max(peak, bassEnergyNormalized * 0.8);
      peakHistoryRef.current.push(combinedPeak);
      if (peakHistoryRef.current.length > 1000) {
        peakHistoryRef.current.shift();
      }

      // Envelope Following
      const envelope = calculateEnvelope(volume, previousEnergyRef.current, envelopeStateRef.current);
      previousEnergyRef.current = volume;

      // Pitch Detection
      let pitch = { frequency: 0, note: 'C', octave: 0, confidence: 0 };
      if (optionsRef.current.enablePitchDetection) {
        pitch = detectPitch(data.frequency, sampleRate);
      }

      // BPM / Tempo
      // Utiliser la fréquence d'analyse (environ 60 fps pour requestAnimationFrame)
      let tempo = { bpm: 0, confidence: 0, beatPhase: 0 };
      if (optionsRef.current.enableBPMDetection) {
        tempo = estimateBPM(peakHistoryRef.current, 60); // ~60 fps pour requestAnimationFrame
      }

      // Créer les données complètes
      const sensesData: AudioSensesData = {
        ...data,
        energyBands,
        volume,
        rms,
        peak,
        peakHistory: [...peakHistoryRef.current.slice(-100)], // Derniers 100 échantillons
        envelope,
        pitch,
        tempo,
      };

      setSensesData(sensesData);

      if (optionsRef.current.onAnalyze) {
        optionsRef.current.onAnalyze(sensesData);
      }
    },
  });

  return sensesData;
}

