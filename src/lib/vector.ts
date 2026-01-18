/**
 * Upstash Vector Integration
 * 
 * Semantic search + RAG (Retrieval Augmented Generation)
 * 
 * Use cases:
 *   - Search tracks by description ("energetic rock song")
 *   - Find similar tracks by vibe
 *   - AI context retrieval for SkyOS assistant
 *   - Content recommendations
 *   - Duplicate detection (semantic)
 * 
 * Architecture:
 *   - Text → Embeddings (Jina AI free tier)
 *   - Embeddings → Vector DB (Upstash)
 *   - Query → Similar vectors → Top K results
 *   - Results → LLM context → Generated response
 */

import { Index } from "@upstash/vector";

type VectorMetadata = Record<string, string | number | boolean | string[]>;

// Upstash Vector client (Edge-compatible)
export const vector = process.env.UPSTASH_VECTOR_REST_URL &&
  process.env.UPSTASH_VECTOR_REST_TOKEN
  ? new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    })
  : null;

export const vectorConfig = {
  enabled: !!vector,
  embeddingModel: "jina-embeddings-I (free tier)
 * 
 * Free tier: 1M tokens/month
 * https://jina.ai/embeddings/
 */
export async function generateEmbeddings(
  text: string | string[]
): Promise<number[] | number[][]> {
  if (!vectorConfig.enabled) {
    throw new Error("Vector not configured");
  }

  const input = Array.isArray(text) ? text : [text];

  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.JINA_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: vectorConfig.embeddingModel,
        input,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embeddings failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    const embeddings = data.data.map((d) => d.embedding);
    return Array.isArray(text) ? embeddings : embeddings[0]

    if (!response.ok) {
      throw new Error(`Embeddings failed: ${response.statusText}`);
    }s with metadata
 * 
 * Usage:
 *   await upsertVectors([
 *     { id: "track-1", text: "Rock song", metadata: { ... } }
 *   ]);
 */
export async function upsertVectors(
  items: Array<{
    id: string;
    text: string;
    metadata?: VectorMetadata;
  }>
): Promise<void> {
  if (!vector) {
    console.warn("[Vector] Not configured");
    return;
  }

  try {
    // Generate embeddings for all texts
    const texts = items.map((item) => item.text);
    const embeddings = (await generateEmbeddings(texts)) as number[][];

    // Upsert to Vector DB
    await vector.upsert(
      items.map((item, idx) => ({
        id: item.id,
        vector: embeddings[idx],
        metadata: item.metadata || {},
      }))
    );

    console.log(`[Vector] Upserted ${items.length} vectors
            metadata,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Upsert failed: ${response.statusText}`);
    }
 
 * Usage:
 *   const results = await queryVectors("energetic rock song", 5);
 *   results.forEach(r => console.log(r.id, r.score));
 */
export async function queryVectors(
  query: string,
  options: {
    topK?: number;
    filter?: string;
    includeVectors?: boolean;
  } = {}
): Promise<
  Array<{
    id: string;
    score: number;
    metadata?: VectorMetadata;
    vector?: number[];
  }>
> {
  if (!vector) {
    console.warn("[Vector] Not configured");
    return [];
  }

  const { topK = vectorConfig.topK, filter, includeVectors = false } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = (await generateEmbeddings(query)) as number[];

    // Search
    const results = await vector.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      includeVectors,
      filter,
    });

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata as VectorMetadata,
      vector: r.vector,
    }))
        includeMetadata: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
   Delete vectors by IDs
 */
export async function deleteVectors(ids: string[]): Promise<void> {
  if (!vector) {
    console.warn("[Vector] Not configured");
    return;
  }

  try {
    await vector.delete(ids);
    console.log(`[Vector] Deleted ${ids.length} vectors`);
  } catch (error) {
    console.error("[Vector] Delete error:", error);
    throw error;
  }
}
Chunk text into smaller pieces for embedding
 * 
 * Usage:
 *   const chunks = chunkText(longText, 500);
 *   await upsertVectors(chunks.map((chunk, i) => ({
 *     id: `doc-${i}`,
 *     text: chunk,
 *     metadata: { source: "manual" }
 *   })));
 */
export function chunkText(
  text: string,
  maxTokens: number = vectorConfig.maxChunkSize
): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // Rough token estimate (1 token ≈ 4 chars)
    const estimatedTokens = (currentChunk + sentence).length / 4;

    if (estimatedTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + ". ";
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Reset vector index (delete all vectors)
 * Use with caution!
 */
export async function resetVectorIndex(): Promise<void> {
  if (!vector) {
    console.warn("[Vector] Not configured");
    return;
  }

  try {
    await vector.reset();
    console.log("[Vector] Index reset complete");
  } catch (error) {
    console.error("[Vector] Reset error:", error);
    throw error;
  }
}

/**
 * Get index stats
 */
export async function getVectorStats(): Promise<{
  vectorCount: number;
  dimension: number;
}> {
  if (!vector) {
    throw new Error("Vector not configured");
  }

  try {
    const info = await vector.info();
    return {
      vectorCount: info.vectorCount,
      dimension: info.dimension,
    };
  } catch (error) {
    console.error("[Vector] Stats error:", error);
    throw error;
  }
}   const prompt = `Context: ${context.map(c => c.content).join('\n')}\nQuestion: ...`;
 */
export async function ragRetrieve(
  userQuery: string,
  options: {
    topK?: number;
    filter?: string;
  } = {}
): Promise<
  Array<{
    id: string;
    content: string;
    source: string;
    score: number;
    metadata?: VectorMetadata;
  }>
> {
  const results = await queryVectors(userQuery, options);

  return results.map((result) => ({
    id: result.id,
    content: (result.metadata?.content as string) || "",
    source: (result.metadata?.source as string) || "",
    score: result.score,
    metadata: result.metadatae context + Generate response
 */
export async function ragRetrieve(
  userQuery: string,
  topK: number = 5
): Promise<Array<{ content: string; source: string; score: number }>> {
  const results = await queryVectors(userQuery, topK);

  return results.map((result) => ({
    content: result.metadata?.content as string,
    source: result.metadata?.source as string,
    score: result.score,
  }));
}

/**
 * Example flow for RAG:
 * 
 * 1. User asks question
 * 2. Query Vector to get relevant documents
 * 3. Build context from results
 * 4. Send context + question to LLM
 * 5. LLM generates answer with context
 * 
 * Usage:
 *   const context = await ragRetrieve("How does authentication work?");
 *   const llmPrompt = `
 *     Context: ${context.map(c => c.content).join('\n')}
 *     Question: How does authentication work?
 *   `;
 *   const answer = await llm.generate(llmPrompt);
 */

export const vectorPatterns = {
  /**
   * Index documents for semantic search
   */
  indexDocuments:
    "Chunk documents → Generate embeddings → Upsert with metadata",

  /**
   * RAG for Q&A
   */
  ragQuestionnaire:
    "Query vectors → Build context → Send to LLM → Return answer",

  /**
   * Find similar content
   */
  contentDiscovery: "Search by embedding → Return similar items",

  /**
   * Spam/safety detection
   */
  spamDetection: "Embed user input → Compare to known spam vectors",
};
