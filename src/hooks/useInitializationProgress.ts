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
  const startTimeRef = useState(() => Date.now())[0];

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
            // Don't block on authentication - app should work without auth
            try {
              return firebaseService.isInitialized();
            } catch {
              // If Firebase fails, still allow app to continue
              return true;
            }
          },
          weight: 15
        },
        {
          name: 'Configuration de Cloudinary...',
          check: () => {
            try {
              // Cloudinary is optional - don't block initialization
              return true; // Always pass - Cloudinary can be configured later
            } catch {
              return true; // Don't block on Cloudinary
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
      let criticalStepsComplete = 0;
      const criticalSteps = ['Initialisation du système...', 'Chargement de Firebase...', 'Chargement de la bibliothèque...'];

      for (const step of steps) {
        const isStepComplete = await Promise.resolve(step.check());
        
        if (isStepComplete) {
          completedWeight += step.weight;
          currentStatus = step.name;
          if (criticalSteps.includes(step.name)) {
            criticalStepsComplete++;
          }
        } else {
          // For non-critical steps, continue anyway after a delay
          if (!criticalSteps.includes(step.name)) {
            // Non-critical step failed - mark as complete anyway to avoid blocking
            completedWeight += step.weight;
            currentStatus = step.name;
            continue;
          }
          allComplete = false;
          // Don't break immediately - allow some time for async operations
          break;
        }
      }

      const calculatedProgress = Math.min(95, Math.round((completedWeight / totalWeight) * 100));
      
      setProgress(calculatedProgress);
      setStatus(currentStatus);
      
      // Mark as complete if critical steps are done OR if we've been waiting too long
      // This ensures the app doesn't block indefinitely, especially for unauthenticated users
      const criticalStepsDone = criticalStepsComplete >= 2; // At least 2 critical steps
      const elapsedTime = Date.now() - startTimeRef;
      const maxWaitTime = 5000; // 5 seconds max wait
      const shouldComplete = 
        (allComplete && calculatedProgress >= 90) || 
        (criticalStepsDone && calculatedProgress >= 70) ||
        (elapsedTime > maxWaitTime && calculatedProgress >= 60); // Force complete after 5s if 60%+ done
      
      if (shouldComplete) {
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
