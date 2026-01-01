# Redis Rate Limiting & Circuit Breaker Guide 🛡️

**Version**: 2.0 (31 décembre 2025)  
**Objectif**: Gérer intelligemment les appels Redis avec rate limiting et détection de panne

---

## 🎯 Architecture du système

```
┌─────────────────────────────────────────────────────────────┐
│                    RedisCacheService                        │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Rate Limiter │ → │ Circuit      │ → │ Batch Queue  │ │
│  │ 1 req/10s    │    │ Breaker      │    │ (50 tracks)  │ │
│  │              │    │ 3 failures   │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                             │
│        ↓                    ↓                    ↓          │
│   Throttling         Auto-Detection         Debouncing     │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    /api/cache/redis/batch/tracks
                              ↓
                         Redis Server
```

---

## 🔧 Configuration

### Variables d'environnement

```env
# .env
REDIS_ENABLED=true                    # Activer Redis
NEXT_PUBLIC_REDIS_ENABLED=true        # Activer côté client
REDIS_HOST=redis-xxx.redislabs.com    # Serveur Redis
REDIS_PORT=18697
REDIS_PASSWORD=xxx
```

### Constantes du service

```ts
// src/services/redis-cache.ts
private readonly BATCH_DELAY = 10000;           // 10s debounce
private readonly BATCH_SIZE = 50;               // Max tracks per batch
private readonly MIN_FLUSH_INTERVAL = 10000;    // Min 10s between flushes
private readonly MAX_BACKOFF = 5;               // Max 50s backoff
private readonly FAILURE_THRESHOLD = 3;         // 3 failures → circuit open
private readonly CIRCUIT_RESET_TIMEOUT = 60000; // 60s cooldown
```

---

## 📊 Flux de décision

### setTrack() - Ajout d'une track

```
setTrack(track)
     ↓
[isAvailable?] ─NO→ Return (Redis disabled)
     ↓ YES
[Add to queue]
     ↓
[Cancel previous timeout]
     ↓
[Calculate next flush time]
     ↓
[timeSinceLastFlush < minInterval?]
     ↓ YES                    ↓ NO
[Delay = minInterval]   [Delay = BATCH_DELAY]
     ↓                        ↓
[Schedule timeout]     [Schedule timeout]
     ↓
[Queue full (50) AND cooldown OK?]
     ↓ YES                    ↓ NO
[Flush immediately]      [Wait for timeout]
```

---

### flushTrackBatch() - Envoi vers Redis

```
flushTrackBatch()
     ↓
[isFlushing OR queue empty?] ─YES→ Return (prevent concurrent)
     ↓ NO
[Circuit breaker open?]
     ↓ YES                         ↓ NO
[Within cooldown period?]     [Check rate limit]
     ↓ YES          ↓ NO           ↓
   Return     [Close circuit]  [Time since last < min?]
                                   ↓ YES        ↓ NO
                              [Reschedule]  [Proceed]
                                                ↓
                                         [Set isFlushing = true]
                                                ↓
                                         [Clear queue, fetch]
                                                ↓
                                    ┌──────────┴───────────┐
                                    ↓                      ↓
                            [200 OK - Success]    [307/503 - Failure]
                                    ↓                      ↓
                            [Reset counters]      [failureCount++]
                            [backoff = 1x]        [backoff++]
                                    ↓                      ↓
                            [lastFlushTime = now] [failures >= 3?]
                                                          ↓ YES
                                                   [OPEN CIRCUIT]
                                                   [Clear queue]
                                                   [Set cooldown]
```

---

## 🔍 Comportements détaillés

### 1. Rate Limiting (10 secondes minimum)

**Objectif** : Empêcher les rafales de requêtes

```ts
// Exemple timeline
T+0s:  setTrack() → queue track A
T+1s:  setTrack() → queue track B (cancel previous timeout)
T+5s:  setTrack() → queue track C (cancel previous timeout)
T+15s: [Timeout triggers] → flushTrackBatch()
       → Check: timeSinceLastFlush = 15s > 10s ✓
       → Proceed with flush
T+15s: Flush successful, lastFlushTime = T+15s
T+20s: setTrack() → queue track D
T+30s: [Timeout triggers] → flushTrackBatch()
       → Check: timeSinceLastFlush = 15s > 10s ✓
       → Proceed with flush
```

