# 🧠 Système d'IA Hybride - Nexus

## Vue d'ensemble

Nexus implémente un système d'analyse audio/vidéo hybride intelligent qui combine :
- **Fonctions natives navigateur** (gratuites) pour tous les utilisateurs
- **Fonctions IA avancées** (AssemblyAI Pro) pour les utilisateurs Pro

## 🎯 Architecture

```
┌────────────────────────────┐
│        UTILISATEUR          │
│   (Nexus Web / Desktop)     │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│        NEXUS PLAYER         │
│        (Next.js)            │
├────────────────────────────┤
│ 🎵 Audio / 🎥 Video Player  │
│ ────────────────────────── │
│ Web Audio API (FREE)        │
│ - Analyse fréquence         │
│ - Visualisations            │
│ - Bass / Vibration logic   │
│ - Détection voix/silence    │
│                             │
│ AssemblyAI PRO (Pro only)   │
│ - Transcription précise     │
│ - Speaker diarization       │
│ - Sentiment analysis        │
│ - Chapters / Topics         │
│ - Toxicity / Intent         │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│      NEXUS BACKEND API      │
│        (Node.js)            │
├────────────────────────────┤
│ /api/ai/assemblyai/         │
│ - transcribe                │
│ - transcript/[id]           │
│ - cache                     │
└────────────────────────────┘
```

## 🔧 Configuration

### Variables d'environnement

Ajoutez dans votre `.env` :

```bash
# AssemblyAI API Key (requis pour les fonctionnalités Pro)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
```

### Installation

Le système est déjà intégré dans Nexus. Aucune installation supplémentaire n'est nécessaire.

## 📋 Fonctionnalités

### Mode Gratuit (Tous les utilisateurs)

- ✅ Analyse audio en temps réel (Web Audio API)
- ✅ Visualisation des fréquences
- ✅ Détection de voix/silence
- ✅ Calcul du pitch (fréquence fondamentale)
- ✅ Analyse des basses/médiums/aigus
- ✅ Métriques d'intensité (RMS, Peak)

### Mode Pro (Utilisateurs Pro uniquement)

- ✅ Transcription audio précise (AssemblyAI)
- ✅ Analyse de sentiment
- ✅ Détection de locuteurs (Speaker Diarization)
- ✅ Génération automatique de chapitres
- ✅ Détection de toxicité
- ✅ Détection d'entités
- ✅ Cache intelligent (évite les appels répétés)

## 🚀 Utilisation

### Dans un composant

```tsx
import { useAudioAI } from '@/hooks/useAudioAI';

function MyPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    analysis,
    startBrowserAnalysis,
    startAIAnalysis,
    isPro,
  } = useAudioAI({
    mediaElement: videoRef.current,
    audioUrl: 'https://example.com/audio.mp3',
    autoStart: true,
    enableAI: isPro, // Active l'IA automatiquement si Pro
  });

  return (
    <div>
      <video ref={videoRef} />
      {analysis.browserAnalysis && (
        <div>
          Intensité: {analysis.browserAnalysis.intensity * 100}%
        </div>
      )}
      {isPro && analysis.transcription && (
        <div>{analysis.transcription}</div>
      )}
    </div>
  );
}
```

### Intégration dans VideoPlayer

Le `VideoPlayer` inclut déjà l'intégration complète :

1. Cliquez sur l'icône 🧠 (Brain) dans les contrôles
2. Le panneau d'analyse s'affiche
3. Les utilisateurs gratuits voient l'analyse native
4. Les utilisateurs Pro peuvent activer l'analyse IA avancée

## 🔐 Sécurité et Coûts

### Stratégie anti-coût

1. **Cache intelligent** : Chaque audio n'est analysé qu'une fois
2. **Feature flags** : Vérification stricte du plan utilisateur
3. **Chunking** : Envoi uniquement des segments utiles
4. **Fallback automatique** : Si quota dépassé → mode navigateur only

### Vérification du plan

Le système vérifie automatiquement :
- Le plan utilisateur dans Firestore
- Le statut Stripe (source de vérité)
- Cache les résultats pour éviter les appels répétés

## 📊 Structure des données

### BrowserAudioAnalysis (Mode Gratuit)

```typescript
{
  frequencyData: Float32Array;
  waveform: Float32Array;
  rms: number;
  peak: number;
  pitch: number | null;
  hasVoice: boolean;
  isSilent: boolean;
  intensity: number;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  timestamp: number;
}
```

### AIAnalysisResult (Mode Pro)

```typescript
{
  browserAnalysis: BrowserAudioAnalysis | null;
  transcription: string | null;
  chapters: Array<{ summary, headline, start, end }> | null;
  sentiment: Array<{ text, start, end, sentiment, confidence }> | null;
  speakers: Array<{ speaker, text, start, end }> | null;
  toxicity: number | null;
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
}
```

## 🛠️ API Routes

### POST /api/ai/assemblyai/transcribe

Crée une nouvelle transcription.

**Body:**
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "languageCode": "fr",
  "speakerLabels": true,
  "sentimentAnalysis": true,
  "autoChapters": true,
  "entityDetection": true,
  "toxicityDetection": true
}
```

**Response:**
```json
{
  "id": "transcript_id",
  "text": "Transcription complète...",
  "chapters": [...],
  "sentiment": [...],
  "speakers": [...],
  "toxicity": 0.05
}
```

### GET /api/ai/assemblyai/transcript/[id]

Récupère une transcription existante.

### GET /api/ai/assemblyai/cache?audioUrl=...

Vérifie si une transcription existe dans le cache.

## 🐛 Dépannage

### L'analyse IA ne fonctionne pas

1. Vérifiez que `ASSEMBLYAI_API_KEY` est configurée
2. Vérifiez que l'utilisateur a un plan Pro actif
3. Vérifiez les logs du serveur pour les erreurs

### L'analyse native ne fonctionne pas

1. Vérifiez que le navigateur supporte Web Audio API
2. Vérifiez que l'élément média est bien chargé
3. Vérifiez la console pour les erreurs

## 📝 Notes

- Le cache des transcriptions expire après 30 jours
- Les utilisateurs gratuits ont accès à toutes les fonctionnalités natives
- Les fonctionnalités IA sont strictement réservées aux utilisateurs Pro
- Le système vérifie automatiquement le plan à chaque requête

