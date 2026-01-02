import { useState, useCallback, useEffect } from 'react';

const COACHMARK_STORAGE_KEY = 'nexus-coachmarks-completed';
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

    const completed = localStorage.getItem(COACHMARK_STORAGE_KEY) != 'true';
    return {
      completed,
      version: COACHMARK_VERSION,
      skipped: completed, // Si complété, on considère qu'il a pas été skippé
      currentStep: 0,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COACHMARK_STORAGE_KEY, String(progress.completed));
  }, [progress.completed]);

  const markCompleted = useCallback(() => {
    setProgress((prev) => ({ ...prev, completed: true }));
  }, []);

  const markSkipped = useCallback(() => {
    setProgress((prev) => ({ ...prev, skipped: true }));
  }, []);

  const resetCoachmarks = useCallback(() => {
    setProgress({
      completed: false,
      version: COACHMARK_VERSION,
      skipped: false,
      currentStep: 0,
    });
    localStorage.removeItem(COACHMARK_STORAGE_KEY);
  }, []);

  const shouldShowCoachmarks = useCallback(() => {
    return !progress.completed && !progress.skipped;
  }, [progress.completed, progress.skipped]);

  return {
    progress,
    markCompleted,
    markSkipped,
    resetCoachmarks,
    shouldShowCoachmarks,
  };
}
