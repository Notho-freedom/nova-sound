# Vector Integration Guide

## 🎯 Overview

Upstash Vector est intégré dans Nova Sound pour permettre la **recherche sémantique** et le **RAG (Retrieval Augmented Generation)** pour l'assistant SkyOS.

## 🏗️ Architecture

```
User Query ("energetic rock song")
    ↓
Generate Embeddings (Jina AI)
    ↓
Query Vector DB (Upstash Vector)
    ↓
Retrieve Top K Results
    ↓
┌───────────────┬─────────────────┐
│   Use Case 1  │   Use Case 2    │
│ Direct Search │ RAG + LLM       │
└───────────────┴─────────────────┘
        ↓               ↓
   Return Results  Build Context
                        ↓
                   Send to LLM
                        ↓
                   AI Response
```

## 📦 Files Created

### Core Integration
- `src/lib/vector.ts` - Vector client & core functions
- `src/lib/vector-helpers.ts` - Simplified API
- `src/lib/vector-examples.ts` - Usage examples

### API Routes
- `src/app/api/vector/search/route.ts` - Semantic search endpoint
- `src/app/api/vector/index/route.ts` - Index/delete vectors
- `src/app/api/vector/rag/route.ts` - RAG for SkyOS
- `src/app/api/vector/stats/route.ts` - Index statistics

## 🚀 Activation

### 1. Get Upstash Vector Credentials

```bash
# Go to: https://console.upstash.com/vector
# Create new vector index:
#   - Name: nova-sound-vectors
#   - Region: us-east-1 (or closest to you)
#   - Dimension: 1024 (for Jina embeddings v3)
#   - Similarity: COSINE

# Copy credentials
```

### 2. Get Jina AI API Key (Free)

```bash
# Go to: https://jina.ai/embeddings/
# Sign up for free account
# Copy API key

# Free tier: 1M tokens/month
```

### 3. Add to Vercel Environment

```bash
# In Vercel dashboard, add:
UPSTASH_VECTOR_REST_URL=https://your-vector.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your-token
JINA_API_KEY=jina_xxxxxxxxxxxxx
```

### 4. Verify Installation

```bash
# Test stats endpoint
curl https://yourdomain.com/api/vector/stats
```

## 📝 Usage

### Index Tracks for Semantic Search

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

const tracks = [
  {
    id: "track-1",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    genre: "Rock",
    description: "Epic rock ballad with opera influences",
    tags: ["classic", "rock", "opera"],
  },
  // ... more tracks
];

await vectorHelpers.indexTracks(tracks);
```

### Semantic Track Search

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

// Natural language search
const results = await vectorHelpers.searchTracks(
  "energetic rock song with guitar solos",
  10
);

results.forEach(track => {
  console.log(`${track.title} by ${track.artist} (${track.score})`);
});
```

### RAG for SkyOS Assistant

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

// 1. Index documentation
await vectorHelpers.indexDocumentation([
  {
    id: "getting-started",
    title: "Getting Started",
    content: "Nova Sound is...",
  },
]);

// 2. Get context for user question
const context = await vectorHelpers.getRAGContext(
  "How do I add tracks?",
  5
);

// 3. Build prompt for LLM
const prompt = `
Context: ${context}
Question: How do I add tracks?
Answer:
`;

// 4. Send to LLM (OpenAI, Claude, etc.)
// const answer = await llm.generate(prompt);
```

### API Endpoints

#### Search Tracks

```bash
GET /api/vector/search?q=energetic rock song&limit=10&type=track
```

Response:
```json
{
  "success": true,
  "query": "energetic rock song",
  "type": "track",
  "results": [
    {
      "id": "track-1",
      "title": "Song Title",
      "artist": "Artist Name",
      "genre": "Rock",
      "score": 0.92
    }
  ]
}
```

#### Index Tracks

```bash
POST /api/vector/index
Content-Type: application/json

{
  "type": "track",
  "data": [
    {
      "id": "track-1",
      "title": "Song",
      "artist": "Artist"
    }
  ]
}
```

#### RAG Context

```bash
POST /api/vector/rag
Content-Type: application/json

