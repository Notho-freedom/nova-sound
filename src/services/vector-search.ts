/**
 * Vector Search Service - UI Integration
 * 
 * Provides semantic search capabilities for the UI
 */

import type { Track } from "@/types/music";

export interface VectorSearchResult {
  track: Track;
  score: number;
  reason?: string;
}

export interface RAGResponse {
  context: string;
  sources: Array<{
    title: string;
    url?: string;
    excerpt: string;
  }>;
  suggestedPrompt?: string;
}

/**
 * Search tracks using semantic search
 */
export async function searchTracksSemanticSearch(
  query: string,
  limit: number = 20
): Promise<VectorSearchResult[]> {
  try {
    const response = await fetch(
      `/api/vector/search?q=${encodeURIComponent(query)}&limit=${limit}&type=track`
    );

    if (!response.ok) {
      console.error("Vector search failed:", response.statusText);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.results) {
      return [];
    }

    return data.results.map((result: any) => ({
      track: result.metadata as Track,
      score: result.score,
      reason: result.score > 0.8 ? "Excellent match" : result.score > 0.6 ? "Good match" : "Related",
    }));
  } catch (error) {
    console.error("Vector search error:", error);
    return [];
  }
}

/**
 * Get RAG context for Nexus assistant
 */
export async function getRAGContext(query: string): Promise<RAGResponse | null> {
  try {
    const response = await fetch("/api/vector/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK: 5 }),
    });

    if (!response.ok) {
      console.error("RAG request failed:", response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return {
      context: data.context,
      sources: data.sources,
      suggestedPrompt: data.suggestedPrompt,
    };
  } catch (error) {
    console.error("RAG error:", error);
    return null;
  }
}

/**
 * Find similar tracks
 */
export async function findSimilarTracks(
  trackId: string,
  limit: number = 10
): Promise<VectorSearchResult[]> {
  try {
    const response = await fetch(
      `/api/vector/search?q=${encodeURIComponent(trackId)}&limit=${limit}&filter=similar&namespace=tracks`
    );

    if (!response.ok) {
      console.error("Similar tracks search failed:", response.statusText);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.results) {
      return [];
    }

    // Filter out the source track
    return data.results
      .filter((result: any) => result.metadata.id !== trackId)
      .map((result: any) => ({
        track: result.metadata as Track,
        score: result.score,
        reason: "Similar content",
      }));
  } catch (error) {
    console.error("Similar tracks error:", error);
    return [];
  }
}

/**
 * Check if Vector search is available
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/vector/stats");
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.success && data.stats.count > 0;
  } catch {
    return false;
  }
}

/**
 * Index tracks to Vector database
 */
export async function indexTracksToVector(tracks: Track[]): Promise<boolean> {
  try {
    const response = await fetch("/api/vector/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "track",
        data: tracks,
      }),
    });

    if (!response.ok) {
      console.error("Indexing failed:", response.statusText);
      return false;
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Indexing error:", error);
    return false;
  }
}
