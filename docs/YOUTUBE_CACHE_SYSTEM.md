# YouTube Cache System Architecture

## Overview

The Nova Sound application uses a **dual-layer caching system** for YouTube content to optimize performance, reduce API calls, and maintain data persistence across sessions. The system is distributed across multiple files handling different aspects of caching:

1. **Track-Level Cache** (`youtube-track-cache.ts`) - Full Track objects from YouTube
2. **Unified Service Cache** (`youtube/cache.ts`) - Videos, playlists, searches, suggestions
3. **Compatibility Shim** (`youtube-cache.ts`) - Bridge between old and new cache APIs
4. **Integration Points** - DesktopApp, hooks, and services

---

## Cache Architecture

### 1. Two-Layer Cache Strategy

#### Memory Layer (L1 Cache)
- **TTL**: 10 minutes (configurable)
- **Max Items**: 200 entries
- **Purpose**: Fast access during the current session
- **Eviction**: LRU (Least Recently Used) - removes oldest 20% when limit hit
- **Implementation**: JavaScript Map in memory

#### Storage Layer (L2 Cache)
- **TTL**: 7 days (configurable per cache type)
- **Max Items**: 1000 entries
- **Purpose**: Persistent data across app restarts
- **Storage**: localStorage with `yt_cache_` prefix
- **Eviction**: LRU - removes oldest 20% when limit hit
- **Implementation**: JSON serialization to localStorage

```typescript
// Cache Entry Structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;      // Date.now() when cached
  expiresAt: number;      // timestamp + TTL
}
```

### 2. Cache Types & Configuration

| Cache Type | Memory TTL | Storage TTL | Max Memory | Max Storage | Key Pattern |
|------------|-----------|------------|-----------|------------|------------|
| Videos | 10 min | 7 days | 200 | 1000 | `video:{videoId}` |
| Searches | 10 min | 7 days | 200 | 1000 | `search:{query}` |
| Playlists | 10 min | 24 hours | 200 | 1000 | `playlist:{playlistId}` |
| Playlist Videos | 10 min | 6 hours | 200 | 1000 | `playlist_videos:{playlistId}` |
| Suggestions | 10 min | 7 days | 200 | 1000 | `suggestions:{videoId}` |
| Autocomplete | 10 min | MEMORY ONLY | 200 | 0 | `autocomplete:{query}` |
| Popular Suggestions | 10 min | 7 days | 200 | 1000 | `popular_suggestions` |
| Artist Playlists | 10 min | 24 hours | 200 | 1000 | `artist_playlists:{artistName}` |

---

## Cache Files & Responsibilities

### File 1: `src/lib/youtube-track-cache.ts` (161 lines)

**Purpose**: Cache complete Track objects from YouTube with metadata preservation.

**Storage Key**: `nexus-youtube-tracks-cache`

**Data Structure**:
```typescript
interface CachedYouTubeTrack {
  track: Track;
  cachedAt: ISO8601 string;
}

// Stored as:
Map<trackId, Track>
```

**Key Functions**:

1. **`getYouTubeTracksCache(): Map<string, Track>`**
   - Retrieves cache from localStorage or in-memory fallback
   - Auto-cleanup: Removes entries older than 30 days
   - Returns empty Map if cache is corrupted
   - Fallback for SSR/test environments uses `inMemoryYouTubeCache`

2. **`saveYouTubeTracksCache(cache: Map<string, Track>): void`**
   - Persists entire cache Map to localStorage
   - Size limit: 500 entries max
   - Removes oldest entries when exceeding limit
   - Maintains in-memory mirror for test environments
   - Error handling: Logs to console but doesn't throw

3. **`cacheYouTubeTrack(track: Track): void`**
   - Adds/updates a single YouTube track
   - Only processes tracks with `mediaSource === 'youtube'`
   - Auto-saves to storage

4. **`getCachedYouTubeTrack(trackId: string): Track | null`**
   - Smart lookup with fallback patterns
   - Tries direct ID match first
   - Falls back to `youtubeVideoId` property
   - Handles variant ID formats:
     - `youtube-audio-{videoId}`
     - `youtube-{videoId}`
     - `yt-track-{videoId}`

