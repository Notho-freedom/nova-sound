# YouTube Cache System - Executive Summary

## Quick Overview

Nova Sound implements a **sophisticated dual-layer caching system** for YouTube content:

- **Memory Cache (L1)**: 10-minute TTL, <1ms access, up to 200 items
- **Storage Cache (L2)**: 7-day TTL, 5-10ms access, up to 1000 items  
- **Track Cache**: Full Track objects for offline availability, up to 500 items, 30-day cleanup

This ensures fast searches, minimal API calls, and persistence across app restarts.

---

## The Three Cache Components

### 1. Track Cache (`youtube-track-cache.ts`)
**Purpose**: Store complete YouTube Track objects for queue/favorites

**Key Points**:
- Preserves full Track metadata (artist, album, duration, etc.)
- Single localStorage key: `"nexus-youtube-tracks-cache"`
- Max 500 entries, auto-cleanup after 30 days
- Smart lookup handles variant ID formats

**Usage**:
```typescript
import { cacheYouTubeTrack, getCachedYouTubeTrack } from '@/lib/youtube-track-cache';

cacheYouTubeTrack(track);           // Add to cache
const track = getCachedYouTubeTrack('id');  // Retrieve
```

### 2. Service Cache (`youtube/cache.ts`)
**Purpose**: Cache YouTube API responses (searches, videos, playlists)

**Key Points**:
- Dual-layer with different TTLs per data type
- localStorage keys prefixed with `"yt_cache_"`
- Automatic expiration and LRU eviction
- Type-safe storage with CacheEntry<T>

**Usage**:
```typescript
import { youtubeCache } from '@/services/youtube/cache';

youtubeCache.getSearch('taylor swift');    // Check cache
youtubeCache.setSearch('taylor swift', results);  // Store
```

### 3. Compatibility Shim (`youtube-cache.ts`)
**Purpose**: Bridge old cache API to new unified service

**Usage**: Same as youtubeCache, routes to unified service

---

## Integration Architecture

```
User Interface (Search, Queue, Favorites)
         ↓
    Cache Checks (Memory → Storage → API)
         ↓
    ┌─────────────────────────────────────┐
    │ Track Cache      Service Cache      │
    │ (Track objects)  (API responses)    │
    └─────────────────────────────────────┘
         ↓
    localStorage (Persistent Storage)
         ↓
    DesktopApp State (React)
         ↓
    Queue / Playlist / Favorites
```

---

## Cache Initialization Sequence

1. **App Startup**: Load Track Cache from localStorage
2. **Library Load**: Add YouTube tracks from library to cache
3. **Playlist Load**: Fetch and cache YouTube playlist videos
4. **User Search**: Cache search results in Service Cache
5. **On Quit**: All caches auto-saved to localStorage

---

## Key Features

| Feature | Benefit |
|---------|---------|
| **Dual-layer** | Fast (memory) + persistent (storage) |
| **TTL-based** | Automatic freshness management |
| **Size-limited** | Prevents unbounded storage growth |
| **LRU eviction** | Keeps most-used items longest |
| **Type-specific TTL** | Different times for playlists (24h) vs videos (7d) |
| **Auto-cleanup** | Removes 30+ day old tracks automatically |
| **Error resilient** | Graceful degradation on storage failures |
| **SSR-safe** | In-memory fallback for non-browser environments |

---

## Usage Patterns

### Pattern 1: Search with Caching
```typescript
const cached = youtubeCache.getSearch(query);
if (cached) return cached;

const results = await youtubeAPI.search(query);
youtubeCache.setSearch(query, results);
return results;
```

### Pattern 2: Add to Favorites
```typescript
const track = youtubeVideoToTrack(searchResult);
cacheYouTubeTrack(track);           // Auto-save to storage
addToPlaylist(track);
```

### Pattern 3: Restore on Startup
```typescript
const cached = getYouTubeTracksCache();  // From localStorage
setYoutubeTracksCache(cached);           // To React state
ensurePlaylistTracksCached(playlists);   // Add playlist videos
```

---

## Performance Impact

