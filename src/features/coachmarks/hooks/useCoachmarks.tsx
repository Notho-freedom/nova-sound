/**
 * Coachmarks system - Temporarily disabled due to react-joyride incompatibility
 * with React 18 (unmountComponentAtNode removed).
 * TODO: Upgrade react-joyride to v3.x when available or use alternative library.
 */
import { ReactNode, useCallback, useState } from 'react';
import { COACHMARKS } from '../config/coachmarks';
import { useCoachmarkProgress } from './useCoachmarkProgress';
import '../styles/coachmarks-theme.css';

// Mock CallBackProps and STATUS for type compatibility
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

const DEBUG_COACHMARKS = process.env.NEXT_PUBLIC_DEBUG_COACHMARKS === 'true';

interface UseCoachmarksOptions {
  autoStart?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function useCoachmarks(options: UseCoachmarksOptions = {}) {
  const { onComplete, onSkip } = options;
  const { progress, markCompleted, markSkipped, resetCoachmarks, shouldShowCoachmarks } =
    useCoachmarkProgress();
  
  // Coachmarks disabled - always return closed state
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, index } = data;

      if (typeof index === 'number') {
        setStepIndex(index);
      }

      if (status === STATUS.FINISHED) {
        if (DEBUG_COACHMARKS) {
          console.log('[Coachmarks] Finished (mock)');
        }
        markCompleted();
        setIsOpen(false);
        onComplete?.();
      } else if (status === STATUS.SKIPPED) {
        if (DEBUG_COACHMARKS) {
          console.log('[Coachmarks] Skipped (mock)');
        }
        markSkipped();
        setIsOpen(false);
        onSkip?.();
      }
    },
    [markCompleted, markSkipped, onComplete, onSkip]
  );

  const start = useCallback(() => {
    // Coachmarks temporarily disabled
    if (DEBUG_COACHMARKS) {
      console.log('[Coachmarks] Start called but system is disabled (react-joyride incompatibility)');
    }
  }, []);

  const reset = useCallback(() => {
    resetCoachmarks();
    if (DEBUG_COACHMARKS) {
      console.log('[Coachmarks] Reset called but system is disabled');
    }
  }, [resetCoachmarks]);

  const skip = useCallback(() => {
    markSkipped();
  }, [markSkipped]);

  return {
    progress,
    isOpen: false, // Always disabled
    stepIndex,
    shouldShow: false, // Disabled until react-joyride is fixed
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
  steps: any[];
  stepIndex?: number;
}

/**
 * CoachmarksDisplay - Temporarily renders nothing
 * react-joyride@2.x uses unmountComponentAtNode which was removed in React 18.
 * This stub prevents build errors while maintaining API compatibility.
 */
export function CoachmarksDisplay({
  isOpen,
  onCallback,
  steps,
  stepIndex = 0,
}: CoachmarksDisplayProps) {
  // Disabled - return null instead of Joyride component
  if (DEBUG_COACHMARKS && isOpen) {
    console.log('[Coachmarks] Display disabled - react-joyride incompatibility with React 18');
  }
  return null;
}
