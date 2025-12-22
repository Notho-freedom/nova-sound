# 🎨 CHARTE GRAPHIQUE NEXUS - GUIDE COMPLET

## 📋 TABLE DES MATIÈRES

1. [Identité de Marque](#identité-de-marque)
2. [Palette de Couleurs](#palette-de-couleurs)
3. [Typographie](#typographie)
4. [Composants UI](#composants-ui)
5. [Effets Visuels](#effets-visuels)
6. [Animations](#animations)
7. [Espacements & Bordures](#espacements--bordures)
8. [Thèmes Disponibles](#thèmes-disponibles)
9. [Guidelines d'Utilisation](#guidelines-dutilisation)

---

## 🎯 IDENTITÉ DE MARQUE

### Nom de l'Application
**NEXUS Audio System** (ou simplement **NEXUS**)

### Tagline
*"Futuristic Audio Player"* / *"Experience music like never before"*

### Description
NEXUS est un lecteur audio futuriste conçu pour ceux qui recherchent quelque chose d'extraordinaire et d'unique. L'application combine une esthétique cyberpunk avec une interface moderne et intuitive.

### Concept Visuel
- **Style** : Futuriste, Cyberpunk, High-Tech
- **Ambiance** : Sombre avec accents néon vibrants
- **Philosophie** : Minimalisme fonctionnel avec effets visuels immersifs
- **Inspiration** : Science-fiction, technologie de pointe, musique électronique

### Éléments de Branding
- **Icône** : Icône de musique stylisée dans un cercle avec effet néon
- **Logo** : Typographie "NEXUS" en Orbitron (police display)
- **Version** : v1.0.0
- **Couleur Principale** : Cyan néon (#00FFFF / HSL: 180 100% 50%)

---

## 🎨 PALETTE DE COULEURS

### Thème Par Défaut (Dark/Futuristic)

#### Couleurs Principales

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--background` | `230 25% 5%` | `#0A0B0F` | Fond principal |
| `--foreground` | `200 100% 95%` | `#E6F7FF` | Texte principal |
| `--card` | `230 30% 8%` | `#0F1117` | Cartes/conteneurs |
| `--card-foreground` | `200 100% 95%` | `#E6F7FF` | Texte sur cartes |
| `--popover` | `230 30% 8%` | `#0F1117` | Popovers |
| `--popover-foreground` | `200 100% 95%` | `#E6F7FF` | Texte popovers |

#### Couleurs d'Accent

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--primary` | `180 100% 50%` | `#00FFFF` | Couleur principale (Cyan néon) |
| `--primary-foreground` | `230 25% 5%` | `#0A0B0F` | Texte sur primary |
| `--secondary` | `320 100% 60%` | `#FF00CC` | Couleur secondaire (Magenta) |
| `--secondary-foreground` | `230 25% 5%` | `#0A0B0F` | Texte sur secondary |
| `--accent` | `270 80% 60%` | `#B366FF` | Accent (Violet) |
| `--accent-foreground` | `200 100% 95%` | `#E6F7FF` | Texte sur accent |

#### Couleurs Utilitaires

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--muted` | `230 20% 15%` | `#1F2128` | Zones muettes |
| `--muted-foreground` | `220 15% 55%` | `#7A7F8F` | Texte muet |
| `--destructive` | `0 84.2% 60.2%` | `#EF4444` | Actions destructives |
| `--destructive-foreground` | `210 40% 98%` | `#FAFAFA` | Texte sur destructive |
| `--border` | `230 30% 20%` | `#2A2D3A` | Bordures |
| `--input` | `230 30% 15%` | `#1F2128` | Champs de saisie |
| `--ring` | `180 100% 50%` | `#00FFFF` | Focus ring |

#### Couleurs Néon Spéciales

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--neon-cyan` | `180 100% 50%` | `#00FFFF` | Effets néon cyan |
| `--neon-magenta` | `320 100% 60%` | `#FF00CC` | Effets néon magenta |
| `--neon-purple` | `270 80% 60%` | `#B366FF` | Effets néon violet |
| `--neon-blue` | `220 100% 60%` | `#0066FF` | Effets néon bleu |

#### Glassmorphism

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--glass-bg` | `230 30% 10%` | `#13151C` | Fond glassmorphism |
| `--glass-border` | `230 40% 25%` | `#3A3F52` | Bordure glassmorphism |

#### Sidebar

| Variable CSS | Valeur HSL | Hex Approx. | Usage |
|-------------|------------|-------------|-------|
| `--sidebar-background` | `230 30% 8%` | `#0F1117` | Fond sidebar |
| `--sidebar-foreground` | `200 100% 95%` | `#E6F7FF` | Texte sidebar |
| `--sidebar-primary` | `180 100% 50%` | `#00FFFF` | Accent sidebar |
| `--sidebar-accent` | `230 20% 15%` | `#1F2128` | Accent hover sidebar |
| `--sidebar-border` | `230 30% 20%` | `#2A2D3A` | Bordure sidebar |

#### Effets de Lueur (Glow)

```css
--glow-cyan: 0 0 20px hsl(180 100% 50% / 0.5), 0 0 40px hsl(180 100% 50% / 0.3);
--glow-magenta: 0 0 20px hsl(320 100% 60% / 0.5), 0 0 40px hsl(320 100% 60% / 0.3);
--glow-purple: 0 0 20px hsl(270 80% 60% / 0.5), 0 0 40px hsl(270 80% 60% / 0.3);
```

### Rayon de Bordure
- `--radius: 0.75rem` (12px) - Rayon par défaut pour tous les éléments arrondis

---

## ✍️ TYPOGRAPHIE

### Polices

#### Police Display : Orbitron
- **Usage** : Titres, logos, éléments d'interface importants
- **Poids disponibles** : 400 (Regular), 700 (Bold)
- **Caractéristiques** : Futuriste, géométrique, haute technologie
- **Classes Tailwind** : `font-display`

**Exemple d'utilisation :**
```css
font-family: 'Orbitron', sans-serif;
font-weight: 400; /* Regular */
font-weight: 700; /* Bold */
```

#### Police Body : Rajdhani
- **Usage** : Corps de texte, paragraphes, contenu général
- **Poids disponibles** : 400 (Regular), 500 (Medium), 600 (SemiBold)
- **Caractéristiques** : Moderne, lisible, élégante
- **Classes Tailwind** : `font-body`

**Exemple d'utilisation :**
```css
font-family: 'Rajdhani', sans-serif;
font-weight: 400; /* Regular */
font-weight: 500; /* Medium */
font-weight: 600; /* SemiBold */
```

### Hiérarchie Typographique

#### Titres (Orbitron)
- **H1** : `text-4xl md:text-5xl font-bold tracking-wider` (Display)
- **H2** : `text-3xl font-bold tracking-wide` (Display)
- **H3** : `text-2xl font-semibold tracking-tight` (Display)
- **H4** : `text-xl font-semibold` (Display)
- **H5** : `text-lg font-medium` (Display)
- **H6** : `text-base font-medium` (Display)

#### Corps de Texte (Rajdhani)
- **Paragraphe** : `text-base font-body` (400)
- **Petit texte** : `text-sm font-body` (400)
- **Texte muet** : `text-sm text-muted-foreground` (400)

#### Spécial
- **Tracking large** : `tracking-wider` (0.05em) pour titres
- **Tracking très large** : `tracking-[0.3em]` pour labels spéciaux
- **Uppercase** : `uppercase` pour boutons et labels

### Effets de Texte

#### Texte Néon
```css
.neon-text-cyan {
  text-shadow: 
    0 0 10px hsl(var(--neon-cyan) / 0.8), 
    0 0 20px hsl(var(--neon-cyan) / 0.5), 
    0 0 30px hsl(var(--neon-cyan) / 0.3);
}

.neon-text-magenta {
  text-shadow: 
    0 0 10px hsl(var(--neon-magenta) / 0.8), 
    0 0 20px hsl(var(--neon-magenta) / 0.5), 
    0 0 30px hsl(var(--neon-magenta) / 0.3);
}
```

---

## 🧩 COMPOSANTS UI

### Boutons

#### Bouton Futuriste (Futuristic Button)
```css
.futuristic-button {
  /* Base */
  position: relative;
  overflow: hidden;
  padding: 0.75rem 1.5rem;
  font-family: 'Orbitron', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.875rem;
  
  /* Style */
  background: transparent;
  border: 1px solid hsl(var(--primary) / 0.5);
  color: hsl(var(--primary));
  
  /* Transitions */
  transition: all 0.3s ease-out;
}

.futuristic-button:hover {
  border-color: hsl(var(--primary));
  box-shadow: var(--glow-cyan);
  color: hsl(var(--foreground));
}

.futuristic-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: hsl(var(--primary) / 0.1);
  transform: translateY(100%);
  transition: transform 0.3s;
}

.futuristic-button:hover::before {
  transform: translateY(0);
}
```

#### Variantes de Boutons (shadcn/ui)

| Variante | Classes | Usage |
|----------|---------|-------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Action principale |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Actions destructives |
| `outline` | `border border-input bg-background hover:bg-accent` | Actions secondaires |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Actions alternatives |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Actions subtiles |
| `link` | `text-primary underline-offset-4 hover:underline` | Liens |

#### Tailles de Boutons

| Taille | Classes | Dimensions |
|--------|---------|------------|
| `sm` | `h-9 rounded-md px-3` | 36px de hauteur |
| `default` | `h-10 px-4 py-2` | 40px de hauteur |
| `lg` | `h-11 rounded-md px-8` | 44px de hauteur |
| `icon` | `h-10 w-10` | 40x40px (carré) |

### Cartes (Cards)

```css
.card {
  border-radius: var(--radius);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
```

**Structure :**
- `Card` : Conteneur principal
- `CardHeader` : En-tête (padding: 1.5rem, espacement vertical: 0.375rem)
- `CardTitle` : Titre (text-2xl, font-semibold)
- `CardDescription` : Description (text-sm, text-muted-foreground)
- `CardContent` : Contenu (padding: 1.5rem, padding-top: 0)
- `CardFooter` : Pied (padding: 1.5rem, padding-top: 0)

### Boutons de Contrôle

#### Bouton de Contrôle Standard
```css
.control-button {
  padding: 0.75rem;
  border-radius: 9999px;
  transition: all 0.3s;
  color: hsl(var(--muted-foreground));
}

.control-button:hover {
  color: hsl(var(--primary));
  box-shadow: var(--glow-cyan);
  background: hsl(var(--primary) / 0.1);
}
```

#### Bouton de Contrôle Principal
```css
.control-button-main {
  padding: 1.25rem;
  border-radius: 9999px;
  transition: all 0.3s;
  background: hsl(var(--primary) / 0.2);
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 0.5);
}

.control-button-main:hover {
  background: hsl(var(--primary) / 0.3);
  box-shadow: var(--glow-cyan);
  transform: scale(1.05);
}
```

### Éléments de Piste (Track Items)

```css
.track-item {
  position: relative;
  padding: 1rem;
  border-radius: 0.5rem;
  transition: all 0.3s;
  cursor: pointer;
}

.track-item:hover {
  background: hsl(var(--muted) / 0.5);
}

.track-item.active {
  background: hsl(var(--muted) / 0.7);
  border-left: 2px solid hsl(var(--primary));
}

.track-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: hsl(var(--primary));
  box-shadow: 0 0 10px hsl(var(--neon-cyan) / 0.8);
}
```

### Barre de Progression

```css
.progress-track {
  height: 4px;
  background: hsl(var(--muted));
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-magenta))
  );
  box-shadow: 0 0 10px hsl(var(--neon-cyan) / 0.5);
}
```

### Barres de Visualisation

```css
.visualizer-bar {
  width: 4px;
  border-radius: 9999px;
  transition: all 0.075s;
  background: linear-gradient(to top, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-magenta))
  );
}
```

---

## ✨ EFFETS VISUELS

### Glassmorphism

#### Glass Standard
```css
.glass {
  background: hsl(var(--glass-bg) / 0.8);
  backdrop-filter: blur(24px);
  border: 1px solid hsl(var(--glass-border) / 0.5);
}
```

#### Glass Fort
```css
.glass-strong {
  background: hsl(var(--glass-bg) / 0.9);
  backdrop-filter: blur(40px);
  border: 1px solid hsl(var(--glass-border) / 0.7);
}
```

### Effets de Lueur (Glow)

#### Glow Cyan
```css
.glow-cyan {
  box-shadow: 
    0 0 20px hsl(180 100% 50% / 0.5), 
    0 0 40px hsl(180 100% 50% / 0.3);
}
```

#### Glow Magenta
```css
.glow-magenta {
  box-shadow: 
    0 0 20px hsl(320 100% 60% / 0.5), 
    0 0 40px hsl(320 100% 60% / 0.3);
}
```

#### Glow Purple
```css
.glow-purple {
  box-shadow: 
    0 0 20px hsl(270 80% 60% / 0.5), 
    0 0 40px hsl(270 80% 60% / 0.3);
}
```

### Dégradés Néon

#### Dégradé Horizontal
```css
.gradient-neon {
  background: linear-gradient(135deg, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-magenta))
  );
}
```

#### Dégradé Vertical
```css
.gradient-neon-vertical {
  background: linear-gradient(180deg, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-purple))
  );
}
```

#### Bordure Dégradée
```css
.border-gradient {
  border-image: linear-gradient(135deg, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-magenta))
  ) 1;
}
```

### Formes Spéciales

#### Hexagone
```css
.hexagon-border {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}
```

---

## 🎬 ANIMATIONS

### Animations de Base

#### Gradient X (Dégradé Animé)
```css
@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-gradient-x {
  background-size: 400% 400%;
  animation: gradient-x 15s ease infinite;
}
```

#### Rotation Lente
```css
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}
```

#### Pulse Glow
```css
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.8;
    filter: brightness(1.2);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

#### Float (Flottement)
```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
```

#### Wave (Vague)
```css
@keyframes wave {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.animate-wave {
  animation: wave 0.8s ease-in-out infinite;
}
```

### Animations Avancées

#### Shimmer (Scintillement)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(90deg, 
    transparent, 
    hsl(var(--primary) / 0.1), 
    transparent
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}
```

#### Scale In (Agrandissement)
```css
@keyframes scale-in {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out forwards;
}
```

#### Slide Up (Glissement vers le haut)
```css
@keyframes slide-up {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out forwards;
}
```

#### Fade In (Fondu)
```css
@keyframes fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
```

#### Bounce Subtle (Rebond subtil)
```css
@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.animate-bounce-subtle {
  animation: bounce-subtle 0.3s ease-out;
}
```

#### Glow Pulse (Pulsation de lueur)
```css
@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 
      0 0 5px hsl(var(--primary) / 0.5), 
      0 0 10px hsl(var(--primary) / 0.3);
  }
  50% {
    box-shadow: 
      0 0 10px hsl(var(--primary) / 0.8), 
      0 0 20px hsl(var(--primary) / 0.5), 
      0 0 30px hsl(var(--primary) / 0.3);
  }
}

.animate-glow-pulse {
  animation: glow-pulse 2s ease-in-out infinite;
}
```

### Délais d'Animation (Stagger)

```css
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }
```

### Transitions au Survol

#### Hover Lift
```css
.hover-lift {
  transition: transform 0.2s;
}

.hover-lift:hover {
  transform: translateY(-4px);
}
```

#### Hover Scale
```css
.hover-scale {
  transition: transform 0.2s;
}

.hover-scale:hover {
  transform: scale(1.05);
}
```

#### Hover Glow
```css
.hover-glow {
  transition: box-shadow 0.2s;
}

.hover-glow:hover {
  box-shadow: 0 0 15px hsl(var(--primary) / 0.4);
}
```

---

## 📏 ESPACEMENTS & BORDURES

### Rayon de Bordure

- **Par défaut** : `0.75rem` (12px)
- **Large** : `var(--radius)` = `0.75rem`
- **Moyen** : `calc(var(--radius) - 2px)` = `10px`
- **Petit** : `calc(var(--radius) - 4px)` = `8px`
- **Rond complet** : `9999px` (pour les boutons circulaires)

### Espacements (Tailwind)

| Classe | Valeur | Usage |
|--------|--------|-------|
| `p-1` | 4px | Padding très petit |
| `p-2` | 8px | Padding petit |
| `p-3` | 12px | Padding moyen |
| `p-4` | 16px | Padding standard |
| `p-6` | 24px | Padding large (cartes) |
| `p-8` | 32px | Padding très large |

### Scrollbar

#### Webkit (Chrome, Edge, Safari)
```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, 
    hsl(var(--neon-cyan) / 0.6), 
    hsl(var(--neon-magenta) / 0.6)
  );
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, 
    hsl(var(--neon-cyan)), 
    hsl(var(--neon-magenta))
  );
}
```

#### Firefox
```css
* {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--neon-cyan) / 0.6) transparent;
}
```

---

## 🎭 THÈMES DISPONIBLES

NEXUS supporte plusieurs thèmes prédéfinis :

### 1. Dark (Par Défaut)
- **Classe** : `dark` ou par défaut
- **Style** : Futuriste avec cyan néon
- **Couleur principale** : Cyan (#00FFFF)

### 2. Light
- **Classe** : `light`
- **Style** : Clair avec accents colorés
- **Couleur principale** : Bleu (#0066CC)

### 3. Cyberpunk
- **Classe** : `cyberpunk`
- **Style** : Cyberpunk avec jaune néon
- **Couleur principale** : Jaune néon (#FFFF00)

### 4. Minimal
- **Classe** : `minimal`
- **Style** : Minimaliste noir et blanc
- **Couleur principale** : Blanc (#FFFFFF)

### 5. Spotify
- **Classe** : `spotify`
- **Style** : Inspiré de Spotify
- **Couleur principale** : Vert Spotify (#1DB954)
- **Fond** : Noir profond (#121212)

### 6. Apple Music
- **Classe** : `apple-music`
- **Style** : Inspiré d'Apple Music
- **Couleur principale** : Rose/Rouge (#FC3C44)
- **Fond** : Sombre avec teinte rose

### 7. YouTube Music
- **Classe** : `youtube-music`
- **Style** : Inspiré de YouTube Music
- **Couleur principale** : Rouge (#FF0000)
- **Fond** : Noir profond (#121212)

### 8. Tidal
- **Classe** : `tidal`
- **Style** : Inspiré de Tidal
- **Couleur principale** : Cyan (#00FFFF)
- **Fond** : Bleu très foncé

### 9. Deezer
- **Classe** : `deezer`
- **Style** : Inspiré de Deezer
- **Couleur principale** : Bleu ciel (#00C7F2)
- **Couleur secondaire** : Rose (#FF0090)
- **Fond** : Bleu très foncé

---

## 📐 GUIDELINES D'UTILISATION

### Principes de Design

1. **Contraste** : Toujours maintenir un contraste suffisant pour la lisibilité
2. **Cohérence** : Utiliser les mêmes espacements et rayons de bordure
3. **Hiérarchie** : Utiliser la typographie pour créer une hiérarchie visuelle claire
4. **Feedback** : Toujours fournir un feedback visuel aux interactions utilisateur
5. **Performance** : Limiter les animations complexes pour maintenir les performances

### Règles de Couleur

- **Primary** : Utiliser pour les actions principales et les éléments importants
- **Secondary** : Utiliser pour les actions secondaires et les accents
- **Accent** : Utiliser pour mettre en évidence des éléments spécifiques
- **Muted** : Utiliser pour les éléments de moindre importance
- **Destructive** : Utiliser uniquement pour les actions destructives

### Règles de Typographie

- **Titres** : Toujours utiliser Orbitron (font-display)
- **Corps de texte** : Toujours utiliser Rajdhani (font-body)
- **Tracking** : Utiliser `tracking-wider` pour les titres importants
- **Uppercase** : Utiliser pour les boutons et labels d'interface

### Règles d'Animation

- **Durée** : Les animations doivent être rapides (0.2s - 0.3s) sauf pour les animations continues
- **Easing** : Utiliser `ease-out` pour la plupart des transitions
- **Performance** : Préférer `transform` et `opacity` pour les animations fluides

### Règles de Glassmorphism

- **Utilisation** : Pour les overlays, modales, et panneaux flottants
- **Backdrop blur** : Minimum 24px pour un effet visible
- **Opacité** : Entre 0.8 et 0.9 pour le fond

### Règles d'Effets Néon

- **Utilisation modérée** : Ne pas surcharger l'interface avec des effets néon
- **Hiérarchie** : Utiliser les effets néon pour mettre en évidence les éléments importants
- **Performance** : Les effets de lueur peuvent impacter les performances, utiliser avec modération

### Accessibilité

- **Contraste** : Maintenir un ratio de contraste minimum de 4.5:1 pour le texte
- **Focus** : Toujours fournir un indicateur de focus visible
- **Taille de texte** : Maintenir une taille de texte lisible (minimum 14px)

---

## 🎯 EXEMPLES D'UTILISATION

### Bouton Principal
```html
<button class="futuristic-button">
  LIRE MAINTENANT
</button>
```

### Carte avec Glassmorphism
```html
<div class="glass rounded-lg p-6">
  <h3 class="font-display text-2xl text-primary neon-text-cyan mb-4">
    Titre
  </h3>
  <p class="font-body text-muted-foreground">
    Contenu de la carte
  </p>
</div>
```

### Barre de Progression
```html
<div class="progress-track">
  <div class="progress-fill" style="width: 45%"></div>
</div>
```

### Titre avec Effet Néon
```html
<h1 class="font-display text-5xl font-bold text-primary neon-text-cyan">
  NEXUS
</h1>
```

---

## 📚 RESSOURCES

### Polices
- **Orbitron** : [Google Fonts](https://fonts.google.com/specimen/Orbitron)
- **Rajdhani** : [Google Fonts](https://fonts.google.com/specimen/Rajdhani)

### Icônes
- **Lucide React** : Bibliothèque d'icônes utilisée dans l'application

### Framework CSS
- **Tailwind CSS** : Framework CSS utilitaire
- **shadcn/ui** : Composants UI basés sur Radix UI

---

## 📝 NOTES FINALES

Cette charte graphique est un document vivant qui peut être mis à jour au fur et à mesure de l'évolution de NEXUS. Pour toute question ou suggestion, référez-vous à l'équipe de développement.

**Version du document** : 1.0.0  
**Dernière mise à jour** : 2024  
**Application** : NEXUS Audio System v1.0.0

---

*© 2024 NEXUS Audio System - Tous droits réservés*

