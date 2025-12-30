# YouTube Cache System - Quick Reference Guide

## When to Use Each Cache API

### Track-Level Cache (for full Track objects)
Use when: **You need complete Track objects from YouTube**

```typescript
import { 
  cacheYouTubeTrack, 
  getCachedYouTubeTrack,
  getCachedYouTubeTrackByVideoId,
  getCachedYouTubeTracks,
  getYouTubeTracksCache 
} from '@/lib/youtube-track-cache';

// Cache a track (e.g., when adding to favorites)
const track = youtubeVideoToTrack(searchResult);
cacheYouTubeTrack(track);

// Retrieve a track by ID
const track = getCachedYouTubeTrack('track-id-123');

// Retrieve by YouTube video ID
const track = getCachedYouTubeTrackByVideoId('dQw4w9WgXcQ');

// Batch retrieve
const tracks = getCachedYouTubeTracks(['id-1', 'id-2', 'id-3']);

// Get entire cache
const allCached = getYouTubeTracksCache(); // Map<string, Track>
```

**Characteristics**:
- ✅ Stores complete Track objects
- ✅ 30-day auto-cleanup
- ✅ 500-item limit
- ✅ Single localStorage key: `"nexus-youtube-tracks-cache"`
- ✅ Smart lookup with variant ID handling
- ✅ SSR-safe (in-memory fallback)

---

### Unified Service Cache (for API data)
Use when: **You need to cache YouTube API responses**

```typescript
import { youtubeCache } from '@/services/youtube/cache';

// ===== VIDEOS =====
const video = youtubeCache.getVideo('dQw4w9WgXcQ');
youtubeCache.setVideo(videoObj);

// ===== SEARCHES =====
const results = youtubeCache.getSearch('taylor swift');
youtubeCache.setSearch('taylor swift', videos);

// ===== PLAYLISTS =====
const playlist = youtubeCache.getPlaylist('PLxxxxx');
youtubeCache.setPlaylist(playlistObj);
const videos = youtubeCache.getPlaylistVideos('PLxxxxx');
youtubeCache.setPlaylistVideos('PLxxxxx', videos);

// ===== SUGGESTIONS =====
const suggestions = youtubeCache.getSuggestions('dQw4w9WgXcQ');
youtubeCache.setSuggestions('dQw4w9WgXcQ', suggestions);

// ===== AUTOCOMPLETE =====
const suggestions = youtubeCache.getAutocomplete('taylor');
youtubeCache.setAutocomplete('taylor', suggestions); // memory-only

// ===== ARTIST PLAYLISTS =====
const playlists = youtubeCache.getArtistPlaylists('Taylor Swift');
youtubeCache.setArtistPlaylists('Taylor Swift', playlists);

// ===== CACHE MANAGEMENT =====
youtubeCache.clear();        // Clear everything
youtubeCache.getStats();     // { memoryItems: 50, storageItems: 200 }
```

**Characteristics**:
- ✅ Dual-layer (memory 10min + storage 7 days)
- ✅ localStorage key prefix: `"yt_cache_"`
- ✅ 200 memory items, 1000 storage items
- ✅ Automatic TTL expiration
- ✅ LRU eviction when limits reached
- ✅ Different TTLs per data type (6h for playlists, 7d for videos)

---

### Compatibility Shim (legacy)
Use when: **Existing code uses old API**

```typescript
import { youtubeCacheService } from '@/services/youtube-cache';

// Same as youtubeCache, just delegates to unified service
const search = youtubeCacheService.getSearch(query);
youtubeCacheService.setSearch(query, results);
```

---

## Cache Initialization Flow

```typescript
// 1. App startup (DesktopApp.tsx line 70)
useEffect(() => {
  const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
  const cachedTracks = getYouTubeTracksCache();  // Load from localStorage
  setYoutubeTracksCache(prev => {
    const updated = new Map(prev);
    cachedTracks.forEach((track, id) => {
      updated.set(id, [track]);
    });
    return updated;
  });
}, []);

// 2. Library loads (DesktopApp.tsx line 85)
useEffect(() => {
  const youtubeTracksInLibrary = libraryTracks.filter(
    t => t.mediaSource === 'youtube'
  );
  youtubeTracksInLibrary.forEach(track => {
    cacheYouTubeTrack(track);  // Add library tracks to cache
  });
}, [libraryTracks]);

// 3. Playlists load
ensurePlaylistTracksCached(playlists, allTracks, {
  cacheYouTubeTrack,  // Function to cache tracks
  fetchYouTubePlaylistVideos: fetchPlaylistVideos  // API call
});
```

---

## Common Patterns

### Pattern 1: Cache-Aside (Check before API)
```typescript
// In youtube/search.ts
const cached = youtubeCache.getSearch(query);
if (cached) {
  return cached;
}

// If not cached, fetch from API
const results = await fetchFromYouTubeAPI(query);

// Cache for next time
youtubeCache.setSearch(query, results);
results.forEach(v => youtubeCache.setVideo(v));

return results;
```

### Pattern 2: Ensure Track is Cached
```typescript
// Before adding to queue
const cached = getCachedYouTubeTrack(trackId);
if (!cached) {
  cacheYouTubeTrack(track);
}
```

### Pattern 3: Track Lookup Chain
```typescript
import { getTrackFromAllOrCache } from '@/lib/track-resolver';

// Try library first, fallback to cache
const track = getTrackFromAllOrCache(allTracks, trackId);
```

### Pattern 4: Clear Cache on Logout
```typescript
window.dispatchEvent(new CustomEvent('nexus-clear-cache'));
// Clears localStorage + sessionStorage in DesktopApp
```

---