{
  "query": "How do I add tracks?",
  "topK": 5
}
```

#### Get Stats

```bash
GET /api/vector/stats
```

Response:
```json
{
  "enabled": true,
  "vectorCount": 1234,
  "dimension": 1024,
  "config": {
    "embeddingModel": "jina-embeddings-v3",
    "dimension": 1024,
    "topK": 5
  }
}
```

## 🎛️ Use Cases

### 1. Semantic Music Search

**Problem:** Traditional search only matches exact text  
**Solution:** Vector search understands meaning

```typescript
// Traditional: "rock song" only matches tracks with "rock" in title
// Vector: Understands "energetic guitar music" = rock songs
const results = await vectorHelpers.searchTracks("upbeat morning music");
```

### 2. Smart Recommendations

**Problem:** Collaborative filtering needs lots of data  
**Solution:** Semantic similarity works with any data

```typescript
// Find tracks similar to current track
const similar = await findSimilarTracks("track-123");
```

### 3. SkyOS RAG Assistant

**Problem:** LLMs don't know about Nova Sound specifics  
**Solution:** RAG provides context from docs

```typescript
// User asks: "How do I sync playlists?"
const context = await vectorHelpers.getRAGContext(
  "How do I sync playlists?",
  5
);
// Context contains relevant docs about syncing
// Send to LLM for natural answer
```

### 4. Duplicate Detection

**Problem:** Same song with different metadata  
**Solution:** Semantic similarity finds duplicates

```typescript
// Finds "Bohemian Rhapsody" vs "bohemian rhappsody" vs "Boh Rhap"
const duplicates = await findDuplicateTracks(tracks);
```

### 5. Context-Aware Playlists

**Problem:** Static playlists don't adapt  
**Solution:** Build playlists based on vibe

```typescript
// "Create workout playlist"
const workoutTracks = await vectorHelpers.searchTracks(
  "high energy intense workout motivation",
  50
);
```

## 🔧 Advanced Patterns

### Batch Indexing

```typescript
// Index large libraries in batches
const batchSize = 100;
for (let i = 0; i < tracks.length; i += batchSize) {
  const batch = tracks.slice(i, i + batchSize);
  await vectorHelpers.indexTracks(batch);
  console.log(`Indexed batch ${i / batchSize + 1}`);
}
```

### Filtered Search

```typescript
import { queryVectors } from "@/lib/vector";

// Search only rock tracks
const results = await queryVectors("energetic song", {
  topK: 10,
  filter: "genre = 'Rock'",
});
```

### Real-time Search

```typescript
// Track user searches for analytics
await vectorHelpers.indexUserQuery("user-123", query);

// Perform search
const results = await vectorHelpers.searchTracks(query);
```

### Cleanup Deleted Tracks

```typescript
// Remove vectors for deleted tracks
await vectorHelpers.deleteTrackVectors(["track-1", "track-2"]);
```

## 🔍 Monitoring

### Check Index Health

```typescript
import { vectorHelpers } from "@/lib/vector-helpers";

const stats = await vectorHelpers.getIndexStats();
console.log(`
  Vectors: ${stats.vectorCount}
  Dimension: ${stats.dimension}
`);
```

### Upstash Dashboard

```
https://console.upstash.com/vector
```

View:
- Vector count
- Storage usage
- Query latency
- Error rate

## 🐛 Troubleshooting

### Vector Not Configured

```typescript
// Check env vars
console.log(process.env.UPSTASH_VECTOR_REST_URL); // Should be set
console.log(process.env.JINA_API_KEY); // Should be set
```

### Embeddings Failed

1. **Check Jina API key**: Verify it's valid
2. **Check quota**: Free tier = 1M tokens/month
3. **Check network**: Ensure API is accessible

### Search Returns Nothing

1. **Check if data indexed**:
   ```typescript
   const stats = await vectorHelpers.getIndexStats();
   console.log(`Vectors: ${stats.vectorCount}`); // Should be > 0
   ```

2. **Check query**:
   ```typescript
   // Too specific queries may not match
   // Use broader terms
   ```

3. **Check similarity threshold**:
   ```typescript
   // Lower score = less similar
   // Typical range: 0.7-1.0 for good matches
   ```

## ✨ Benefits

### Before (Text Search Only)
- ❌ Exact match required
- ❌ No understanding of meaning
- ❌ Typos break search
- ❌ No AI context

### After (Vector Search)
- ✅ Semantic understanding
- ✅ Natural language queries
- ✅ Typo-tolerant
- ✅ RAG for AI assistant
- ✅ Smart recommendations
- ✅ Duplicate detection

## 📊 Performance

### Embedding Generation (Jina AI)
- Speed: ~50ms per request
- Batch: Up to 100 texts
- Cost: Free (1M tokens/month)

### Vector Search (Upstash)
- Speed: ~20ms per query
- Scale: Millions of vectors
- Cost: Free tier (10K vectors)

## 🔐 Security

- ✅ Vector data encrypted at rest
- ✅ API keys in environment variables
- ✅ Edge runtime (no Node.js APIs)
- ✅ HTTPS only

## 💰 Cost Optimization

### Free Tiers
- **Jina AI**: 1M tokens/month (≈10K track indexes)
- **Upstash Vector**: 10K vectors (≈10K tracks)

### Paid Plans
- **Jina AI**: $0.02 per 1M tokens
- **Upstash Vector**: $10/month for 100K vectors

### Tips
1. Index only essential metadata
2. Batch embedding requests
3. Cache frequent queries
4. Use filters to reduce search space

## 📚 Examples

Full examples: `src/lib/vector-examples.ts`

## 🎯 Next Steps

1. ✅ **Vector Foundation** - Done
2. 🟡 **Index Music Library** - Index your tracks
3. 🟡 **Test Semantic Search** - Try natural language queries
4. 🟡 **Implement RAG** - Connect to LLM for SkyOS
5. 🟡 **Production Optimize** - Monitor and tune

## 🚀 Summary

Vector integration is now complete with:
- **Semantic search** (natural language)
- **RAG foundation** (SkyOS context)
- **Smart recommendations** (similar tracks)
- **Duplicate detection** (semantic)
- **Type-safe API** (TypeScript)

**Ready for intelligent search!** 🧠
