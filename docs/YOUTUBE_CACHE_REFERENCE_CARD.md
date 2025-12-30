# YouTube Cache System - Visual Reference Card

## Cache Layers at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│ MEMORY CACHE (L1)                                            │
│ Speed: <1ms  │  TTL: 10 min  │  Max: 200 items  │ Size: 200KB
└──────────────────────────────────────────────────────────────┘
                            ↕ (Promote/Demote)
┌──────────────────────────────────────────────────────────────┐
│ STORAGE CACHE (L2)                                           │
│ Speed: 5-10ms │ TTL: 6h-7d   │ Max: 1000 items  │ Size: 2-3MB
└──────────────────────────────────────────────────────────────┘
                            ↕ (Miss → API)
┌──────────────────────────────────────────────────────────────┐
│ YOUTUBE API                                                  │
│ Speed: 500-2000ms │ Rate Limited │ Fresh Data │ Quota Cost
└──────────────────────────────────────────────────────────────┘
```

---

## File Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│ TRACK CACHE (youtube-track-cache.ts)                            │
├─────────────────────────────────────────────────────────────────┤
│ Storage: localStorage key "nexus-youtube-tracks-cache"         │
│ Data: Map<trackId, Track>                                      │
│ Max: 500 items                                                 │
│ TTL: 30 days (auto-cleanup on load)                            │
│                                                                │
│ getYouTubeTracksCache()          Load from storage            │
│ saveYouTubeTracksCache(cache)    Persist to storage          │
│ cacheYouTubeTrack(track)         Add/update single track      │
│ getCachedYouTubeTrack(id)        Lookup by ID (smart)        │
│ getCachedYouTubeTrackByVideoId() Lookup by video ID          │
│ getCachedYouTubeTracks(ids)      Batch lookup                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SERVICE CACHE (youtube/cache.ts)                                │
├─────────────────────────────────────────────────────────────────┤
│ Storage: localStorage prefix "yt_cache_*"                      │
│ Data: CacheEntry<T> with timestamp and expiresAt              │
│ Memory: Max 200 items, Storage: Max 1000 items                │
│ TTL: Varies by type (6h playlists, 7d videos)                 │
│                                                                │
│ getVideo(id)              Lookup video metadata               │
│ setVideo(video)           Cache video                         │
│ getSearch(query)          Lookup search results               │
│ setSearch(query, videos)  Cache search results               │
│ getPlaylist(id)           Lookup playlist                     │
│ setPlaylist(playlist)     Cache playlist                      │
│ getSuggestions(id)        Lookup suggestions                  │
│ getAutocomplete(query)    Lookup autocomplete (memory only)   │
│ getArtistPlaylists(name)  Lookup artist playlists           │
│ clear()                   Clear all                           │
│ getStats()                Get cache statistics               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ UTILITY FUNCTIONS                                               │
├─────────────────────────────────────────────────────────────────┤
│ ensurePlaylistTracksCached()  Sync playlist tracks to cache   │
│ getTrackFromAllOrCache()      Smart lookup (list → cache)    │
│ youtubeVideoToTrack()         Convert API → Track object      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Type Matrix

```
TYPE              │ L1 TTL │ L2 TTL  │ KEY PATTERN              │ MAX SIZE
──────────────────┼────────┼─────────┼──────────────────────────┼──────────
Video             │ 10min  │ 7 days  │ video:{videoId}          │ 1000
Search Results    │ 10min  │ 7 days  │ search:{query}           │ 1000
Playlist          │ 10min  │ 24 hrs  │ playlist:{playlistId}    │ 1000
Playlist Videos   │ 10min  │ 6 hrs   │ playlist_videos:{id}     │ 1000
Suggestions       │ 10min  │ 7 days  │ suggestions:{videoId}    │ 1000
Autocomplete      │ 10min  │ NONE    │ autocomplete:{query}     │ 200
Popular Suggest   │ 10min  │ 7 days  │ popular_suggestions      │ 1000
Artist Playlists  │ 10min  │ 24 hrs  │ artist_playlists:{name}  │ 1000
──────────────────┴────────┴─────────┴──────────────────────────┴──────────
Track Objects     │ STATE  │ 30 days │ nexus-youtube-tracks-cache│ 500
```

---

## API Usage Cheat Sheet

### Track Cache
```typescript
// Import
import { 
  cacheYouTubeTrack, 
  getCachedYouTubeTrack,
  getCachedYouTubeTrackByVideoId,
  getCachedYouTubeTracks,
  getYouTubeTracksCache,
  saveYouTubeTracksCache
} from '@/lib/youtube-track-cache';

// Cache operations
cacheYouTubeTrack(track);                    // Add/update
getCachedYouTubeTrack('id');                 // Get by track ID
getCachedYouTubeTrackByVideoId('vid');       // Get by video ID
getCachedYouTubeTracks(['id1', 'id2']);      // Batch get
getYouTubeTracksCache();                     // Get entire Map
saveYouTubeTracksCache(cache);               // Persist
```

### Service Cache
```typescript
// Import
import { youtubeCache } from '@/services/youtube/cache';

// Video caching
youtubeCache.getVideo('id');
youtubeCache.setVideo(videoObj);

// Search caching
youtubeCache.getSearch(query);
youtubeCache.setSearch(query, videos);

// Playlist caching
youtubeCache.getPlaylist(id);
youtubeCache.setPlaylist(obj);
youtubeCache.getPlaylistVideos(id);
youtubeCache.setPlaylistVideos(id, videos);

// Suggestions
youtubeCache.getSuggestions(id);
youtubeCache.setSuggestions(id, suggestions);

