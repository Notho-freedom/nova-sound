/**
 * Hook pour gérer l'analyse audio avec deux modes :
 * - Mode FREE : Analyse native navigateur (Web Audio API)
 * - Mode PRO : Analyse IA avancée (AssemblyAI)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserAudioAnalyzer, type BrowserAudioAnalysis } from '@/services/browser-audio-analyzer';
import { getAIFeatures, type AIFeatureFlags } from '@/services/ai-features';
import { authService } from '@/services/auth';
import { useSubscriptionStatus } from './useSubscriptionStatus';

export interface AIAnalysisResult {
  // Mode natif (toujours disponible)
  browserAnalysis: BrowserAudioAnalysis | null;
  
  // Mode IA Pro (uniquement si Pro)
  transcription: string | null;
  chapters: Array<{
    summary: string;
    headline: string;
    start: number;
    end: number;
  }> | null;
  sentiment: Array<{
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
  }> | null;
  speakers: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }> | null;
  toxicity: number | null;
  
  // Métadonnées
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseAudioAIOptions {
  mediaElement: HTMLAudioElement | HTMLVideoElement | null;
  audioUrl?: string; // URL de l'audio pour l'analyse IA
  autoStart?: boolean;
  enableAI?: boolean; // Forcer l'activation de l'IA (si Pro)
}

export function useAudioAI(options: UseAudioAIOptions) {
  const { mediaElement, audioUrl, autoStart = false, enableAI = false } = options;

  const [analysis, setAnalysis] = useState<AIAnalysisResult>({
    browserAnalysis: null,
    transcription: null,
    chapters: null,
    sentiment: null,
    speakers: null,
    toxicity: null,
    isPro: false,
    isLoading: false,
    error: null,
  });

  const [features, setFeatures] = useState<AIFeatureFlags | null>(null);
  const analyzerRef = useRef<BrowserAudioAnalyzer | null>(null);
  const transcriptionIdRef = useRef<string | null>(null);
  
  // Surveiller le statut d'abonnement pour mettre à jour les fonctionnalités
  const { isPro: isSubscriptionPro, refreshStatus } = useSubscriptionStatus();

  // Charger les fonctionnalités disponibles et écouter les changements
  useEffect(() => {
    let mounted = true;

    async function loadFeatures() {
      try {
        const aiFeatures = await getAIFeatures();
        if (mounted) {
          setFeatures(aiFeatures);
          setAnalysis(prev => ({ ...prev, isPro: aiFeatures.level === 'pro' }));
        }
      } catch (error) {
        console.error('Erreur lors du chargement des fonctionnalités IA:', error);
        if (mounted) {
          setAnalysis(prev => ({ ...prev, error: 'Impossible de charger les fonctionnalités IA' }));
        }
      }
    }

    loadFeatures();

    // Écouter les changements d'authentification
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      if (mounted) {
        // Recharger les fonctionnalités quand l'utilisateur change
        await refreshStatus();
        await loadFeatures();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshStatus]);

  // Mettre à jour les fonctionnalités quand le statut d'abonnement change
  useEffect(() => {
    if (features) {
      const newLevel = isSubscriptionPro ? 'pro' : 'free';
      if (features.level !== newLevel) {
        setFeatures(prev => prev ? { ...prev, level: newLevel, canUseAdvancedAI: isSubscriptionPro } : null);
        setAnalysis(prev => ({ ...prev, isPro: isSubscriptionPro }));
      }
    }
  }, [isSubscriptionPro, features]);

  // Initialiser l'analyseur natif
  useEffect(() => {
    if (!mediaElement || !features) {
      // Nettoyer si l'élément média n'est plus disponible
      if (analyzerRef.current) {
        analyzerRef.current.stopAnalysis();
        analyzerRef.current.dispose();
        analyzerRef.current = null;
      }
      return;
    }

    // Nettoyer l'ancien analyseur avant d'en créer un nouveau
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
      analyzerRef.current.dispose();
      analyzerRef.current = null;
    }

    const analyzer = new BrowserAudioAnalyzer();
    analyzerRef.current = analyzer;

    analyzer.initialize(mediaElement)
      .then(() => {
        if (autoStart) {
          analyzer.startAnalysis((browserAnalysis) => {
            setAnalysis(prev => ({
              ...prev,
              browserAnalysis,
              error: null,
            }));
          });
        }
      })
      .catch((error) => {
        console.error('Erreur lors de l\'initialisation de l\'analyseur:', error);
        setAnalysis(prev => ({
          ...prev,
          error: error instanceof Error && error.message.includes('déjà connecté')
            ? 'L\'élément média est déjà utilisé par un autre analyseur'
            : 'Impossible d\'initialiser l\'analyseur audio. L\'analyse native peut ne pas être disponible pour cette source.',
        }));
        if (analyzerRef.current) {
          analyzerRef.current.dispose();
          analyzerRef.current = null;
        }
      });

    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.stopAnalysis();
        analyzerRef.current.dispose();
        analyzerRef.current = null;
      }
    };
  }, [mediaElement, features, autoStart]);

  // Démarrer l'analyse native
  const startBrowserAnalysis = useCallback(() => {
    if (analyzerRef.current && mediaElement) {
      analyzerRef.current.startAnalysis((browserAnalysis) => {
        setAnalysis(prev => ({
          ...prev,
          browserAnalysis,
          error: null,
        }));
      });
    }
  }, [mediaElement]);

  // Arrêter l'analyse native
  const stopBrowserAnalysis = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stopAnalysis();
    }
  }, []);

  // Lancer l'analyse IA (AssemblyAI) - uniquement pour Pro
  const startAIAnalysis = useCallback(async () => {
    if (!features?.canUseAdvancedAI) {
      setAnalysis(prev => ({
        ...prev,
        error: 'Fonctionnalité IA non disponible. Passez à Pro pour accéder à cette fonctionnalité.',
      }));
      return;
    }

    if (!audioUrl) {
      setAnalysis(prev => ({
        ...prev,
        error: 'URL audio manquante. L\'analyse IA nécessite une URL accessible.',
      }));
      return;
    }

    setAnalysis(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Vérifier le cache d'abord
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        throw new Error('Non authentifié. Veuillez vous connecter pour utiliser cette fonctionnalité.');
      }

      const cacheResponse = await fetch(
        `/api/ai/assemblyai/cache?audioUrl=${encodeURIComponent(audioUrl)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.cached) {
          setAnalysis(prev => ({
            ...prev,
            transcription: cacheData.transcript || null,
            chapters: cacheData.chapters || null,
            sentiment: cacheData.sentiment_analysis_results || null,
            speakers: cacheData.speakers || null,
            toxicity: cacheData.toxicity || null,
            isLoading: false,
            error: null,
          }));
          return;
        }
      }

      // Si pas de cache, créer une nouvelle transcription
      const transcribeResponse = await fetch('/api/ai/assemblyai/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          audioUrl,
          speakerLabels: true,
          sentimentAnalysis: true,
          autoChapters: true,
          entityDetection: true,
          toxicityDetection: true,
        }),
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        if (errorData.code === 'PRO_REQUIRED') {
          throw new Error('Fonctionnalité réservée aux utilisateurs Pro. Passez à Pro pour accéder à l\'analyse IA.');
        }
        const errorMessage = errorData.error || errorData.message || `Erreur HTTP ${transcribeResponse.status}`;
        throw new Error(errorMessage);
      }

      const result = await transcribeResponse.json();
      transcriptionIdRef.current = result.id;

      setAnalysis(prev => ({
        ...prev,
        transcription: result.text || null,
        chapters: result.chapters || null,
        sentiment: result.sentiment || null,
        speakers: result.speakers || null,
        toxicity: result.toxicity || null,
        isLoading: false,
        error: null,
      }));

    } catch (error) {
      console.error('Erreur lors de l\'analyse IA:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
        ? error
        : 'Erreur lors de l\'analyse IA. Veuillez réessayer.';
      
      setAnalysis(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [features, audioUrl]);

  // Démarrer l'analyse IA automatiquement si demandé
  useEffect(() => {
    if (enableAI && features?.canUseAdvancedAI && audioUrl && !analysis.isLoading && !analysis.transcription) {
      startAIAnalysis();
    }
  }, [enableAI, features, audioUrl, analysis.isLoading, analysis.transcription, startAIAnalysis]);

  return {
    analysis,
    features,
    startBrowserAnalysis,
    stopBrowserAnalysis,
    startAIAnalysis,
    isPro: features?.level === 'pro' || false,
  };
}

