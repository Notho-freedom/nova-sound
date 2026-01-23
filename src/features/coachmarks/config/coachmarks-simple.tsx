/**
 * VERSION DE TEST: Coachmarks simplifié pour debug
 * Note: Using Shepherd.js instead of react-joyride
 */

export interface CoachmarkConfig {
  id: string;
  target: string;
  title: string | React.ReactNode;
  content: string | React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  spotlightPadding?: number;
  hideFooter?: boolean;
  disableBeacon?: boolean;
}

export const COACHMARKS: CoachmarkConfig[] = [
  // Step 1: Welcome
  {
    id: 'welcome',
    target: 'body',
    title: '🎵 Bienvenue dans Nova Sound',
    content: 'Ceci est une visite guidée. Cliquez sur "Suivant →" pour continuer.',
    placement: 'center',
  },

  // Step 2: Simple step
  {
    id: 'step2',
    target: 'body',
    title: 'Étape 2',
    content: 'Vérifiez que le bouton "Suivant →" fonctionne.',
    placement: 'center',
  },

  // Step 3: Another step
  {
    id: 'step3',
    target: 'body',
    title: 'Étape 3',
    content: 'Continuez en cliquant "Suivant →".',
    placement: 'center',
  },

  // Step 4: Finale
  {
    id: 'complete',
    target: 'body',
    title: '🎉 Terminé!',
    content: 'Vous avez complété la visite guidée. Excellent!',
    placement: 'center',
  },
];