// Autocomplete (memory only)
youtubeCache.getAutocomplete(query);
youtubeCache.setAutocomplete(query, suggestions);

// Artist data
youtubeCache.getArtistPlaylists(name);
youtubeCache.setArtistPlaylists(name, playlists);

// Management
youtubeCache.clear();        // Clear all
youtubeCache.getStats();     // Stats: { memoryItems, storageItems }
```

---

## Event Handling

```typescript
// Listen for cache clear event
window.addEventListener('nexus-clear-cache', () => {
  // Cache has been cleared
  // App state should refresh if needed
});

// Dispatch cache clear event
window.dispatchEvent(new CustomEvent('nexus-clear-cache'));
```

---

## Common Operations

```
Operation              │ Code Example
───────────────────────┼────────────────────────────────────────
Search (cache-aside)   │ youtubeCache.getSearch(q) || fetch(q)
Add to favorites       │ cacheYouTubeTrack(track)
Load playlists         │ ensurePlaylistTracksCached(...)
Find track             │ getTrackFromAllOrCache(tracks, id)
Clear all caches       │ window.dispatchEvent(new CustomEvent(...))
Get cache size         │ youtubeCache.getStats()
Export cache data      │ localStorage.getItem('nexus-youtube-...')
```

---

## Debugging Commands

```javascript
// Browser Console

// 1. Check track cache
JSON.parse(localStorage.getItem('nexus-youtube-tracks-cache')).length
// Returns: number of cached tracks

// 2. Check service cache size
Object.keys(localStorage).filter(k => k.startsWith('yt_cache_')).length
// Returns: number of cached items

// 3. List all cache keys
Object.keys(localStorage).filter(k => k.startsWith('yt_cache_'))
// Returns: array of all cache keys

// 4. Inspect a specific cached video
JSON.parse(localStorage.getItem('yt_cache_video:dQw4w9WgXcQ'))
// Returns: { data, timestamp, expiresAt }

// 5. Check expiration
const cached = JSON.parse(localStorage.getItem('yt_cache_video:dQw4w9WgXcQ'));
new Date(cached.expiresAt); // When it expires

// 6. Clear everything
localStorage.clear(); sessionStorage.clear(); location.reload();

// 7. Monitor stats in app
import { youtubeCache } from '@/services/youtube/cache';
youtubeCache.getStats() // { memoryItems: N, storageItems: M }
```

---

## Performance Checklist

- [ ] L1 cache hit for repeated operations (<1ms)
- [ ] L2 cache promotes to L1 on first access
- [ ] API calls only on cache miss
- [ ] Track objects cached immediately after API call
- [ ] Playlists synced to track cache on load
- [ ] Cache size stays <1000 items (storage)
- [ ] No errors in console for cache operations
- [ ] localStorage not exceeding 5MB total
- [ ] Cache stats show healthy distribution (50-150 memory, 300-800 storage)

---

## Size Estimation

```
Item Type              │ Typical Size  │ Comments
───────────────────────┼───────────────┼─────────────────────────
Single Video          │ 500 bytes     │ Metadata only
Single Track          │ 1-2 KB        │ Full Track object
Search Result (20)    │ 15-20 KB      │ 20 videos + metadata
Playlist Metadata     │ 2-3 KB        │ ID, title, thumbnail
Playlist Videos (50)  │ 30-50 KB      │ 50 videos

MAX CACHE SIZES:
Memory:    200 items × 1 KB average = ~200 KB
Storage:   1000 items × 3 KB average = ~3 MB
Tracks:    500 items × 1.5 KB average = ~750 KB
TOTAL:     ~4-5 MB (within localStorage limits)
```

---

## Troubleshooting Matrix

```
Symptom                    │ Likely Cause           │ Solution
───────────────────────────┼────────────────────────┼──────────────────────
Cache not persisting       │ Storage cleared        │ Check localStorage
Track not found            │ Not cached yet         │ Call cacheYouTubeTrack
Cache growing huge         │ No cleanup             │ youtubeCache.clear()
Stale data returned        │ TTL not expired        │ Wait or clear manually
API called too often       │ Cache miss             │ Check cache logic
Storage quota exceeded     │ Too many items         │ Increase MAX_CACHE_SIZE?
Search results missing     │ Query doesn't match    │ Check query normalization
App slow after restart     │ Loading big cache      │ Reduce MAX_CACHE_SIZE
```

---

## Integration Checklist

When adding YouTube features:

- [ ] Import appropriate cache functions
- [ ] Check cache before API call
- [ ] Save results to cache after API success
- [ ] Use `youtubeVideoToTrack()` for conversions
- [ ] Call `cacheYouTubeTrack()` for Track objects
- [ ] Use `ensurePlaylistTracksCached()` for playlists
- [ ] Handle cache misses gracefully
- [ ] Test with cache cleared
- [ ] Monitor cache stats in development
- [ ] Document any custom TTL needs

---

## Key Principles

```
1. CACHE EARLY, OFTEN
   ├─ Cache after every API call
   └─ Cache when adding to favorites

2. CHECK CACHE FIRST
   ├─ Search cache before API
   ├─ Track cache for lookups
   └─ Avoid redundant API calls

3. TRUST TTL
   ├─ Let expiration happen naturally
   ├─ Don't manually refresh cached items
   └─ Only clear on errors/logout

4. PRESERVE DATA INTEGRITY
   ├─ Cache full Track objects
   ├─ Not just metadata
   └─ Maintain cross-component consistency

5. HANDLE GRACEFULLY
   ├─ Cache errors don't block UI
   ├─ Fall back to API on failure
   └─ Log but don't throw
```

---

This card is your quick reference to the entire YouTube cache system!
