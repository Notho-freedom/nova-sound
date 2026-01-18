/**
 * Vector Usage Examples
 * 
 * Copy-paste examples for common Vector patterns
 */

import { vectorHelpers } from "@/lib/vector-helpers";
import { vector, queryVectors, upsertVectors } from "@/lib/vector";

/**
 * Example 1: Index music library for semantic search
 */
export async function indexMusicLibrary(tracks: Array<{
  id: string;
  title: string;
  artist: string;
  genre?: string;
  description?: string;
  tags?: string[];
}>) {
  await vectorHelpers.indexTracks(tracks);
  console.log(`✅ Indexed ${tracks.length} tracks`);
}

/**
 * Example 2: Semantic track search
 */
export async function searchTracksByDescription(description: string) {
  const results = await vectorHelpers.searchTracks(description, 10);
  
  console.log(`Found ${results.length} tracks:`);
  results.forEach((track, idx) => {
    console.log(`${idx + 1}. ${track.title} by ${track.artist} (${track.score.toFixed(2)})`);
  });
  
  return results;
}

/**
 * Example 3: Index documentation for RAG
 */
export async function indexAppDocumentation() {
  const docs = [
    {
      id: "getting-started",
      title: "Getting Started",
      content: `
        Nova Sound is a powerful audio player...
        To add tracks:
        1. Click the "+" button
        2. Select audio files
        3. Wait for import
      `,
      source: "manual",
    },
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      content: `
        Space: Play/Pause
        Ctrl+L: Open library
        Ctrl+P: Open playlist
      `,
      source: "manual",
    },
    {
      id: "faq",
      title: "FAQ",
      content: `
        Q: How do I import YouTube tracks?
        A: Use the YouTube URL importer...
        
        Q: Can I sync across devices?
        A: Yes, with Pro subscription...
      `,
      source: "faq",
    },
  ];
  
  await vectorHelpers.indexDocumentation(docs);
  console.log(`✅ Indexed ${docs.length} documentation pages`);
}

/**
 * Example 4: RAG for Nexus assistant
 */
export async function askNexus(userQuestion: string) {
  // Get context from vector search
  const context = await vectorHelpers.getRAGContext(userQuestion, 5);
  
  // Build prompt for LLM
  const prompt = `
You are Nexus, the Nova Sound AI assistant.
Use the following context to answer the user's question.

Context:
${context}

User Question: ${userQuestion}

Answer:
  `.trim();
  
  console.log("Context retrieved:");
  console.log(context);
  
  // TODO: Send to LLM (OpenAI, Claude, etc.)
  // const answer = await llm.generate(prompt);
  
  return { context, prompt };
}

/**
 * Example 5: Find similar tracks
 */
export async function findSimilarTracks(trackId: string) {
  const similar = await vectorHelpers.findSimilarTracks(trackId, 5);
  
  console.log(`Similar tracks to ${trackId}:`);
  similar.forEach((track, idx) => {
    console.log(`${idx + 1}. ${track.title} by ${track.artist} (${track.score.toFixed(2)})`);
  });
  
  return similar;
}

/**
 * Example 6: Real-time search with caching
 */
export async function smartSearch(query: string) {
  // Track user query for analytics
  await vectorHelpers.indexUserQuery("user-123", query);
  
  // Perform semantic search
  const results = await vectorHelpers.searchTracks(query, 20);
  
  return results;
}

/**
 * Example 7: Batch track indexing
 */
export async function batchIndexTracks(tracks: Array<{
  id: string;
  title: string;
  artist: string;
  genre?: string;
}>, batchSize: number = 100) {
  console.log(`Indexing ${tracks.length} tracks in batches of ${batchSize}...`);
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    await vectorHelpers.indexTracks(batch);
    console.log(`Indexed batch ${i / batchSize + 1}: ${batch.length} tracks`);
  }
  
  console.log("✅ All tracks indexed");
}

/**
 * Example 8: Delete outdated vectors
 */
export async function cleanupDeletedTracks(deletedTrackIds: string[]) {
  await vectorHelpers.deleteTrackVectors(deletedTrackIds);
  console.log(`✅ Cleaned up ${deletedTrackIds.length} deleted track vectors`);
}

/**
 * Example 9: Multi-modal search (text + metadata)
 */
export async function advancedSearch(params: {
  query: string;
  genre?: string;
  minScore?: number;
}) {
  const { query, genre, minScore = 0.7 } = params;
  
  // Build filter
  let filter = "type = 'track'";
  if (genre) {
    filter += ` AND genre = '${genre}'`;
  }
  
  // Search with filter
  const results = await queryVectors(query, {
    topK: 20,
    filter,
  });
  
  // Filter by minimum score
  return results.filter(r => r.score >= minScore);
}

/**
 * Example 10: Semantic deduplication
 */
export async function findDuplicateTracks(tracks: Array<{
  id: string;
  title: string;
  artist: string;
}>) {
  const duplicates: Array<{ original: string; duplicate: string; score: number }> = [];
  
  // For each track, find similar tracks
  for (const track of tracks) {
    const query = `${track.title} ${track.artist}`;
    const similar = await vectorHelpers.searchTracks(query, 3);
    
    // Check for very high similarity (likely duplicate)
    similar.forEach(s => {
      if (s.id !== track.id && s.score > 0.95) {
        duplicates.push({
          original: track.id,
          duplicate: s.id,
          score: s.score,
        });
      }
    });
  }
  
  console.log(`Found ${duplicates.length} potential duplicates`);
  return duplicates;
}

/**
 * Example 11: Context-aware recommendations
 */
export async function getSmartRecommendations(params: {
  currentTrack: { title: string; artist: string; genre: string };
  recentTracks: Array<{ title: string; artist: string }>;
  userPreferences: string[];
}) {
  const { currentTrack, recentTracks, userPreferences } = params;
  
  // Build context query
  const contextQuery = [
    `Similar to: ${currentTrack.title} by ${currentTrack.artist}`,
    `Genre: ${currentTrack.genre}`,
    `Recently played: ${recentTracks.map(t => t.title).join(", ")}`,
    `User likes: ${userPreferences.join(", ")}`,
  ].join(". ");
  
  // Search with context
  const recommendations = await vectorHelpers.searchTracks(contextQuery, 10);
  
  // Filter out recently played
  const recentIds = recentTracks.map(t => `track-${t.title}`);
  return recommendations.filter(r => !recentIds.includes(r.id));
}

/**
 * Example 12: Monitor vector index health
 */
export async function checkIndexHealth() {
  const stats = await vectorHelpers.getIndexStats();
  
  console.log(`
📊 Vector Index Stats:
- Total vectors: ${stats.vectorCount}
- Dimension: ${stats.dimension}
- Status: ${stats.vectorCount > 0 ? "Healthy" : "Empty"}
  `);
  
  return stats;
}
