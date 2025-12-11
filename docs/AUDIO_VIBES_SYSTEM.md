# 🎵 Système de Détection des Vibrations Audio - NEXUS

## 🎯 Vue d'ensemble

Le système de détection des vibrations audio permet d'extraire l'énergie, les basses, les médiums et les aigus en temps réel pour animer l'UI de Nexus de manière immersive.

---

## 🧠 Architecture

### Pipeline Audio

```
Audio Element → AudioContext → AnalyserNode → FFT/Waveform → Data → UI Animations
```

### Composants

1. **`useAudioVibes`** - Hook React principal pour l'analyse audio
2. **`AudioVibes`** - Composant d'analyse avec visualisation optionnelle
3. **`VibrantUI`** - Composant pour appliquer des effets visuels
4. **`AudioVisualizer`** - Composant de visualisation avancée
5. **`BassPulse`** - Effet spécialisé pour les basses
6. **`AudioParticles`** - Particules animées basées sur l'audio

---

## 📦 Utilisation

### 1. Hook de base : `useAudioVibes`

```tsx
import { useAudioVibes } from '@/hooks/useAudioVibes';

function MyComponent() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const vibesData = useAudioVibes(audioRef.current, {
    fftSize: 1024,
    enableBassFilter: true,
    onAnalyze: (data) => {
      console.log('Bass:', data.bass);
      console.log('Energy:', data.energy);
    },
  });

  return <audio ref={audioRef} src="/music.mp3" />;
}
```

### 2. Effets visuels automatiques : `VibrantUI`

```tsx
import { VibrantUI } from '@/components/VibrantUI';

function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <VibrantUI
      audioElement={audioRef.current}
      enableBassPulse={true}
      enableEnergyGlow={true}
      enableShake={true}
      intensity={0.8}
    >
      <div className="player-container">
        {/* Votre UI */}
      </div>
    </VibrantUI>
  );
}
```

### 3. Visualisation audio : `AudioVisualizer`

```tsx
import { AudioVisualizer } from '@/components/AudioVisualizer';

function Visualizer() {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <AudioVisualizer
      audioElement={audioRef.current}
      type="bars" // 'bars' | 'waveform' | 'circular' | 'spectrum'
      height={200}
      color="#3b82f6"
    />
  );
}
```

### 4. Effet de pulse sur les basses : `BassPulse`

```tsx
import { BassPulse } from '@/components/VibrantUI';

function BassComponent() {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <BassPulse audioElement={audioRef.current} intensity={1}>
      <div className="bass-visualizer">
        {/* Pulse avec les basses */}
      </div>
    </BassPulse>
  );
}
```

### 5. Hooks simplifiés

```tsx
import { useBassDetection, useAudioEnergy } from '@/hooks/useAudioVibes';

function SimpleComponent() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const bass = useBassDetection(audioRef.current);
  const energy = useAudioEnergy(audioRef.current);

  return (
    <div>
      <div>Bass: {bass}</div>
      <div>Energy: {energy}</div>
    </div>
  );
}
```

---

## 🎨 Types de Données

### `AudioVibesData`

```typescript
interface AudioVibesData {
  bass: number;        // 0-255 : Énergie des basses (0-100Hz)
  mid: number;         // 0-255 : Énergie des médiums (100-2000Hz)
  treble: number;      // 0-255 : Énergie des aigus (2000Hz+)
  energy: number;      // 0-255 : Énergie globale moyenne
  waveform: number[];  // Array de valeurs pour waveform
  frequency: number[]; // Array de valeurs FFT
  peak: number;        // 0-255 : Pic maximum actuel
  rms: number;         // 0-255 : Root Mean Square (puissance moyenne)
}
```

---

## ⚙️ Options de Configuration

### `UseAudioVibesOptions`

```typescript
interface UseAudioVibesOptions {
  fftSize?: number;           // 256, 512, 1024, 2048 (défaut: 1024)
  smoothingTimeConstant?: number; // 0.0 - 1.0 (défaut: 0.8)
  bassFrequency?: number;     // Fréquence de coupure basses (défaut: 100Hz)
  midFrequency?: number;      // Fréquence de coupure médiums (défaut: 2000Hz)
  enableBassFilter?: boolean; // Activer filtre passe-bas (défaut: true)
  onAnalyze?: (data: AudioVibesData) => void; // Callback personnalisé
}
```

