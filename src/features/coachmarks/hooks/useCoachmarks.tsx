import Joyride, { CallBackProps, STATUS } from 'react-joyride';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { COACHMARKS } from '../config/coachmarks';
import { useCoachmarkProgress } from './useCoachmarkProgress';
import '../styles/coachmarks-theme.css';

const DEBUG_COACHMARKS = process.env.NEXT_PUBLIC_DEBUG_COACHMARKS === 'true';

interface UseCoachmarksOptions {
  autoStart?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function useCoachmarks(options: UseCoachmarksOptions = {}) {
  const { autoStart = false, onStart, onComplete, onSkip } = options;
  const { progress, markCompleted, markSkipped, resetCoachmarks, shouldShowCoachmarks } =
    useCoachmarkProgress();
  
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const runRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, index, type, action } = data;

      // Mettre à jour l'index du step actuel
      if (typeof index === 'number') {
        setStepIndex(index);
      }

      if (status === STATUS.FINISHED) {
        if (DEBUG_COACHMARKS) {
          console.log('[Coachmarks] Finished', { index, type, action });
        }
        markCompleted();
        setIsOpen(false);
        runRef.current = false;
        onComplete?.();
      } else if (status === STATUS.SKIPPED) {
        if (DEBUG_COACHMARKS) {
          console.log('[Coachmarks] Skipped', { index, type, action });
        }
        markSkipped();
        setIsOpen(false);
        runRef.current = false;
        onSkip?.();
      }
    },
    [markCompleted, markSkipped, onComplete, onSkip]
  );

  useEffect(() => {
    // Ne démarrer qu'une seule fois, seulement si autoStart est activé et que le tour n'a jamais été montré
    if (autoStart && shouldShowCoachmarks() && !runRef.current && !hasAutoStartedRef.current) {
      if (DEBUG_COACHMARKS) {
        console.log('[Coachmarks] Auto-starting tour (first time only)');
      }
      runRef.current = true;
      hasAutoStartedRef.current = true;
      setIsOpen(true);
      setStepIndex(0);
      onStart?.();
    }
  }, [autoStart, shouldShowCoachmarks, onStart]);

  const start = useCallback(() => {
    setIsOpen(true);
    setStepIndex(0);
  }, []);

  const reset = useCallback(() => {
    resetCoachmarks();
    setIsOpen(true);
    setStepIndex(0);
  }, [resetCoachmarks]);

  const skip = useCallback(() => {
    setIsOpen(false);
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
  steps: any[];
  stepIndex?: number;
}

export function CoachmarksDisplay({
  isOpen,
  onCallback,
  steps,
  stepIndex = 0,
}: CoachmarksDisplayProps) {
  return (
    <Joyride
      steps={steps}
      run={isOpen}
      callback={onCallback}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      hideBackButton={false}
      disableOverlay={false}
      disableScrolling={false}
      scrollToFirstStep={true}
      spotlightClicks={true}
      debug={DEBUG_COACHMARKS}
      floaterProps={{
        styles: {
          floater: {
            // Position fixed pour ne pas affecter le layout
            position: 'fixed',
            zIndex: 10000,
          },
        },
      }}
      styles={{
        options: {
          arrowColor: 'hsl(var(--card))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.65)',
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          zIndex: 10000,
          width: '450px',
        },
        spotlight: {
          backgroundColor: 'transparent',
          border: '3px solid hsl(var(--primary))',
          borderRadius: '12px',
        },
        overlay: {
          position: 'fixed',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
      }}
      locale={{
        back: '← Précédent',
        close: '✕',
        last: 'Terminer ✓',
        next: 'Suivant →',
        open: 'Afficher',
        skip: 'Ignorer',
      }}
    />
  );
}
