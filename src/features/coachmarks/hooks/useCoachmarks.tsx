/**
 * Coachmarks system - Powered by Shepherd.js
 * React 18 compatible replacement for react-joyride
 */
import { useCallback, useState, useRef, useEffect } from 'react';
import Shepherd from 'shepherd.js';
import type { StepOptions, Tour, Step } from 'shepherd.js';
import { COACHMARKS, CoachmarkConfig } from '../config/coachmarks';
import { useCoachmarkProgress } from './useCoachmarkProgress';
import '../styles/shepherd-theme.css';

const DEBUG_COACHMARKS = process.env.NEXT_PUBLIC_DEBUG_COACHMARKS === 'true';

export interface CallBackProps {
  status: string;
  index: number;
  type: string;
  action: string;
}

export const STATUS = {
  FINISHED: 'finished',
  SKIPPED: 'skipped',
  RUNNING: 'running',
  PAUSED: 'paused',
  READY: 'ready',
  IDLE: 'idle',
} as const;

interface UseCoachmarksOptions {
  autoStart?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

function createShepherdStep(config: CoachmarkConfig, index: number, total: number, tour: Tour): StepOptions {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isCentered = config.target === 'body';

  // Build buttons array based on step position
  const buttons: Array<{
    text: string;
    action: () => void;
    classes: string;
  }> = [];

  // Skip button (always visible except on last step)
  if (!isLast) {
    buttons.push({
      text: 'Passer',
      action: () => tour.cancel(),
      classes: 'shepherd-button-secondary',
    });
  }

  // Back button (not on first step)
  if (!isFirst) {
    buttons.push({
      text: 'Précédent',
      action: () => tour.back(),
      classes: 'shepherd-button-secondary',
    });
  }

  // Next/Finish button
  buttons.push({
    text: isLast ? 'Terminer' : (isFirst ? 'Commencer' : 'Suivant'),
    action: () => tour.next(),
    classes: 'shepherd-button-primary',
  });

  return {
    id: config.id,
    title: config.title,
    text: config.text,
    attachTo: isCentered ? undefined : {
      element: config.target,
      on: config.placement || 'bottom',
    },
    buttons,
    classes: isCentered ? 'shepherd-centered' : '',
    scrollTo: !isCentered ? { behavior: 'smooth', block: 'center' } : false,
    cancelIcon: {
      enabled: true,
      label: 'Fermer',
    },
    when: {
      show() {
        if (DEBUG_COACHMARKS) {
          console.log(`[Coachmarks] Showing step: ${config.id} (${index + 1}/${total})`);
        }
      },
    },
  };
}

export function useCoachmarks(options: UseCoachmarksOptions = {}) {
  const { autoStart = false, onStart, onComplete, onSkip } = options;
  const { progress, markCompleted, markSkipped, resetCoachmarks, shouldShowCoachmarks } =
    useCoachmarkProgress();

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const tourRef = useRef<Tour | null>(null);

  // Initialize Shepherd Tour
  useEffect(() => {
    if (tourRef.current) return;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
      },
    });

    // Add steps
    COACHMARKS.forEach((config, index) => {
      tour.addStep(createShepherdStep(config, index, COACHMARKS.length, tour));
    });

    // Event handlers
    tour.on('show', () => {
      const currentStep = tour.getCurrentStep();
      if (currentStep) {
        const stepIndex = tour.steps.indexOf(currentStep);
        setStepIndex(stepIndex);
      }
    });

    tour.on('complete', () => {
      if (DEBUG_COACHMARKS) {
        console.log('[Coachmarks] Tour completed');
      }
      markCompleted();
      setIsOpen(false);
      onComplete?.();
    });

    tour.on('cancel', () => {
      if (DEBUG_COACHMARKS) {
        console.log('[Coachmarks] Tour skipped');
      }
      markSkipped();
      setIsOpen(false);
      onSkip?.();
    });

    tourRef.current = tour;

    return () => {
      tour.complete();
      tourRef.current = null;
    };
  }, [markCompleted, markSkipped, onComplete, onSkip]);

  // Auto-start logic
  useEffect(() => {
    if (autoStart && shouldShowCoachmarks() && tourRef.current && !isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, shouldShowCoachmarks, isOpen]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      // Legacy callback for compatibility
      const { status, index } = data;
      if (typeof index === 'number') {
        setStepIndex(index);
      }
    },
    []
  );

  const start = useCallback(() => {
    if (!tourRef.current) {
      if (DEBUG_COACHMARKS) {
        console.log('[Coachmarks] Tour not initialized');
      }
      return;
    }

    if (DEBUG_COACHMARKS) {
      console.log('[Coachmarks] Starting tour');
    }

    setIsOpen(true);
    setStepIndex(0);
    onStart?.();
    tourRef.current.start();
  }, [onStart]);

  const reset = useCallback(() => {
    resetCoachmarks();
    setStepIndex(0);
    if (DEBUG_COACHMARKS) {
      console.log('[Coachmarks] Reset complete');
    }
  }, [resetCoachmarks]);

  const skip = useCallback(() => {
    if (tourRef.current?.isActive()) {
      tourRef.current.cancel();
    }
    markSkipped();
  }, [markSkipped]);

  return {
    progress,
    isOpen,
    stepIndex,
    shouldShow: shouldShowCoachmarks(),
    handleCallback: handleJoyrideCallback,
    resetCoachmarks: reset,
    start,
    skip,
    coachmarks: COACHMARKS,
  };
}

interface CoachmarksDisplayProps {
  isOpen: boolean;
  onCallback: (data: CallBackProps) => void;
  steps: CoachmarkConfig[];
  stepIndex?: number;
}

/**
 * CoachmarksDisplay - No longer needed with Shepherd.js
 * The tour is managed directly by the useCoachmarks hook.
 * Keeping this component for API compatibility.
 */
export function CoachmarksDisplay({
  isOpen,
  onCallback,
  steps,
  stepIndex = 0,
}: CoachmarksDisplayProps) {
  // Shepherd.js manages its own rendering
  return null;
}