**Effet** : Maximum 6 requêtes/minute (1 req/10s)

---

### 2. Exponential Backoff

**Objectif** : Ralentir les tentatives en cas d'erreurs répétées

```ts
// Exemple avec erreurs
T+0s:   Flush → 307 (failure 1/3, backoff 1x)
        → minInterval = 10s × 1 = 10s
        → Reschedule in 10s

T+10s:  Flush → 307 (failure 2/3, backoff 2x)
        → minInterval = 10s × 2 = 20s
        → Reschedule in 20s

T+30s:  Flush → 307 (failure 3/3, backoff 3x)
        → CIRCUIT BREAKER OPEN
        → Clear queue, stop all attempts

T+31s:  setTrack() → Circuit open, skip
T+60s:  setTrack() → Circuit open, skip
T+90s:  [Circuit timeout reached]
        → Reset circuit, failureCount = 0
        → Next flush will attempt reconnection
```

**Progression du backoff** :
- 1ère erreur : 10s (1x)
- 2ème erreur : 20s (2x)
- 3ème erreur : 30s (3x) → Circuit ouvert
- 4ème erreur : 40s (4x)
- 5ème erreur : 50s (5x - MAX)

---

### 3. Circuit Breaker Pattern

**Objectif** : Détecter une panne et arrêter les tentatives inutiles

#### États du circuit

```
┌──────────────┐
│   CLOSED     │ ← Default state, Redis OK
│ (Normal ops) │
└──────┬───────┘
       │
       │ 3 failures
       ↓
┌──────────────┐
│    OPEN      │ ← Redis down, block all requests
│ (Skip calls) │
└──────┬───────┘
       │
       │ 60s timeout
       ↓
┌──────────────┐
│ HALF-OPEN    │ ← Try reconnection
│ (Test call)  │
└──────┬───────┘
       │
       ├─ Success → CLOSED
       └─ Failure → OPEN (reset 60s)
```

#### Logs typiques

**Circuit fermé (normal)** :
```
[RedisCacheService] ✓ Batch flushed 50 tracks
[RedisCacheService] ✓ Batch flushed 25 tracks
```

**Circuit s'ouvre** :
```
[RedisCacheService] ⚠️ Flush failed (307), failures: 1/3, backoff: 1x
[RedisCacheService] ⚠️ Flush failed (307), failures: 2/3, backoff: 2x
[RedisCacheService] ⚠️ Flush failed (307), failures: 3/3, backoff: 3x
[RedisCacheService] 🚫 Circuit breaker OPEN - Redis appears unavailable, pausing for 60s
```

**Circuit ouvert (skip)** :
```
[RedisCacheService] 🚫 Circuit breaker open, skipping flush (45s remaining)
[RedisCacheService] 🚫 Circuit breaker open, skipping setTracks (30s remaining)
```

**Circuit se referme** :
```
[RedisCacheService] 🔄 Circuit breaker: attempting reconnection
[RedisCacheService] ✓ Batch flushed 10 tracks
```

---

## 🧪 Scénarios de test

### Scénario A : Redis parfaitement accessible

**Setup** :
```env
REDIS_ENABLED=true
REDIS_HOST=redis-accessible.com (UP)
```

**Actions** :
1. Ajouter 10 tracks via `setTrack()`
2. Attendre 10s
3. Vérifier le flush

**Résultat attendu** :
```
T+0s:  setTrack(track1) → queue (size: 1)
T+1s:  setTrack(track2) → queue (size: 2)
...
T+5s:  setTrack(track10) → queue (size: 10)
T+15s: [Timeout] → flushTrackBatch()
       → ✓ Batch flushed 10 tracks
       → failureCount = 0, backoff = 1x
```

---

### Scénario B : Redis temporairement inaccessible

**Setup** :
```env
REDIS_ENABLED=true
REDIS_HOST=redis-unstable.com (DOWN temporarily)
```

**Actions** :
1. Ajouter tracks
2. Observer les échecs
3. Attendre le circuit breaker

