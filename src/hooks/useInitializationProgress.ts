import { useState, useEffect } from 'react';
import { firebaseService } from '@/services/firebase';
import { stripeService } from '@/services/stripe';
import { cloudinaryService } from '@/services/cloudinary';
import { useLibrary } from './useLibrary';
import { useCloudSync } from './useCloudSync';
import { isElectron } from '@/lib/electron-detector';

interface InitializationState {
  progress: number;
  status: string;
  isComplete: boolean;
}

/**
 * Hook pour suivre l'état réel d'initialisation des services
 */
export function useInitializationProgress(): InitializationState {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initialisation du système...');
  const [isComplete, setIsComplete] = useState(false);

  const { loading: libraryLoading } = useLibrary();
  const { 
    nexusAuthenticated, 
    stripeInitialized,
    cloudinaryConfigured 
  } = useCloudSync();

  const electronEnv = isElectron();

  useEffect(() => {
    const checkInitialization = async () => {
      const steps: Array<{ name: string; check: () => Promise<boolean> | boolean; weight: number }> = [
        {
          name: 'Initialisation du système...',
          check: () => true, // Always true, base step
          weight: 10
        },
        {
          name: 'Chargement de Firebase...',
          check: async () => {
            try {
              return firebaseService.isInitialized();
            } catch {
              return false;
            }
          },
          weight: 25
        },
        {
          name: 'Configuration de Stripe...',
          check: () => {
            try {
              return stripeInitialized || stripeService.isInitialized();
            } catch {
              return false;
            }
          },
          weight: 15
        },
        {
          name: 'Chargement de la bibliothèque...',
          check: () => {
            if (!electronEnv) return true; // Skip in web mode
            return !libraryLoading;
          },
          weight: electronEnv ? 20 : 0
        },
        {
          name: 'Synchronisation des services cloud...',
          check: () => {
            // Consider initialized if Firebase is ready (even if not authenticated)
            return firebaseService.isInitialized();
          },
          weight: 15
        },
        {
          name: 'Configuration de Cloudinary...',
          check: () => {
            try {
              return cloudinaryConfigured || cloudinaryService.isConfigured();
            } catch {
              return false;
            }
          },
          weight: 10
        },
        {
          name: 'Système prêt.',
          check: () => true, // Final step
          weight: 5
        }
      ];

      let totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
      let completedWeight = 0;
      let currentStatus = steps[0].name;
      let allComplete = true;

      for (const step of steps) {
        const isStepComplete = await Promise.resolve(step.check());
        
        if (isStepComplete) {
          completedWeight += step.weight;
          currentStatus = step.name;
        } else {
          allComplete = false;
          break; // Stop at first incomplete step
        }
      }

      const calculatedProgress = Math.min(95, Math.round((completedWeight / totalWeight) * 100));
      
      setProgress(calculatedProgress);
      setStatus(currentStatus);
      
      // Only mark as complete if all critical steps are done
      if (allComplete && calculatedProgress >= 90) {
        setIsComplete(true);
        setProgress(100);
        setStatus('Système prêt.');
      }
    };

    // Check immediately and then periodically
    checkInitialization();
    const interval = setInterval(checkInitialization, 200);
    
    return () => clearInterval(interval);
  }, [libraryLoading, stripeInitialized, cloudinaryConfigured, nexusAuthenticated, electronEnv]);

  return { progress, status, isComplete };
}
