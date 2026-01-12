import { useState, useCallback, useEffect } from 'react';

const COACHMARK_STORAGE_KEY = 'nexus-coachmarks-completed';
const COACHMARK_SKIPPED_KEY = 'nexus-coachmarks-skipped';
const COACHMARK_VERSION = '1.0.0';

export interface CoachmarkProgress {
  completed: boolean;
  version: string;
  skipped: boolean;
  currentStep: number;
}

export function useCoachmarkProgress() {
  const [progress, setProgress] = useState<CoachmarkProgress>(() => {
    if (typeof window === 'undefined') {
      return {
        completed: false,
        version: COACHMARK_VERSION,
        skipped: false,
        currentStep: 0,
      };
    }

    const completed = localStorage.getItem(COACHMARK_STORAGE_KEY) === 'true';
    const skipped = localStorage.getItem(COACHMARK_SKIPPED_KEY) === 'true';
    
    return {
      completed,
      version: COACHMARK_VERSION,
      skipped,
      currentStep: 0,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COACHMARK_STORAGE_KEY, String(progress.completed));
    localStorage.setItem(COACHMARK_SKIPPED_KEY, String(progress.skipped));
  }, [progress.completed, progress.skipped]);

  const markCompleted = useCallback(() => {
    console.log('[Coachmarks] Marking as completed');
    setProgress((prev) => ({ ...prev, completed: true, skipped: false }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(COACHMARK_STORAGE_KEY, 'true');
      localStorage.setItem(COACHMARK_SKIPPED_KEY, 'false');
    }
  }, []);

  const markSkipped = useCallback(() => {
    console.log('[Coachmarks] Marking as skipped');
    setProgress((prev) => ({ ...prev, skipped: true, completed: false }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(COACHMARK_SKIPPED_KEY, 'true');
      localStorage.setItem(COACHMARK_STORAGE_KEY, 'false');
    }
  }, []);

  const resetCoachmarks = useCallback(() => {
    console.log('[Coachmarks] Resetting progress');
    setProgress({
      completed: false,
      version: COACHMARK_VERSION,
      skipped: false,
      currentStep: 0,
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(COACHMARK_STORAGE_KEY);
      localStorage.removeItem(COACHMARK_SKIPPED_KEY);
    }
  }, []);

  const shouldShowCoachmarks = useCallback(() => {
    // Ne montrer que si l'utilisateur n'a ni complété ni ignoré le tour
    const shouldShow = !progress.completed && !progress.skipped;
    console.log('[Coachmarks] Should show?', shouldShow, { completed: progress.completed, skipped: progress.skipped });
    return shouldShow;
  }, [progress.completed, progress.skipped]);

  return {
    progress,
    markCompleted,
    markSkipped,
    resetCoachmarks,
    shouldShowCoachmarks,
  };
}