## Debugging Cache Issues

### Check What's Cached
```javascript
// Browser DevTools Console
// YouTube service cache
Object.keys(localStorage).filter(k => k.startsWith('yt_cache_')).length

// YouTube track cache
const cache = JSON.parse(localStorage.getItem('nexus-youtube-tracks-cache') || '{}');
Object.keys(cache).length  // How many tracks cached
```

### Monitor Cache Growth
```typescript
const stats = youtubeCache.getStats();
console.log(`Memory: ${stats.memoryItems}, Storage: ${stats.storageItems}`);

// Should be < 200 and < 1000 respectively
```

### Force Cache Clear
```javascript
// Browser Console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Check Cache Expiration
```javascript
// Browser Console - Inspect a cached video
const cached = JSON.parse(localStorage.getItem('yt_cache_video:dQw4w9WgXcQ'));
console.log(new Date(cached.expiresAt));  // When it expires
```

---

## Cache Invalidation Strategies

### Automatic (Built-in)
- **Memory**: Expires after 10 minutes of creation
- **Storage**: Expires after TTL (6 hours - 7 days depending on type)
- **Size**: When reaching limits, oldest 20% removed

### Manual
```typescript
// Clear all
youtubeCache.clear();

// Clear single cache layer
youtubeCache.clearL1();  // Memory only

// Clear via event
window.dispatchEvent(new CustomEvent('nexus-clear-cache'));
```

### Conditional Clearing
```typescript
// Clear on logout
const handleLogout = () => {
  localStorage.clear();  // Includes YouTube caches
  sessionStorage.clear();
};

// Clear old data on version upgrade
if (appVersion !== cachedAppVersion) {
  youtubeCache.clear();
  updateStoredAppVersion();
}
```

---

## Performance Tips

1. **Use Memory Cache for Repeated Access**
   - First access loads from storage (5-10ms)
   - Subsequent accesses from memory (<1ms)
   - 10-minute window gives ample time

2. **Batch Cache Writes**
   ```typescript
   // ❌ Slow: Multiple saves
   for (const track of tracks) {
     cacheYouTubeTrack(track);  // Writes every iteration
   }
   
   // ✅ Better: Batch write
   const cache = getYouTubeTracksCache();
   tracks.forEach(t => cache.set(t.id, t));
   saveYouTubeTracksCache(cache);  // Single write
   ```

3. **Leverage TTL for Automatic Freshness**
   - Don't manually refresh recently cached data
   - Let TTL handle expiration naturally

4. **Monitor Cache Size**
   - Check stats regularly in development
   - Set alerts if approaching limits
   - Consider lowering MAX_CACHE_SIZE if device-constrained

---

## Error Handling

```typescript
// Cache writes are safe (won't throw)
try {
  cacheYouTubeTrack(track);  // Logs errors but continues
} catch (e) {
  // Won't actually throw, but good practice
}

// Cache reads are safe (return null on failure)
const track = getCachedYouTubeTrack(id) || loadFromAPI(id);

// Storage errors are caught
youtubeCache.setVideo(video);  // Logs to console if localStorage fails
```

---

## Testing Cache

### Unit Test Example
```typescript
import { cacheYouTubeTrack, getCachedYouTubeTrack } from '@/lib/youtube-track-cache';

it('should cache and retrieve YouTube tracks', () => {
  const track = { id: 'test-1', mediaSource: 'youtube', ... };
  
  cacheYouTubeTrack(track);
  const retrieved = getCachedYouTubeTrack('test-1');
  
  expect(retrieved).toEqual(track);
});
```

### Integration Test Example
```typescript
it('should restore cache on app restart', async () => {
  const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
  
  // Cache tracks
  const tracks = [...];
  tracks.forEach(t => cacheYouTubeTrack(t));
  
  // Simulate app restart
  const restored = getYouTubeTracksCache();
  expect(restored.size).toBe(tracks.length);
});
```

---

## Storage Impact

### Approximate Size Per Item
| Type | Typical Size | Example |
|------|-------------|---------|
| Video metadata | 500 bytes | `{ id, title, duration, channel... }` |
| Track object | 1-2 KB | Full Track with all metadata |
| Search result | 3-5 KB | 20 videos + metadata |
| Playlist | 2-3 KB | Metadata only |

### Total Cache Limits
- **Memory**: ~200KB max (200 items)
- **Storage**: ~2-3 MB max (1000 items)
- **Track cache**: ~500-700 KB (500 items)

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `youtube-track-cache.ts` | 161 | Track object caching |
| `youtube/cache.ts` | 331 | Unified service cache |
| `youtube-cache.ts` | 95 | Compatibility shim |
| `playlist-cache.ts` | 83 | Playlist track caching |
| `track-resolver.ts` | 17 | Track lookup fallback |
| `DesktopApp.tsx` | 2770 | Cache integration & initialization |

---

## Summary Table

| Need | Use This | Location |
|------|----------|----------|
| Cache full Track objects | `cacheYouTubeTrack()` | `youtube-track-cache.ts` |
| Get Track from cache | `getCachedYouTubeTrack()` | `youtube-track-cache.ts` |
| Cache search results | `youtubeCache.setSearch()` | `youtube/cache.ts` |
| Get search results | `youtubeCache.getSearch()` | `youtube/cache.ts` |
| Clear all caches | `youtubeCache.clear()` | `youtube/cache.ts` |
| Restore on startup | `getYouTubeTracksCache()` | `youtube-track-cache.ts` |
| Look up by fallback | `getTrackFromAllOrCache()` | `track-resolver.ts` |
| Ensure cached | `ensurePlaylistTracksCached()` | `playlist-cache.ts` |
