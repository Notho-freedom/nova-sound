# YouTube Cache System - Integration Diagrams

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  (YouTubePlayer, Search, Favorites, Playlists, Suggestions)    │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    TRACKS                          SERVICE DATA
    (Full objects)                  (API responses)
         │                               │
         ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│  Track Cache         │      │  Unified Service     │
│  (youtube-track-    │      │  Cache               │
│   cache.ts)         │      │  (youtube/cache.ts)  │
└──────────────────────┘      └──────────────────────┘
         │                               │
    Map<id, Track>               Map<key, CacheEntry<T>>
    localStorage key:           localStorage prefix:
    "nexus-youtube-tracks-cache"  "yt_cache_*"
         │                               │
         ▼                               ▼
    ┌─────────────────────────────────────────┐
    │    localStorage (Persistence Layer)     │
    │  Size Limit: ~2-3 MB                    │
    │  TTL: 6 hours to 7 days                 │
    └─────────────────────────────────────────┘
         │
         │ (on app restart)
         ▼
    ┌─────────────────────────────────────────┐
    │      DesktopApp (Initialization)        │
    │  • Load cached tracks                   │
    │  • Restore youtubeTracksCache state     │
    │  • Ensure playlist tracks cached        │
    └─────────────────────────────────────────┘
```

---

## Data Flow: User Searches for Music

```
User enters search query
         │
         ▼
YouTubeSearch component
         │
         ▼
youtubeCache.getSearch(query)  ◄─── Check L1 (Memory, 10min TTL)
         │
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
    YES  │  NO
        │
        │ (NO) ▼
        │   youtubeCache checks L2 (Storage, 7day TTL)
        │         │
        │    ┌────┴────┐
        │    │ Found?  │
        │    └────┬────┘
        │    YES  │  NO
        │        │
        │        │ (NO) ▼
        │        │   Fetch from YouTube API
        │        │         │
        │        │         ▼
        │        │   Parse & convert videos
        │        │         │
        │        │         ▼
        │        │   youtubeCache.setSearch(query, videos)
        │        │   youtubeCache.setVideo() for each
        │        │         │
        │        │         ├─→ Store in L1 (Memory)
        │        │         └─→ Store in L2 (localStorage)
        │        │
        ├────────┘
        │
        ▼
Return cached videos
        │
        ▼
YouTubeSearchResult → youtubeVideoToTrack()
        │
        ▼
Cache full Track objects
    cacheYouTubeTrack(track)
        │
        ├─→ getYouTubeTracksCache() [Load current]
        ├─→ Add/update track in Map
        └─→ saveYouTubeTracksCache() [Persist to localStorage]
        │
        ▼
Display to user
```

---

## Data Flow: Add Track to Favorites

```
User clicks "Add to Favorites"
         │
         ▼
Convert YouTubeVideo → Track object
    youtubeVideoToTrack(result)
         │
         ▼
addTrackToQueue(track)
         │
         ▼
Track cached automatically?
    ├─ YES: getCachedYouTubeTrack() returns it
    └─ NO: cacheYouTubeTrack() adds it
         │
         ▼
Store in youtubeTracksCache state (DesktopApp)
         │
         ├─→ Update React state
         ├─→ Update library/favorites in database
         └─→ Persist to localStorage via cacheYouTubeTrack()
         │
         ▼
Track available on next app session
```

---

## Data Flow: App Restart (Cache Restoration)

```
App loads (DesktopApp mount)
         │
         ▼
useEffect(() => {}, [])
         │
         ▼
getYouTubeTracksCache()  ◄── Load from localStorage
         │
    ┌────┴──────────────┐
    │  Cache exists?    │
    └────┬──────────────┘
    YES  │  NO
        │
        │ (YES) ▼
        │   Parse JSON from localStorage
        │         │
        │         ▼
        │   Auto-cleanup: Remove entries > 30 days old
        │         │
        │         ▼
        │   Return Map<string, Track>
        │         │
        │    (NO) ▼
        │   Return empty Map
        │         │
        └─────────┬──────┐
                  │      │
                  ▼      ▼
            setYoutubeTracksCache(map)
                  │      │
                  ▼      ▼
         Restore all cached tracks to state
                  │      │
                  └──┬───┘
                     │
                     ▼
         Tracks available in queue/search
            (without new API calls)
                     │
                     ▼
         ensurePlaylistTracksCached()
            │
            ├─ Fetch YouTube playlist contents
            ├─ Convert to Track objects
            └─ Add to youtubeTracksCache
                     │
                     ▼
         Full library restored from cache!
