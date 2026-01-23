import { ReactNode, createContext, useContext } from 'react';
import { useCoachmarks } from '../hooks/useCoachmarks';

interface CoachmarksContextValue {
  isOpen: boolean;
  start: () => void;
  reset: () => void;
  skip: () => void;
  shouldShow: boolean;
}

const CoachmarksContext = createContext<CoachmarksContextValue | undefined>(undefined);

interface CoachmarkProviderProps {
  children: ReactNode;
  autoStart?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onStart?: () => void;
}

export function CoachmarkProvider({
  children,
  autoStart = false,
  onComplete,
  onSkip,
  onStart,
}: CoachmarkProviderProps) {
  const { isOpen, start, resetCoachmarks, skip, shouldShow } = useCoachmarks({
    autoStart,
    onComplete,
    onSkip,
    onStart,
  });

  return (
    <CoachmarksContext.Provider value={{ isOpen, start, reset: resetCoachmarks, skip, shouldShow }}>
      {children}
    </CoachmarksContext.Provider>
  );
}

export function useCoachmarkContext() {
  const context = useContext(CoachmarksContext);
  if (context === undefined) {
    throw new Error('useCoachmarkContext must be used within a CoachmarkProvider');
  }
  return context;
}