5. **`getCachedYouTubeTrackByVideoId(videoId: string): Track | null`**
   - Direct lookup by YouTube video ID
   - Used for track resolution from cache

6. **`getCachedYouTubeTracks(trackIds: string[]): Track[]`**
   - Batch retrieval with filtering

**Auto-Cleanup Logic**:
```typescript
// On load: Remove entries older than 30 days
// On save: If size > 500, keep most recent 500
const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
entries = entries.filter(entry => 
  entry.cachedAt > thirtyDaysAgo
);
```

---

### File 2: `src/services/youtube/cache.ts` (331 lines)

**Purpose**: Unified cache manager for all YouTube API data types with TTL-based expiration.

**Implementation**: Singleton pattern with memory + localStorage coordination

**Key Methods**:

#### Video Caching
```typescript
getVideo(videoId: string): YouTubeVideo | null
setVideo(video: YouTubeVideo): void
```

#### Search Caching
```typescript
getSearch(query: string): YouTubeVideo[] | null
setSearch(query: string, videos: YouTubeVideo[]): void
```

#### Playlist Caching
```typescript
getPlaylist(playlistId: string): YouTubePlaylist | null
setPlaylist(playlist: YouTubePlaylist): void
getPlaylistVideos(playlistId: string): YouTubeVideo[] | null
setPlaylistVideos(playlistId: string, videos: YouTubeVideo[]): void
```

#### Suggestions & Autocomplete
```typescript
getSuggestions(videoId: string): YouTubeVideo[] | null
setSuggestions(videoId: string, suggestions: YouTubeVideo[]): void
getAutocomplete(query: string): string[] | null
setAutocomplete(query: string, suggestions: string[]): void  // Memory-only
```

#### Artist Data
```typescript
getArtistPlaylists(artistName: string): YouTubePlaylist[] | null
setArtistPlaylists(artistName: string, playlists: YouTubePlaylist[]): void
```

#### Cache Management
```typescript
clear(): void              // Clears memory + localStorage
getStats(): {              // Cache statistics
  memoryItems: number;
  storageItems: number;
}
```

**Internal Logic**:

1. **Get Flow**:
   - Check memory cache first (fast)
   - If expired or not found, check localStorage
   - If localStorage entry found but expired, remove it
   - Promote valid storage entries back to memory
   - Return null if both missing

2. **Set Flow**:
   - Enforce memory limit (remove oldest 20% if full)
   - Store in memory with memory TTL
   - Enforce storage limit (remove oldest 20% if full)
   - Store in localStorage with storage TTL (unless `memoryOnly`)
   - Use `JSON.stringify()` for serialization

3. **Expiration Cleanup**:
   - On every `get()`: Remove expired entries from whichever layer they're in
   - Periodic `cleanupExpired()`: Removes all expired entries from both layers
   - Adaptive TTL: Videos with >1M views get 3-day TTL, others get 7 days

4. **Size Limiting**:
   - Memory: Remove oldest 20% when reaching max (200 items)
   - Storage: Remove oldest 20% when reaching max (1000 items)
   - Sorting by timestamp for LRU eviction

---

### File 3: `src/services/youtube-cache.ts` (95 lines)

**Purpose**: Compatibility shim redirecting old cache API to unified service.

**Pattern**: Adapter pattern to maintain backward compatibility

**Exports**:
```typescript
export const youtubeCacheService = {
  getSearch(query: string): YouTubeVideo[] | null
  setSearch(query: string, videos: YouTubeVideo[]): void
  getVideo(videoId: string): YouTubeVideo | null
  setVideo(video: YouTubeVideo): void
  clear(): void
  clearL1(): void
  getStats(): { memoryItems: number; storageItems: number }
}
```

**Integration**: All calls delegate to `youtubeCache` singleton from `youtube/cache.ts`

---

## Integration Points

### 1. DesktopApp Component (`src/components/DesktopApp.tsx`)

**Cache State Management**:
```typescript
const [youtubeTracksCache, setYoutubeTracksCache] = 
  useState<Map<string, Track[]>>(new Map());
```