| Operation | Without Cache | With Cache |
|-----------|---------------|-----------|
| Repeated search | 2000ms (API) | <1ms (memory) |
| Favorite lookup | 2000ms | <1ms |
| App restart | Full data loss | Instant restore |
| Offline access | ❌ Impossible | ✅ Possible |
| Bandwidth | ~100KB per search | 0 (if cached) |

---

## Data Consistency

The system maintains consistency through:

1. **Single Source of Truth**: `youtubeTracksCache` state in DesktopApp
2. **Bidirectional Sync**: Cache ↔ Storage ↔ State
3. **Full Track Objects**: Not just metadata, complete Track objects
4. **Automatic Updates**: Library changes trigger cache updates
5. **Fallback Resolution**: Track lookup chain: State → Cache → API

---

## Cache Statistics

Monitor cache health:

```typescript
const stats = youtubeCache.getStats();
console.log(`Memory: ${stats.memoryItems}/200, Storage: ${stats.storageItems}/1000`);
```

**Healthy Ranges**:
- Memory: 50-150 items (25-75%)
- Storage: 300-800 items (30-80%)

---

## Troubleshooting

### Cache Not Persisting
```javascript
// Check localStorage
localStorage.getItem('nexus-youtube-tracks-cache')
// Check service cache
Object.keys(localStorage).filter(k => k.startsWith('yt_cache_')).length
```

### Cache Growing Too Large
- Check stats: `youtubeCache.getStats()`
- Clear if >1000 storage items: `youtubeCache.clear()`
- Reduce MAX_CACHE_SIZE in youtube-track-cache.ts

### Cache Returning Stale Data
- Service cache auto-expires after TTL
- Track cache auto-expires after 30 days
- Manual clear: `window.dispatchEvent(new CustomEvent('nexus-clear-cache'))`

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| `youtube-track-cache.ts` | Track caching | 161 |
| `youtube/cache.ts` | Service caching | 331 |
| `youtube-cache.ts` | Compatibility | 95 |
| `playlist-cache.ts` | Playlist sync | 83 |
| `track-resolver.ts` | Lookup fallback | 17 |
| `DesktopApp.tsx` | Integration | 2770 |

---

## Related Documentation

- **[YOUTUBE_CACHE_SYSTEM.md](YOUTUBE_CACHE_SYSTEM.md)** - Complete technical reference
- **[YOUTUBE_CACHE_QUICK_REFERENCE.md](YOUTUBE_CACHE_QUICK_REFERENCE.md)** - Quick lookup guide
- **[YOUTUBE_CACHE_DIAGRAMS.md](YOUTUBE_CACHE_DIAGRAMS.md)** - Visual system flows

---

## Key Takeaways

1. **Two distinct caches**: Tracks (full objects) + Service data (API responses)
2. **Two storage layers**: Memory (fast) + localStorage (persistent)
3. **Smart expiration**: TTL-based with automatic cleanup
4. **Offline capable**: Cached tracks playable without internet
5. **Robust**: Handles storage failures, corruption, overflow gracefully
6. **Performant**: <1ms for cached items vs 500-2000ms for API calls

---

## Next Steps for Development

When working with YouTube content:

1. **Always cache Track objects** when converting from YouTube API
   ```typescript
   const track = youtubeVideoToTrack(video);
   cacheYouTubeTrack(track);
   ```

2. **Use Service Cache for repeated searches**
   ```typescript
   const cached = youtubeCache.getSearch(query);
   if (!cached) youtubeCache.setSearch(query, results);
   ```

3. **Ensure playlists are cached on load**
   ```typescript
   ensurePlaylistTracksCached(playlists, allTracks);
   ```

4. **Monitor cache health periodically**
   ```typescript
   const stats = youtubeCache.getStats();
   if (stats.storageItems > 900) youtubeCache.clear();
   ```

5. **Test cache persistence**
   ```typescript
   // Verify cache restored on app restart
   const restored = getYouTubeTracksCache();
   expect(restored.size).toBeGreaterThan(0);
   ```

---

This cache system is the backbone of Nova Sound's offline capability and performance optimization for YouTube content.
