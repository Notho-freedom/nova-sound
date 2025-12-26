/**
 * Service d'analyse audio native utilisant Web Audio API
 * Fonctionnalités gratuites disponibles pour tous les utilisateurs
 */

export interface BrowserAudioAnalysis {
  // Analyse de fréquence
  frequencyData: Float32Array | null;
  waveform: Float32Array | null;
  
  // Métriques audio
  rms: number; // Root Mean Square (intensité)
  peak: number; // Pic de volume
  pitch: number | null; // Fréquence fondamentale (Hz)
  
  // Détection
  hasVoice: boolean; // Détection de voix
  isSilent: boolean; // Détection de silence
  intensity: number; // Intensité 0-1
  
  // Analyse basique
  bassLevel: number; // Niveau de basses (0-1)
  midLevel: number; // Niveau de médiums (0-1)
  trebleLevel: number; // Niveau d'aigus (0-1)
  
  // Timestamp
  timestamp: number;
}

export interface BrowserAudioAnalyzerOptions {
  fftSize?: number; // Taille de la FFT (défaut: 2048)
  smoothingTimeConstant?: number; // Lissage (défaut: 0.8)
  minDecibels?: number; // Seuil minimum (défaut: -100)
  maxDecibels?: number; // Seuil maximum (défaut: -30)
}

