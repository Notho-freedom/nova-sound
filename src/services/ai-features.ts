/**
 * Service de gestion des fonctionnalités IA basé sur le plan utilisateur
 * - Free : Fonctions natives navigateur uniquement
 * - Pro : Accès aux fonctions IA avancées (AssemblyAI)
 */

import { authService } from './auth';
import { stripeService } from './stripe';

export type AIFeatureLevel = 'free' | 'pro' | 'none';

export interface AIFeatureFlags {
  canUseAdvancedAI: boolean;
  canUseTranscription: boolean;
  canUseSentimentAnalysis: boolean;
  canUseSpeakerDiarization: boolean;
  canUseChapters: boolean;
  canUseToxicityDetection: boolean;
  level: AIFeatureLevel;
}

/**
 * Vérifie si l'utilisateur a accès aux fonctionnalités IA Pro
 */
export async function checkAIFeatures(): Promise<AIFeatureFlags> {
  // Vérifier d'abord le service auth local
  const localUser = authService.getCurrentUser();
  const isLocalPro = localUser?.plan === 'pro' && localUser?.subscriptionStatus === 'active';

  if (isLocalPro) {
    return {
      canUseAdvancedAI: true,
      canUseTranscription: true,
      canUseSentimentAnalysis: true,
      canUseSpeakerDiarization: true,
      canUseChapters: true,
      canUseToxicityDetection: true,
      level: 'pro',
    };
  }

  // Vérifier le statut Stripe (source de vérité)
  try {
    const subscriptionStatus = await stripeService.getSubscriptionStatus();
    const isPro = subscriptionStatus.isActive && subscriptionStatus.plan === 'pro';

    if (isPro) {
      // Mettre à jour le profil local si nécessaire
      if (localUser && !isLocalPro) {
        await authService.updateProfile({
          plan: 'pro',
          subscriptionStatus: 'active',
        });
      }

      return {
        canUseAdvancedAI: true,
        canUseTranscription: true,
        canUseSentimentAnalysis: true,
        canUseSpeakerDiarization: true,
        canUseChapters: true,
        canUseToxicityDetection: true,
        level: 'pro',
      };
    }
  } catch (error) {
    console.warn('Erreur lors de la vérification du statut Stripe:', error);
  }

  // Par défaut, mode free (fonctions natives uniquement)
  return {
    canUseAdvancedAI: false,
    canUseTranscription: false,
    canUseSentimentAnalysis: false,
    canUseSpeakerDiarization: false,
    canUseChapters: false,
    canUseToxicityDetection: false,
    level: 'free',
  };
}

/**
 * Vérifie rapidement si l'utilisateur est Pro (sans appel API)
 */
export function isProUserSync(): boolean {
  const user = authService.getCurrentUser();
  return user?.plan === 'pro' && user?.subscriptionStatus === 'active';
}

/**
 * Hook pour obtenir les fonctionnalités IA disponibles
 */
export async function getAIFeatures(): Promise<AIFeatureFlags> {
  return await checkAIFeatures();
}

