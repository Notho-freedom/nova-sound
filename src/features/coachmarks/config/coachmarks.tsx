import type { Step } from 'react-joyride';

/**
 * Définition des coachmarks suivant le pattern UX exact
 * Chaque coachmark = 1 action clé avec focus précis
 */

export interface CoachmarkConfig extends Step {
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
  // Bienvenue
  {
    id: 'welcome',
    target: 'body',
    title: '🎵 Bienvenue dans Nova Sound',
    content: (
      <div className="space-y-2 text-sm">
        <p>Bienvenue dans votre nouveau lecteur audio/vidéo multimédia !</p>
        <p className="font-semibold text-primary">Cette visite guidée vous présentera les fonctionnalités principales en quelques étapes simples.</p>
        <p className="text-xs text-muted-foreground">Vous pouvez quitter à tout moment en appuyant sur <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Échap</kbd></p>
      </div>
    ),
    placement: 'center',
  },

  // Sidebar Navigation
  {
    id: 'sidebar',
    target: '[data-coachmark="sidebar"]',
    title: '📂 Navigation principale',
    content: (
      <div className="space-y-2 text-sm">
        <p>Utilisez la <strong>barre latérale</strong> pour naviguer entre les sections :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Accueil</strong> - Vue d'ensemble</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Recherche</strong> - Local + YouTube</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Bibliothèque</strong> - Tous vos morceaux</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Playlists</strong> - Créez vos listes</span></li>
        </ul>
        <p className="text-xs text-muted-foreground">Vous pouvez réduire/agrandir la barre avec le bouton →</p>
      </div>
    ),
    placement: 'right',
    spotlightPadding: 8,
  },

  // Recherche
  {
    id: 'search',
    target: '[data-coachmark="search-input"]',
    title: '🔍 Recherche puissante',
    content: (
      <div className="space-y-2 text-sm">
        <p>Trouvez rapidement vos morceaux :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span>Vos fichiers <strong>locaux</strong></span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span>Des vidéos <strong>YouTube</strong></span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span>Artistes, albums et playlists</span></li>
        </ul>
        <p className="text-xs text-primary/70 font-semibold">💡 Astuce: Activez YouTube pour des millions de morceaux !</p>
      </div>
    ),
    placement: 'bottom',
  },

  // Lecteur Audio
  {
    id: 'player',
    target: '[data-coachmark="player-bar"]',
    title: '🎧 Lecteur audio',
    content: (
      <div className="space-y-2 text-sm">
        <p>Contrôlez votre lecture avec :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">▶️</span> <span>Lecture / Pause</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">⏭️</span> <span>Morceau suivant/précédent</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🔀</span> <span>Mode aléatoire</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🔁</span> <span>Répétition</span></li>
        </ul>
        <p className="text-xs text-muted-foreground">Cliquez sur la pochette pour une vue immersive</p>
      </div>
    ),
    placement: 'top',
  },

  // Contrôles de lecture
  {
    id: 'controls',
    target: '[data-coachmark="player-controls"]',
    title: '🎮 Contrôles de lecture',
    content: (
      <div className="space-y-2 text-sm">
        <p>Accès rapide aux fonctionnalités essentielles :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">⏮️</span> <span>Revenir au morceau précédent</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">▶️</span> <span>Lecture / Pause (Barre d'espace)</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">⏭️</span> <span>Passer au morceau suivant</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🔀</span> <span>Lecture aléatoire</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🔁</span> <span>Répétition un ou tous</span></li>
        </ul>
      </div>
    ),
    placement: 'top',
  },

  // File d'attente
  {
    id: 'queue',
    target: '[data-coachmark="player-queue-btn"]',
    title: '📋 File d\'attente',
    content: (
      <div className="space-y-2 text-sm">
        <p>Gérez votre file de morceaux :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>À venir</strong> - Morceaux suivants</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Récents</strong> - Historique</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">→</span> <span><strong>Similaires</strong> - Recommandations IA</span></li>
        </ul>
        <p className="text-xs text-muted-foreground">Glissez-déposez pour réorganiser</p>
      </div>
    ),
    placement: 'left',
  },

  // Playlists
  {
    id: 'playlists',
    target: '[data-coachmark="sidebar-playlists"]',
    title: '🎶 Vos playlists',
    content: (
      <div className="space-y-2 text-sm">
        <p>Créez et gérez vos listes musicales :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">➕</span> <span>Créer une playlist personnalisée</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🎵</span> <span>Ajouter des morceaux par glisser-déposer</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🌐</span> <span>Importer des playlists YouTube</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">☁️</span> <span>Synchronisation automatique cloud</span></li>
        </ul>
      </div>
    ),
    placement: 'right',
  },

  // Paramètres
  {
    id: 'settings',
    target: '[data-coachmark="sidebar-settings"]',
    title: '⚙️ Personnalisation',
    content: (
      <div className="space-y-2 text-sm">
        <p>Adaptez Nova Sound à votre style :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">🎨</span> <span>10 thèmes différents</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🔊</span> <span>Égaliseur 10 bandes</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">☁️</span> <span>Stockage cloud</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🤖</span> <span>Fonctionnalités IA</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">⌨️</span> <span>Raccourcis clavier</span></li>
        </ul>
      </div>
    ),
    placement: 'right',
  },

  // Fin
  {
    id: 'complete',
    target: 'body',
    title: '🎉 C\'est parti !',
    content: (
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Vous êtes maintenant prêt à profiter de Nova Sound !</p>
        <p className="text-xs text-muted-foreground">Quelques conseils :</p>
        <ul className="list-none space-y-1 ml-0">
          <li className="flex items-start gap-2"><span className="text-primary">🔍</span> <span>Commencez par chercher vos morceaux préférés</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🎨</span> <span>Personnalisez l'apparence dans Paramètres</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">🌐</span> <span>Activez YouTube pour un catalogue illimité</span></li>
          <li className="flex items-start gap-2"><span className="text-primary">❓</span> <span>Survolez les icônes ? pour des conseils</span></li>
        </ul>
        <p className="text-xs text-primary/70 font-semibold">Vous pouvez relancer ce coachmark depuis Paramètres → À propos</p>
      </div>
    ),
    placement: 'center',
  },
];
