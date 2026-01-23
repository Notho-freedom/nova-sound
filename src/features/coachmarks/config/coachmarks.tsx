import type { Step } from 'shepherd.js';

/**
 * Définition des coachmarks suivant le pattern UX exact
 * Chaque coachmark = 1 action clé avec focus précis
 * 
 * Migration: react-joyride → Shepherd.js (React 18 compatible)
 */

export interface CoachmarkConfig {
  id: string;
  target: string;
  title: string;
  text: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export const COACHMARKS: CoachmarkConfig[] = [
  // Bienvenue
  {
    id: 'welcome',
    target: 'body',
    title: '🎵 Bienvenue dans Nova Sound',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Bienvenue dans votre nouveau lecteur audio/vidéo multimédia !</p>
        <p class="shepherd-highlight">Cette visite guidée vous présentera les fonctionnalités principales en quelques étapes simples.</p>
        <p class="shepherd-hint">Vous pouvez quitter à tout moment en appuyant sur <kbd>Échap</kbd></p>
      </div>
    `,
    placement: 'auto',
  },

  // Sidebar Navigation
  {
    id: 'sidebar',
    target: '[data-coachmark="sidebar"]',
    title: '📂 Navigation principale',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Utilisez la <strong>barre latérale</strong> pour naviguer entre les sections :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">→</span> <strong>Accueil</strong> - Vue d'ensemble</li>
          <li><span class="shepherd-bullet">→</span> <strong>Recherche</strong> - Local + YouTube</li>
          <li><span class="shepherd-bullet">→</span> <strong>Bibliothèque</strong> - Tous vos morceaux</li>
          <li><span class="shepherd-bullet">→</span> <strong>Playlists</strong> - Créez vos listes</li>
        </ul>
        <p class="shepherd-hint">Vous pouvez réduire/agrandir la barre avec le bouton →</p>
      </div>
    `,
    placement: 'right',
  },

  // Recherche
  {
    id: 'search',
    target: '[data-coachmark="search-input"]',
    title: '🔍 Recherche puissante',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Trouvez rapidement vos morceaux :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">→</span> Vos fichiers <strong>locaux</strong></li>
          <li><span class="shepherd-bullet">→</span> Des vidéos <strong>YouTube</strong></li>
          <li><span class="shepherd-bullet">→</span> Artistes, albums et playlists</li>
        </ul>
        <p class="shepherd-tip">💡 Astuce: Activez YouTube pour des millions de morceaux !</p>
      </div>
    `,
    placement: 'bottom',
  },

  // Lecteur Audio
  {
    id: 'player',
    target: '[data-coachmark="player-bar"]',
    title: '🎧 Lecteur audio',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Contrôlez votre lecture avec :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">▶️</span> Lecture / Pause</li>
          <li><span class="shepherd-bullet">⏭️</span> Morceau suivant/précédent</li>
          <li><span class="shepherd-bullet">🔀</span> Mode aléatoire</li>
          <li><span class="shepherd-bullet">🔁</span> Répétition</li>
        </ul>
        <p class="shepherd-hint">Cliquez sur la pochette pour une vue immersive</p>
      </div>
    `,
    placement: 'top',
  },

  // Contrôles de lecture
  {
    id: 'controls',
    target: '[data-coachmark="player-controls"]',
    title: '🎮 Contrôles de lecture',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Accès rapide aux fonctionnalités essentielles :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">⏮️</span> Revenir au morceau précédent</li>
          <li><span class="shepherd-bullet">▶️</span> Lecture / Pause (Barre d'espace)</li>
          <li><span class="shepherd-bullet">⏭️</span> Passer au morceau suivant</li>
          <li><span class="shepherd-bullet">🔀</span> Lecture aléatoire</li>
          <li><span class="shepherd-bullet">🔁</span> Répétition un ou tous</li>
        </ul>
      </div>
    `,
    placement: 'top',
  },

  // File d'attente
  {
    id: 'queue',
    target: '[data-coachmark="player-queue-btn"]',
    title: '📋 File d\'attente',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Gérez votre file de morceaux :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">→</span> <strong>À venir</strong> - Morceaux suivants</li>
          <li><span class="shepherd-bullet">→</span> <strong>Récents</strong> - Historique</li>
          <li><span class="shepherd-bullet">→</span> <strong>Similaires</strong> - Recommandations IA</li>
        </ul>
        <p class="shepherd-hint">Glissez-déposez pour réorganiser</p>
      </div>
    `,
    placement: 'left',
  },

  // Playlists
  {
    id: 'playlists',
    target: '[data-coachmark="sidebar-playlists"]',
    title: '🎶 Vos playlists',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Créez et gérez vos listes musicales :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">➕</span> Créer une playlist personnalisée</li>
          <li><span class="shepherd-bullet">🎵</span> Ajouter des morceaux par glisser-déposer</li>
          <li><span class="shepherd-bullet">🌐</span> Importer des playlists YouTube</li>
          <li><span class="shepherd-bullet">☁️</span> Synchronisation automatique cloud</li>
        </ul>
      </div>
    `,
    placement: 'right',
  },

  // Paramètres
  {
    id: 'settings',
    target: '[data-coachmark="sidebar-settings"]',
    title: '⚙️ Personnalisation',
    text: `
      <div class="shepherd-content-wrapper">
        <p>Adaptez Nova Sound à votre style :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">🎨</span> 10 thèmes différents</li>
          <li><span class="shepherd-bullet">🔊</span> Égaliseur 10 bandes</li>
          <li><span class="shepherd-bullet">☁️</span> Stockage cloud</li>
          <li><span class="shepherd-bullet">🤖</span> Fonctionnalités IA</li>
          <li><span class="shepherd-bullet">⌨️</span> Raccourcis clavier</li>
        </ul>
      </div>
    `,
    placement: 'right',
  },

  // Fin
  {
    id: 'complete',
    target: 'body',
    title: '🎉 C\'est parti !',
    text: `
      <div class="shepherd-content-wrapper">
        <p class="shepherd-highlight">Vous êtes maintenant prêt à profiter de Nova Sound !</p>
        <p class="shepherd-hint">Quelques conseils :</p>
        <ul class="shepherd-list">
          <li><span class="shepherd-bullet">🔍</span> Commencez par chercher vos morceaux préférés</li>
          <li><span class="shepherd-bullet">🎨</span> Personnalisez l'apparence dans Paramètres</li>
          <li><span class="shepherd-bullet">🌐</span> Activez YouTube pour un catalogue illimité</li>
          <li><span class="shepherd-bullet">❓</span> Survolez les icônes ? pour des conseils</li>
        </ul>
        <p class="shepherd-tip">Vous pouvez relancer ce coachmark depuis Paramètres → À propos</p>
      </div>
    `,
    placement: 'auto',
  },
];
