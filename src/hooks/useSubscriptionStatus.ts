/**
 * Hook pour surveiller le statut d'abonnement utilisateur
 * Utile pour mettre à jour l'UI en temps réel quand le statut change
 */

import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/auth';
import { stripeService } from '@/services/stripe';

export interface SubscriptionStatus {
  isActive: boolean;
  plan: 'free' | 'pro';
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    plan: 'free',
    status: 'none',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const subscriptionStatus = await stripeService.getSubscriptionStatus();
      
      setStatus({
        isActive: subscriptionStatus.isActive,
        plan: subscriptionStatus.plan as 'free' | 'pro',
        status: subscriptionStatus.status,
        currentPeriodEnd: subscriptionStatus.currentPeriodEnd 
          ? new Date(subscriptionStatus.currentPeriodEnd) 
          : null,
        cancelAtPeriodEnd: subscriptionStatus.cancelAtPeriodEnd,
      });

      // Mettre à jour le profil local si nécessaire
      const localUser = authService.getCurrentUser();
      if (localUser) {
        const localIsPro = localUser.plan === 'pro' && localUser.subscriptionStatus === 'active';
        const remoteIsPro = subscriptionStatus.isActive && subscriptionStatus.plan === 'pro';
        
        if (localIsPro !== remoteIsPro) {
          await authService.updateProfile({
            plan: subscriptionStatus.plan as 'free' | 'pro',
            subscriptionStatus: subscriptionStatus.status as any,
          });
        }
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du statut d\'abonnement:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Charger le statut initial
    refreshStatus();

    // Écouter les changements d'authentification
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (user) {
        refreshStatus();
      } else {
        setStatus({
          isActive: false,
          plan: 'free',
          status: 'none',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        setIsLoading(false);
      }
    });

    // Rafraîchir périodiquement (toutes les 5 minutes)
    const interval = setInterval(() => {
      refreshStatus();
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    refreshStatus,
    isPro: status.isActive && status.plan === 'pro',
  };
}