```

---

## Cache Layers Interaction

```
Memory Cache (L1)                Storage Cache (L2)
┌─────────────────────┐          ┌────────────────────┐
│ YouTubeCache        │          │ localStorage       │
│ memoryCache: Map    │          │ "yt_cache_*"       │
│                     │          │                    │
│ TTL: 10 minutes     │          │ TTL: 6h-7 days    │
│ Max: 200 items      │          │ Max: 1000 items    │
│                     │          │                    │
│ Speed: <1ms         │          │ Speed: 5-10ms      │
└──────────┬──────────┘          └────────┬───────────┘
           │                              │
           │ Cache HIT                    │
           │ (Return immediately)         │
           │                              │
           └──────────────┬───────────────┘
                          │
                   Cache MISS
                          │
                          ▼
            ┌──────────────────────────┐
            │  API Call to YouTube     │
            │  (500-2000ms)            │
            └──────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │  Parse & Cache Response  │
            │                          │
            │  1. L1 (Memory)          │
            │  2. L2 (localStorage)    │
            └──────────────────────────┘
```

---

## Cache Key Patterns

```
SEARCH CACHE
  Key: "search:{query}"
  Example: "search:taylor swift"
  Value: YouTubeVideo[]

VIDEO CACHE
  Key: "video:{videoId}"
  Example: "video:dQw4w9WgXcQ"
  Value: YouTubeVideo

PLAYLIST CACHE
  Key: "playlist:{playlistId}"
  Example: "playlist:PLxxxxx"
  Value: YouTubePlaylist

PLAYLIST VIDEOS
  Key: "playlist_videos:{playlistId}"
  Example: "playlist_videos:PLxxxxx"
  Value: YouTubeVideo[]

SUGGESTIONS
  Key: "suggestions:{videoId}"
  Example: "suggestions:dQw4w9WgXcQ"
  Value: YouTubeVideo[]

AUTOCOMPLETE
  Key: "autocomplete:{query}"
  Example: "autocomplete:taylor"
  Value: string[]
  Note: Memory-only, not persisted

ARTIST PLAYLISTS
  Key: "artist_playlists:{artistName}"
  Example: "artist_playlists:taylor swift"
  Value: YouTubePlaylist[]

TRACK CACHE
  Key: "{trackId}"
  Example: "yt-track-12345"
  Storage Key: "nexus-youtube-tracks-cache"
  Value: Map<trackId, Track>
  Note: Separate from service cache
```

---

## Component Integration Points

```
┌──────────────────────────────────────────────────────────┐
│                      DesktopApp.tsx                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ State: youtubeTracksCache                       │   │
│  │ Type: Map<string, Track[]>                      │   │
│  │ Purpose: Store all cached YouTube tracks       │   │
│  └─────────────────────────────────────────────────┘   │
│                     │                                    │
│      ┌──────────────┼──────────────┬──────────────┐    │
│      │              │              │              │    │
│      ▼              ▼              ▼              ▼    │
│  useEffect  useEffect  handlePlaylistL useLibrary.ts  │
│  (mount)    (library   oaded       useQueue.ts       │
│             load)                  YouTubeSearch.ts  │
│                                                       │
│  • Initialize    • Cache YouTube  • Restore on  • Search
│    cache from      tracks from       startup      results
│    storage         library         • Merge with   caching
│  • Load from     • Ensure           library      • Track
│    localStorage    playlists        state         adding
│                    cached                        • API
│                  • Sync with                        call
│                    state                           caching
└──────────────────────────────────────────────────────┘
         │              │                │
         ▼              ▼                ▼
    ┌────────────┐  ┌─────────────┐  ┌──────────────────┐
    │Track Cache │  │Playlist     │  │Unified Service   │
    │youtube-    │  │Cache        │  │Cache             │
    │track-cache │  │playlist-    │  │youtube/cache.ts  │
    │.ts         │  │cache.ts     │  │                  │
    └────────────┘  └─────────────┘  └──────────────────┘
         │              │                │
         └──────────────┴────────────────┘
                      │
                      ▼
            ┌──────────────────────────┐
            │   localStorage           │
            │   (Browser Persistence)  │
            └──────────────────────────┘