**Cache Initialization** (lines 70-80):
```typescript
// On mount: Load cached YouTube tracks from storage
useEffect(() => {
  const { getYouTubeTracksCache } = await import('@/lib/youtube-track-cache');
  const cachedTracks = getYouTubeTracksCache();
  
  setYoutubeTracksCache(prev => {
    const updated = new Map(prev);
    cachedTracks.forEach((track, id) => {
      if (!updated.has(id)) {
        updated.set(id, [track]);
      }
    });
    return updated;
  });
}, []);
```

**Cache Update on Library Load** (lines 85-95):
```typescript
// When library updates or playlists load
const { cacheYouTubeTrack } = await import('@/lib/youtube-track-cache');
const youtubeTracksInLibrary = libraryTracks.filter(
  t => t.mediaSource === 'youtube'
);
youtubeTracksInLibrary.forEach(track => {
  cacheYouTubeTrack(track);
});
```

**Cache Synchronization** (lines 121-130):
```typescript
// Merge cached YouTube tracks with library
youtubeTracksCache.forEach(tracks => {
  const combined = [...libraryTracks, ...tracks];
  setAllTracks(combined);
});
```

**Cache Clearing Event** (lines 1564-1576):
```typescript
const handleClearCacheEvent = async () => {
  try {
    localStorage.clear();      // Clears all localStorage including cache
    sessionStorage.clear();
    toast.success('Cache vidé avec succès');
  } catch (err) {
    console.error('[DesktopApp] Error clearing cache:', err);
  }
};

window.addEventListener('nexus-clear-cache', handleClearCacheEvent);
```

### 2. Playlist Cache (`src/lib/playlist-cache.ts`)

**Purpose**: Ensure tracks referenced by playlists are in the YouTube track cache

**Key Function**:
```typescript
export async function ensurePlaylistTracksCached(
  playlists: Playlist[] | null | undefined,
  allTracks: Track[],
  options?: { 
    fetchYouTubePlaylistVideos?: (id: string, limit?: number) => Promise<YouTubeSuggestion[]>;
    cacheYouTubeTrack?: (t: Track) => void;
  }
)
```

**Implementation**:
1. For YouTube playlists with `externalId`: Fetch videos and cache as Track objects
2. For playlists with `trackIds`: Find matching YouTube tracks in allTracks and cache them
3. Convert YouTubeSuggestion to YouTubeSearchResult, then to Track

**Called From**: DesktopApp when playlists load/update

### 3. Track Resolver (`src/lib/track-resolver.ts`)

**Purpose**: Resolve tracks from cache with fallback to allTracks list

**Key Function**:
```typescript
export function getTrackFromAllOrCache(
  allTracks: Track[], 
  trackId: string
): Track | null
```

**Resolution Order**:
1. Direct lookup in `allTracks` array
2. Fallback to `getCachedYouTubeTrack(trackId)`
3. Return null if not found

### 4. YouTube Search Service (`src/services/youtube/search.ts`)

**Cache Integration Points**:
- `youtubeCache.getSearch(query)` - Check before API call
- `youtubeCache.setSearch(query, videos)` - Cache after successful fetch
- `youtubeCache.setVideo(video)` - Cache individual videos
- `youtubeCache.getVideo(videoId)` - Quick lookup for video details
- `youtubeCache.getAutocomplete(query)` - Autocomplete caching
- `youtubeCache.getArtistPlaylists(artistName)` - Playlist caching

**Pattern**: Cache-aside (check cache first, API on miss, cache on success)

---

## Cache Flow Diagram

```
User Action (Search / Add Track / Load Playlist)
    ↓
Check youtubeCache (Memory L1)
    ├─ HIT → Return cached data (10 min TTL)
    └─ MISS → Check youtubeCache (Storage L2)
         ├─ HIT → Promote to L1, return (7 day TTL)
         └─ MISS → Fetch from YouTube API
              ↓
         Cache in both L1 and L2
              ↓
         Return to component
              ↓
    Save YouTube Tracks to Track Cache (youtube-track-cache.ts)
         ├─ Full Track object with metadata
         └─ Persisted separately in localStorage

On App Restart:
    ↓
DesktopApp mount → Load Track Cache from localStorage
    ↓
Restore youtubeTracksCache state
    ↓
ensurePlaylistTracksCached() → Add playlist tracks to cache
```