---

## 🎯 Cas d'Usage

### 1. Animer un dock/barre

```tsx
<VibrantUI
  audioElement={audioRef.current}
  targetSelector="#nexus-dock"
  enableBassPulse={true}
  intensity={0.6}
/>
```

### 2. Créer un visualiseur audio

```tsx
<AudioVisualizer
  audioElement={audioRef.current}
  type="spectrum"
  height={150}
/>
```

### 3. Effet de glow dynamique

```tsx
<VibrantUI
  audioElement={audioRef.current}
  enableEnergyGlow={true}
  intensity={1}
>
  <AlbumArt src={coverUrl} />
</VibrantUI>
```

### 4. Particules audio

```tsx
<AudioParticles
  audioElement={audioRef.current}
  particleCount={100}
/>
```

---

## 🔧 Intégration dans DesktopApp

Pour intégrer dans le player principal :

```tsx
// Dans DesktopApp.tsx
import { useAudioVibes } from '@/hooks/useAudioVibes';
import { VibrantUI } from '@/components/VibrantUI';

export const DesktopApp = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // ... existing code ...

  return (
    <VibrantUI
      audioElement={audioRef.current}
      enableBassPulse={true}
      enableEnergyGlow={true}
    >
      {/* Existing UI */}
    </VibrantUI>
  );
};
```

---

## 🎨 Effets Disponibles

### BassPulse
- Pulse/scale sur les basses
- Vibration verticale
- Parfait pour les subwoofers visuels

### EnergyGlow
- Brightness dynamique
- Drop-shadow animé
- Effet de "lumière" basé sur l'énergie

### Shake
- Tremblement sur les pics
- Déclenché quand `peak > 200`
- Intensité proportionnelle au pic

---

## 📊 Performance

- **FFT Size** : Plus petit = plus réactif, moins de détails
- **Smoothing** : Plus élevé = plus lisse, moins réactif
- **Animation Frame** : Utilise `requestAnimationFrame` pour 60fps

### Recommandations

- **Visualisation** : `fftSize: 2048`, `smoothingTimeConstant: 0.3`
- **Effets UI** : `fftSize: 1024`, `smoothingTimeConstant: 0.8`
- **Basses uniquement** : `fftSize: 512`, `enableBassFilter: true`

---

## 🚀 Exemples Avancés

### Mode "Sub-Bass Immersive"

```tsx
<BassPulse audioElement={audioRef.current} intensity={1.2}>
  <div className="sub-bass-container">
    <AudioVisualizer
      audioElement={audioRef.current}
      type="circular"
      height={300}
    />
  </div>
</BassPulse>
```

### Visualisation Multi-Couches

```tsx
<div className="layered-visualization">
  <AudioVisualizer type="bars" height={100} />
  <AudioVisualizer type="waveform" height={50} />
  <AudioParticles particleCount={200} />
</div>
```

---

## 🐛 Dépannage

### AudioContext non disponible

**Erreur** : `AudioContext is not defined`

**Solution** : Vérifier que le code s'exécute côté client (`"use client"`)

### Pas de données

**Problème** : `vibesData` est `null`

**Solution** :
1. Vérifier que `audioElement` n'est pas `null`
2. Vérifier que l'audio est en cours de lecture
3. Vérifier les permissions CORS si l'audio vient d'un autre domaine

### Performance

**Problème** : Lag ou saccades

**Solution** :
1. Réduire `fftSize` (512 au lieu de 2048)
2. Augmenter `smoothingTimeConstant` (0.9)
3. Limiter le nombre de visualisations simultanées

---

## 📚 Ressources

- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AnalyserNode MDN](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [FFT Explanation](https://en.wikipedia.org/wiki/Fast_Fourier_transform)

---

**Système de vibrations audio prêt !** 🎵💥

