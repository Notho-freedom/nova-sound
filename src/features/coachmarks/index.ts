// Réexport propre du système de coachmarks
// Powered by Shepherd.js (React 18 compatible)
export { CoachmarkProvider, useCoachmarkContext } from './components/CoachmarkProvider';
export { CoachmarkTrigger } from './components/CoachmarkTrigger';
export { useCoachmarks, CoachmarksDisplay, STATUS } from './hooks/useCoachmarks';
export { useCoachmarkProgress } from './hooks/useCoachmarkProgress';
export { COACHMARKS } from './config/coachmarks';

export type { CoachmarkConfig } from './config/coachmarks';
export type { CoachmarkProgress } from './hooks/useCoachmarkProgress';
export type { CallBackProps } from './hooks/useCoachmarks';
