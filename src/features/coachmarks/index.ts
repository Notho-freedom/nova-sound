// Réexport propre du système de coachmarks
export { CoachmarkProvider, useCoachmarkContext } from './components/CoachmarkProvider';
export { CoachmarkTrigger } from './components/CoachmarkTrigger';
export { useCoachmarks, CoachmarksDisplay } from './hooks/useCoachmarks';
export { useCoachmarkProgress } from './hooks/useCoachmarkProgress';
export { COACHMARKS } from './config/coachmarks';

export type { CoachmarkConfig } from './config/coachmarks';
export type { CoachmarkProgress } from './hooks/useCoachmarkProgress';
