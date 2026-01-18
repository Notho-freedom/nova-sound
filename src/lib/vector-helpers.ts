/**
 * Vector Helpers: Simplified API for common patterns
 * 
 * Usage examples:
 * 
 *   // Index tracks for semantic search
 *   await vectorHelpers.indexTracks(tracks);
 * 
 *   // Search tracks by description
 *   const results = await vectorHelpers.searchTracks("energetic rock song");
 * 
 *   // RAG for SkyOS assistant
 *   const context = await vectorHelpers.getRAGContext("How do I add tracks?");
 */

import {
  upsertVectors,
  queryVectors,
  ragRetrieve,
  chunkText,
  deleteVectors,
  getVectorStats,
} from "@/lib/vector";

type Track = {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  description?: string;
  tags?: string[];
};

/**
 * Index tracks for semantic search
 * 
 * Indexes: title, artist, genre, description, tags
 */
export async function indexTracks(tracks: Track[]): Promise<void> {
  const items = tracks.map((track) => {
    // Build searchable text
    const text = [
      track.title,
      track.artist,
      track.genre,
      track.description,
      track.tags?.join(" "),
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id: `track-${track.id}`,
      text,
      metadata: {
        type: "track",
        id: track.id,
        title: track.title,
        artist: track.artist,
        genre: track.genre || "unknown",
        content: text,
        source: "library",
      },
    };
  });

  await upsertVectors(items);
  console.log(`[Vector] Indexed ${tracks.length} tracks`);
}

/**
 * Search tracks by natural language query
 * 
 * Usage:
 *   const results = await searchTracks("energetic rock song", 10);
 */
export async function searchTracks(
  query: string,
  topK: number = 10
): Promise<
  Array<{
    id: string;
    title: string;
    artist: string;
    genre: string;
    score: number;
  }>
> {
  const results = await queryVectors(query, {
    topK,
    filter: "type = 'track'",
  });

  return results.map((r) => ({
    id: r.metadata?.id as string,
    title: r.metadata?.title as string,
    artist: r.metadata?.artist as string,
    genre: (r.metadata?.genre as string) || "unknown",
    score: r.score,
  }));
}

/**
 * Find similar tracks by ID
 * 
 * Usage:
 *   const similar = await findSimilarTracks("track-123", 5);
 */
export async function findSimilarTracks(
  trackId: string,
  topK: number = 5
): Promise<
  Array<{
    id: string;
    title: string;
    artist: string;
    score: number;
  }>
> {
  // TODO: Implement using vector similarity
  // For now, return empty array
  return [];
}

/**
 * Index documentation for RAG
 * 
 * Usage:
 *   await indexDocumentation([
 *     { id: "doc-1", title: "Getting Started", content: "..." },
 *     { id: "doc-2", title: "FAQ", content: "..." }
 *   ]);
 */
export async function indexDocumentation(
  docs: Array<{ id: string; title: string; content: string; source?: string }>
): Promise<void> {
  const items: Array<{
    id: string;
    text: string;
    metadata: Record<string, string | number | boolean | string[]>;
  }> = [];

  for (const doc of docs) {
    // Chunk long documents
    const chunks = chunkText(doc.content, 500);

    chunks.forEach((chunk, idx) => {
      items.push({
        id: `${doc.id}-chunk-${idx}`,
        text: chunk,
        metadata: {
          type: "documentation",
          docId: doc.id,
          title: doc.title,
          chunkIndex: idx,
          content: chunk,
          source: doc.source || "manual",
        },
      });
    });
  }

  await upsertVectors(items);
  console.log(`[Vector] Indexed ${docs.length} docs (${items.length} chunks)`);
}

/**
 * Get RAG context for SkyOS assistant
 * 
 * Usage:
 *   const context = await getRAGContext("How do I add tracks?");
 *   const prompt = `Context: ${context}\nQuestion: How do I add tracks?`;
 */
export async function getRAGContext(
  userQuery: string,
  topK: number = 5
): Promise<string> {
  const results = await ragRetrieve(userQuery, {
    topK,
    filter: "type = 'documentation'",
  });

  if (results.length === 0) {
    return "No relevant context found.";
  }

  // Build context string
  const context = results
    .map((r, idx) => {
      return `[${idx + 1}] (Score: ${r.score.toFixed(2)})
${r.content}
Source: ${r.source}
`;
    })
    .join("\n\n");

  return context;
}

/**
 * Index user queries for analytics
 * 
 * Usage:
 *   await indexUserQuery("user-123", "energetic rock song");
 */
export async function indexUserQuery(
  userId: string,
  query: string
): Promise<void> {
  await upsertVectors([
    {
      id: `query-${Date.now()}-${userId}`,
      text: query,
      metadata: {
        type: "query",
        userId,
        content: query,
        source: "user-search",
        timestamp: Date.now(),
      },
    },
  ]);
}

/**
 * Delete track vectors by IDs
 * 
 * Usage:
 *   await deleteTrackVectors(["track-123", "track-456"]);
 */
export async function deleteTrackVectors(trackIds: string[]): Promise<void> {
  const vectorIds = trackIds.map((id) => `track-${id}`);
  await deleteVectors(vectorIds);
  console.log(`[Vector] Deleted ${vectorIds.length} track vectors`);
}

/**
 * Get vector index statistics
 * 
 * Usage:
 *   const stats = await getIndexStats();
 *   console.log(`Vectors: ${stats.vectorCount}`);
 */
export async function getIndexStats(): Promise<{
  vectorCount: number;
  dimension: number;
}> {
  return getVectorStats();
}

/**
 * Export all helpers
 */
export const vectorHelpers = {
  // Track operations
  indexTracks,
  searchTracks,
  findSimilarTracks,
  deleteTrackVectors,

  // Documentation operations
  indexDocumentation,
  getRAGContext,

  // Analytics
  indexUserQuery,

  // Admin
  getIndexStats,
};