```

---

## Cache Size Management

```
Memory Cache (L1)
┌─────────────────────────────┐
│ Items: [1] [2] [3] ... [200]│
│ Each ~1KB                   │
│ Total: ~200KB               │
│                             │
│ When adding item [201]:     │
│ ┌─ Remove oldest 20%        │
│ ├─ 200 * 0.2 = 40 items    │
│ └─ Keep newest 160          │
└─────────────────────────────┘

Storage Cache (L2)
┌─────────────────────────────┐
│ Items: [1] [2] [3] ... [1000]│
│ Each ~2-3KB average         │
│ Total: ~2-3MB               │
│                             │
│ When adding item [1001]:    │
│ ┌─ Remove oldest 20%        │
│ ├─ 1000 * 0.2 = 200 items  │
│ └─ Keep newest 800          │
└─────────────────────────────┘

Overflow Policy: LRU (Least Recently Used)
┌──────────────────────────────────┐
│ Sorted by: timestamp             │
│ Oldest items removed first       │
│ Newest items preserved longest   │
└──────────────────────────────────┘
```

---

## Expiration & Cleanup Flow

```
AUTOMATIC EXPIRATION

On Access (get):
  Current Time → Compare with expiresAt
    │
    ├─ expiresAt > now → Valid, return data
    │
    └─ expiresAt ≤ now → Expired, remove entry
                        Return null

Periodic Cleanup:
  cleanupExpired() runs periodically
    │
    ├─ Loop through memory cache
    │  └─ Remove entries where now ≥ expiresAt
    │
    └─ Loop through localStorage
       └─ Remove entries where now ≥ expiresAt
           │
           └─ Call localStorage.removeItem()

Manual Cleanup:
  youtubeCache.clear()
    │
    ├─ memoryCache.clear()
    │
    └─ localStorage: Remove all "yt_cache_*" keys
           │
           └─ Also called by "nexus-clear-cache" event

TRACK CACHE CLEANUP

On Load (getYouTubeTracksCache):
  All entries in storage
    │
    ├─ Calculate 30 days ago
    │
    ├─ Filter: entries where cachedAt > 30 days ago
    │
    ├─ On Save: If size > 500
    │  └─ Keep only newest 500 entries
    │
    └─ Return cleaned cache
```

---

## Cache Consistency Model

```
TRACK OBJECT FLOW

Source: YouTube API
         │
         ▼
youtubeVideoToTrack()
    Convert YouTubeVideo → Track
         │
         ├─ id: Generated or mapped
         ├─ title: From video title
         ├─ artist: From channel title
         ├─ album: Empty or derived
         ├─ duration: From video duration
         ├─ mediaSource: 'youtube'
         ├─ youtubeVideoId: Original video ID
         ├─ coverImageUrl: Thumbnail URL
         └─ [... all Track fields ...]
         │
         ▼
Cache TWO places:
    1. youtubeTracksCache (DesktopApp state)
    2. Track Cache (localStorage "nexus-youtube-tracks-cache")
         │
         ├─→ State synced across app
         ├─→ Persisted for next session
         └─→ Available for offline playback
         │
         ▼
Track used EVERYWHERE:
    ├─ Queue playback
    ├─ Favorites/Playlists
    ├─ Search results
    ├─ Recently played
    └─ Recommendations

CONSISTENCY GUARANTEE:
    Same Track object everywhere
    No metadata loss or transformation
    Properties consistent throughout app
```

---

## Error Handling Flow

```
ANY CACHE OPERATION