---

## Cache Statistics & Monitoring

**Get Cache Stats**:
```typescript
const stats = youtubeCache.getStats();
// Returns: { memoryItems: number, storageItems: number }
```

**Manual Cache Inspection** (Browser DevTools):
```javascript
// YouTube service cache (prefixed with 'yt_cache_')
Object.keys(localStorage).filter(k => k.startsWith('yt_cache_'))

// YouTube track cache
localStorage.getItem('nexus-youtube-tracks-cache')
```

---

## Cache Invalidation

### Automatic Expiration
- **Memory**: Entries expire after 10 minutes
- **Storage**: Entries expire after variable TTL (6 hours to 7 days)
- **Cleanup**: Expired entries removed on access or periodic cleanup

### Manual Clearing
```typescript
// Clear all caches
window.dispatchEvent(new CustomEvent('nexus-clear-cache'));
```

### Programmatic Clear
```typescript
import { youtubeCache } from '@/services/youtube/cache';
youtubeCache.clear();        // Clears everything
youtubeCache.clearL1();      // Clears memory only
```

---

## Data Consistency Strategy

### Track Metadata Preservation
- YouTube videos stored as **complete Track objects** (not just metadata)
- All Track properties preserved: `id`, `title`, `artist`, `album`, `duration`, `mediaSource='youtube'`, `youtubeVideoId`, etc.
- When cache is restored, tracks are fully functional

### Cross-Component Consistency
1. **Single Source of Truth**: `youtubeTracksCache` state in DesktopApp
2. **Synchronization**: 
   - Track cache syncs with DesktopApp state on mount
   - Library updates trigger cache updates
   - Playlists ensure their tracks are cached
3. **Fallback**: Track resolver can find tracks in cache if missing from library state

### Playlist-to-Track Linkage
```typescript
ensurePlaylistTracksCached() creates bidirectional link:
  Playlist.trackIds[] → Tracks in youtubeTracksCache
  Tracks.playlist → Reference back to playlist
```

---

## Performance Characteristics

| Operation | Time | Cache Layer |
|-----------|------|------------|
| L1 (Memory) Hit | <1ms | youtubeCache memory |
| L2 (Storage) Hit | 5-10ms | localStorage + JSON.parse |
| YouTube API Call | 500-2000ms | Network |
| Track Lookup | <1ms | Map.get() |
| Cache Cleanup (30 days) | 50-100ms | On load |
| Batch Track Caching | 10-50ms | For 10-50 tracks |

---

## Configuration & Customization

### Adjust TTL Values
```typescript
// In youtube/cache.ts
const CONFIG = {
  memoryTTL: 10 * 60 * 1000,        // 10 minutes
  storageTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxMemoryItems: 200,
  maxStorageItems: 1000,
};
```

### Cache Size Limits
```typescript
// Track cache limit
const MAX_CACHE_SIZE = 500;  // youtube-track-cache.ts line 9

// Service cache limits
maxMemoryItems: 200,
maxStorageItems: 1000,
```

---

## Testing Cache Behavior

### Unit Tests
- `youtube-track-cache.test.ts` - Track cache persistence
- `youtube-cache.test.ts` - Service cache TTL and expiration
- `playlist-cache.test.ts` - Playlist track caching

### Integration Tests
- `playlist-restart.test.ts` - Cache restoration on app restart
- `history-utils.test.ts` - Track lookup from cache

**Test Cache Clearing**:
```typescript
// Clear in-memory fallback
inMemoryYoutubeCache = new Map();

// Clear localStorage
localStorage.clear();
```

---

## Summary

The YouTube cache system is a **sophisticated two-layer architecture** designed for:

1. **Performance**: Memory cache for instant access, storage cache for persistence
2. **Reliability**: Automatic expiration, size limiting, corruption recovery
3. **Consistency**: Full Track object preservation, cross-component synchronization
4. **Maintainability**: Separate concerns (tracks vs service data), clean APIs, extensive testing

**Key Insight**: The system caches not just metadata, but complete Track objects, ensuring YouTube videos behave identically to local files throughout the application.