**Résultat attendu** :
```
T+0s:   setTrack() → queue
T+10s:  Flush → 307 (failure 1/3, backoff 1x)
        → Re-queue tracks, reschedule +10s
T+20s:  Flush → 307 (failure 2/3, backoff 2x)
        → Re-queue tracks, reschedule +20s
T+40s:  Flush → 307 (failure 3/3, backoff 3x)
        → 🚫 CIRCUIT BREAKER OPEN
        → Clear queue (tracks lost)
T+50s:  setTrack() → 🚫 Circuit open, skipped
T+100s: [Circuit timeout] → 🔄 Attempting reconnection
T+110s: Flush → 307 → Circuit re-opens
```

**Résultat** : Pas de rafales, arrêt automatique

---

### Scénario C : Pic de charge (50+ tracks)

**Setup** :
```env
REDIS_ENABLED=true
REDIS_HOST=redis-accessible.com (UP)
```

**Actions** :
1. Ajouter 100 tracks rapidement
2. Observer les batches

**Résultat attendu** :
```
T+0s:   setTrack(1-50) → queue (size: 50, FULL)
        → Check cooldown: lastFlushTime = 0, timeSince = ∞ > 10s ✓
        → Flush immediately (batch 1)
T+0.5s: setTrack(51-100) → queue (size: 50, FULL)
        → Check cooldown: lastFlushTime = T+0s, timeSince = 0.5s < 10s ✗
        → Schedule timeout in (10s - 0.5s) = 9.5s
T+10s:  [Timeout] → flushTrackBatch()
        → ✓ Batch flushed 50 tracks (batch 2)
```

**Résultat** : 2 batches, respectant le rate limit de 10s

---

## 📈 Monitoring & Debugging

### Métriques à surveiller

1. **Taux de succès** :
   ```
   [RedisCacheService] ✓ Batch flushed X tracks
   ```
   ✅ Tous les flushes réussissent

2. **Backoff actif** :
   ```
   [RedisCacheService] ⚠️ Flush failed (307), failures: X/3, backoff: Xx
   ```
   ⚠️ Redis instable

3. **Circuit ouvert** :
   ```
   [RedisCacheService] 🚫 Circuit breaker OPEN
   ```
   🚨 Redis down, action requise

4. **Fréquence des flushes** :
   ```
   Count of "Batch flushed" per minute
   ```
   ✅ ≤ 6/min (1 req/10s)

---

### Commandes de debug

**Activer les logs détaillés** :
```ts
// Dans redis-cache.ts, remplacer console.debug par console.log
console.log(`[RedisCacheService] ...`);
```

**Vérifier l'état du circuit breaker** :
```ts
// Ajouter dans le constructor
console.log('[RedisCacheService] Initialized:', {
  isAvailable: this.isAvailable,
  circuitOpen: this.circuitOpen,
  failureCount: this.failureCount,
});
```

**Forcer un flush manuel** (dev only) :
```ts
// Dans la console browser
import { redisCache } from '@/services/redis-cache';
redisCache['flushTrackBatch']();
```

---

## 🎓 Best Practices

### ✅ DO

- **Monitorer les logs** : Circuit breaker = problème réseau
- **Ajuster le timeout** : Si Redis lent, augmenter `CIRCUIT_RESET_TIMEOUT`
- **Tester en staging** : Vérifier le comportement avant prod
- **Désactiver en dev local** : `REDIS_ENABLED=false` si pas de Redis local

### ❌ DON'T

- **Ne pas appeler directement `flushTrackBatch()`** : Utiliser `setTrack()`
- **Ne pas modifier les constantes sans tests** : Rate limiting fragile
- **Ne pas ignorer les logs circuit breaker** : Indique un vrai problème
- **Ne pas augmenter `BATCH_SIZE` au-delà de 100** : Risque de timeout

---

## 🚀 Production Checklist

- [ ] `REDIS_ENABLED=true` dans `.env`
- [ ] `REDIS_HOST` configuré correctement
- [ ] Circuit breaker logs monitorés (alertes)
- [ ] Taux de succès ≥ 95%
- [ ] Fréquence ≤ 6 req/min observée
- [ ] Pas d'erreurs `aborted` dans les logs
- [ ] Next.js stable (pas de recompilations)

---

## 📚 Références

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Rate Limiting Strategies](https://redis.io/docs/manual/patterns/rate-limiting/)
- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff)

---

**Dernière mise à jour** : 31 décembre 2025  
**Auteur** : GitHub Copilot + Notho-freedom  
**Version** : 2.0 (Rate Limiting + Circuit Breaker)