Try:
  │
  ├─ youtubeCache.get/set()
  │
  ├─ localStorage.getItem/setItem()
  │
  ├─ JSON.parse/stringify()
  │
  └─ Map operations
         │
    ┌────┴────┐
    │ Success? │
    └────┬────┘
    YES  │  NO
        │
    (YES)│ (NO)
        │   │
        │   ▼
        │   console.warn()
        │   │
        │   ├─ Don't throw
        │   ├─ Don't block UI
        │   └─ Fall back to:
        │       • Return null
        │       • Skip this cache layer
        │       • Continue to API
        │
        ▼
GRACEFUL DEGRADATION
    • Missing cache → Fetch from API
    • Corrupted cache → Skip, start fresh
    • Storage full → Remove oldest 20%
    • Parse error → Use in-memory fallback

NEVER:
    ✗ Block UI
    ✗ Lose user data
    ✗ Show error to user (log instead)
    ✗ Crash the app
```

---

## Performance Characteristics

```
CACHE HIT DISTRIBUTION (Expected)

            Memory (L1)          Storage (L2)         API Miss
            Hit Rate: 60-70%     Hit Rate: 20-25%    Rate: 5-15%
                │                    │                  │
                │                    │                  │
            <1ms latency         5-10ms latency      500-2000ms
                │                    │                  │
                ▼                    ▼                  ▼
        ┌─────────────┐      ┌─────────────┐      ┌──────────┐
        │ Fast loads  │      │ OK loads    │      │ Slow,    │
        │ Best UX     │      │ Acceptable  │      │ New data │
        │             │      │             │      │          │
        │ 60-70% of   │      │ 20-25% of   │      │ 5-15% of │
        │ requests    │      │ requests    │      │ requests │
        └─────────────┘      └─────────────┘      └──────────┘

BATCH OPERATIONS

Single cacheYouTubeTrack():
    │
    ├─ getYouTubeTracksCache()  : ~50ms (load from localStorage)
    ├─ Add 1 entry              : <1ms
    ├─ saveYouTubeTracksCache() : ~50ms (save to localStorage)
    │
    └─ Total: ~100ms per track

Multiple tracks:
    │
    ├─ Load once              : ~50ms
    ├─ Add 10 entries         : <1ms
    ├─ Save once              : ~50ms
    │
    └─ Total: ~100ms for 10 tracks (~10ms each)
       ✓ Much better than 100ms × 10 = 1000ms
```

---

## Testing Cache Layers

```
UNIT TESTS

youtube-track-cache.test.ts
  ├─ Save & restore from localStorage
  ├─ Cleanup old entries (30 days)
  ├─ Size limiting (500 items)
  ├─ ID variant handling
  └─ In-memory fallback

youtube-cache.test.ts
  ├─ Memory cache TTL expiration
  ├─ Storage cache TTL expiration
  ├─ LRU eviction on overflow
  ├─ Type-specific TTL values
  └─ get/set coordination

INTEGRATION TESTS

playlist-restart.test.ts
  ├─ Save tracks before restart
  ├─ Load tracks after restart
  ├─ Merge with library state
  └─ Ensure consistency

history-utils.test.ts
  ├─ Lookup via track resolver
  ├─ Cache fallback chain
  └─ Track matching variants
```

---

## Summary Flow

```
App Startup
    │
    ▼
Load Track Cache from localStorage
    │
    ▼
Initialize youtubeTracksCache state
    │
    ▼
User: Search YouTube
    │
    ├─ Check youtubeCache (L1+L2)
    ├─ API call if miss
    └─ Add results to youtubeTracksCache
    │
    ▼
User: Add to Favorites
    │
    ├─ Cache Track object
    ├─ Update state
    └─ Persist to storage
    │
    ▼
User: Closes/Restarts App
    │
    ├─ All caches saved to localStorage
    ├─ App reloads
    └─ Load from localStorage
    │
    ▼
User: New Session
    │
    ├─ No API calls needed for cached items
    ├─ Instant access to favorites
    └─ Full playback without internet (cached tracks only)
```

This is the complete YouTube Cache System architecture in Nova Sound!