export class BrowserAudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private frequencyData: Float32Array | null = null;
  private waveformData: Float32Array | null = null;
  
  private options: Required<BrowserAudioAnalyzerOptions>;
  private animationFrameId: number | null = null;
  private isAnalyzing = false;

  constructor(options: BrowserAudioAnalyzerOptions = {}) {
    this.options = {
      fftSize: options.fftSize ?? 2048,
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.8,
      minDecibels: options.minDecibels ?? -100,
      maxDecibels: options.maxDecibels ?? -30,
    };
  }

  /**
   * Initialise l'analyseur avec un élément audio/vidéo
   */
  async initialize(mediaElement: HTMLAudioElement | HTMLVideoElement): Promise<void> {
    try {
      // Nettoyer d'abord si déjà initialisé
      if (this.source || this.audioContext) {
        this.dispose();
      }

      // Créer le contexte audio
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Créer l'analyseur
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.options.fftSize;
      this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;
      this.analyser.minDecibels = this.options.minDecibels;
      this.analyser.maxDecibels = this.options.maxDecibels;

      // Vérifier si l'élément média est déjà connecté
      // Si c'est le cas, on utilise captureStream() comme fallback
      try {
        this.source = this.audioContext.createMediaElementSource(mediaElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (connectError: any) {
        // Si l'élément est déjà connecté, utiliser captureStream() comme fallback
        if (connectError.name === 'InvalidStateError' && 
            (connectError.message.includes('already connected') || 
             connectError.message.includes('HTMLMediaElement already connected'))) {
          // Utiliser captureStream() si disponible (pour vidéos)
          if ('captureStream' in mediaElement && typeof (mediaElement as any).captureStream === 'function') {
            try {
              const stream = (mediaElement as any).captureStream();
              // Vérifier que le stream a des pistes audio
              if (stream.getAudioTracks().length === 0) {
                throw new Error('ANALYSIS_UNAVAILABLE');
              }
              const streamSource = this.audioContext.createMediaStreamSource(stream);
              streamSource.connect(this.analyser);
              // Ne pas connecter à destination pour éviter la double sortie
              this.source = streamSource as any; // Type cast pour compatibilité
              // Succès avec captureStream
              return;
            } catch (streamError: any) {
              // Si captureStream échoue aussi, on retourne silencieusement
              // L'analyse ne sera simplement pas disponible pour cet élément
              throw new Error('ANALYSIS_UNAVAILABLE');
            }
          } else {
            // Si captureStream n'est pas disponible, on ne peut pas analyser
            throw new Error('ANALYSIS_UNAVAILABLE');
          }
        } else {
          throw connectError;
        }
      }

      // Initialiser les tableaux de données
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.frequencyData = new Float32Array(bufferLength);
      this.waveformData = new Float32Array(bufferLength);
    } catch (error) {
      // Ne logger que en développement pour éviter de polluer la console
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analyseur audio non disponible:', error instanceof Error ? error.message : error);
      }
      // Nettoyer en cas d'erreur
      this.dispose();
      throw error;
    }
  }

  /**
   * Démarre l'analyse en continu
   */
  startAnalysis(callback: (analysis: BrowserAudioAnalysis) => void): void {
    if (!this.analyser || !this.frequencyData || !this.waveformData) {
      // Ne pas lancer d'erreur, juste retourner silencieusement
      // L'analyseur peut ne pas être disponible pour certaines sources
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analyseur non initialisé. L\'analyse audio n\'est pas disponible pour cette source.');
      }
      return;
    }

    if (this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;

    const analyze = () => {
      if (!this.isAnalyzing || !this.analyser || !this.frequencyData || !this.waveformData) {
        return;
      }

      // Obtenir les données de fréquence
      this.analyser.getFloatFrequencyData(this.frequencyData as Float32Array<ArrayBuffer>);
      
      // Obtenir les données de forme d'onde
      this.analyser.getFloatTimeDomainData(this.waveformData as Float32Array<ArrayBuffer>);

      // Calculer les métriques
      const analysis = this.computeAnalysis();

      // Appeler le callback
      callback(analysis);

      // Continuer l'analyse
      this.animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  }

  /**
   * Arrête l'analyse
   */
  stopAnalysis(): void {
    this.isAnalyzing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Calcule les métriques d'analyse
   */
  private computeAnalysis(): BrowserAudioAnalysis {
    if (!this.frequencyData || !this.waveformData || !this.analyser) {
      throw new Error('Données non disponibles');
    }

    // Calculer RMS (Root Mean Square) pour l'intensité
    let sumSquares = 0;
    for (let i = 0; i < this.waveformData.length; i++) {
      sumSquares += this.waveformData[i] * this.waveformData[i];
    }
    const rms = Math.sqrt(sumSquares / this.waveformData.length);

    // Calculer le pic
    let peak = 0;
    for (let i = 0; i < this.waveformData.length; i++) {
      const abs = Math.abs(this.waveformData[i]);
      if (abs > peak) {
        peak = abs;
      }
    }

    // Calculer le pitch (fréquence fondamentale) - méthode basique
    const pitch = this.estimatePitch(this.waveformData);

    // Détecter la voix (fréquences vocales typiques: 85-255 Hz pour hommes, 165-255 Hz pour femmes)
    const voiceFreqMin = 85;
    const voiceFreqMax = 500;
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const binSize = sampleRate / (this.analyser.fftSize * 2);
    
    let voiceEnergy = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      const freq = i * binSize;
      if (freq >= voiceFreqMin && freq <= voiceFreqMax) {
        // Convertir dB en énergie linéaire
        const energy = Math.pow(10, this.frequencyData[i] / 20);
        voiceEnergy += energy;
      }
    }
    const hasVoice = voiceEnergy > 0.1; // Seuil ajustable

    // Détecter le silence
    const isSilent = rms < 0.01;

    // Calculer les niveaux de fréquences (basses, médiums, aigus)
    const bassLevel = this.getFrequencyBandLevel(20, 250); // Basses
    const midLevel = this.getFrequencyBandLevel(250, 4000); // Médiums
    const trebleLevel = this.getFrequencyBandLevel(4000, 20000); // Aigus

    // Intensité normalisée (0-1)
    const intensity = Math.min(1, rms * 10);

    return {
      frequencyData: new Float32Array(this.frequencyData),
      waveform: new Float32Array(this.waveformData),
      rms,
      peak,
      pitch,
      hasVoice,
      isSilent,
      intensity,
      bassLevel,
      midLevel,
      trebleLevel,
      timestamp: Date.now(),
    };
  }

  /**
   * Estime le pitch (fréquence fondamentale) en utilisant l'autocorrélation
   */
  private estimatePitch(waveform: Float32Array): number | null {
    if (!this.audioContext) return null;

    const sampleRate = this.audioContext.sampleRate;
    const minPeriod = Math.floor(sampleRate / 1000); // 1 kHz max
    const maxPeriod = Math.floor(sampleRate / 80); // 80 Hz min

    let maxCorrelation = 0;
    let bestPeriod = 0;

    // Autocorrélation simplifiée
    for (let period = minPeriod; period < maxPeriod && period < waveform.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < waveform.length - period; i++) {
        correlation += waveform[i] * waveform[i + period];
      }
      correlation /= (waveform.length - period);

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestPeriod === 0 || maxCorrelation < 0.1) {
      return null;
    }

    return sampleRate / bestPeriod;
  }

  /**
   * Obtient le niveau d'une bande de fréquences
   */
  private getFrequencyBandLevel(minFreq: number, maxFreq: number): number {
    if (!this.frequencyData || !this.audioContext || !this.analyser) {
      return 0;
    }

    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (this.analyser.fftSize * 2);
    
    let energy = 0;
    let count = 0;

    for (let i = 0; i < this.frequencyData.length; i++) {
      const freq = i * binSize;
      if (freq >= minFreq && freq <= maxFreq) {
        // Convertir dB en énergie linéaire et normaliser
        const linear = Math.pow(10, this.frequencyData[i] / 20);
        energy += linear;
        count++;
      }
    }

    if (count === 0) return 0;
    
    const avgEnergy = energy / count;
    // Normaliser entre 0 et 1
    return Math.min(1, Math.max(0, avgEnergy));
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.stopAnalysis();
    
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        // Ignorer les erreurs de déconnexion
      }
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
    this.frequencyData = null;
    this.waveformData = null;
  }
}

