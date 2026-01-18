/**
 * Upstash Vector Integration (Ready for activation)
 * 
 * Vector = Serverless semantic search + embeddings
 * 
 * Use cases:
 *   - RAG (Retrieval Augmented Generation)
 *   - Semantic search
 *   - AI context retrieval
 *   - Similar content discovery
 *   - Spam detection
 * 
 * To enable:
 *   1. Get UPSTASH_VECTOR_REST_URL + token from Upstash console
 *   2. Add to Vercel environment variables
 *   3. Create embedding model (Jina AI, OpenAI, Cohere)
 * 
 * Pattern:
 *   - Chunk documents
 *   - Generate embeddings
 *   - Store in Vector (indexed)
 *   - Query by semantic similarity
 *   - Return top K results for LLM context
 */

import type { Metadata } from "@upstash/vector";

const VECTOR_ENDPOINT = process.env.UPSTASH_VECTOR_REST_URL;
const VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

export const vectorConfig = {
  enabled: !!VECTOR_ENDPOINT && !!VECTOR_TOKEN,
  endpoint: VECTOR_ENDPOINT,
  model: "jina-embeddings-v3", // or "text-embedding-3-small", etc.
  dimension: 1024, // jina-v3 = 1024, openai = 1536
};

/**
 * Generate embeddings using Jina API (free tier available)
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  if (!vectorConfig.enabled) {
    throw new Error("Vector not configured");
  }

  try {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.JINA_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: vectorConfig.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embeddings failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.data[0].embedding;
  } catch (error) {
    console.error("[Vector] Embedding generation failed:", error);
    throw error;
  }
}

/**
 * Upsert vector with metadata
 */
export async function upsertVector(
  id: string,
  vector: number[],
  metadata: Metadata
): Promise<void> {
  if (!vectorConfig.enabled) {
    console.warn("[Vector] Not configured");
    return;
  }

  try {
    const response = await fetch(`${VECTOR_ENDPOINT}/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VECTOR_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vectors: [
          {
            id,
            values: vector,
            metadata,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Upsert failed: ${response.statusText}`);
    }

    console.log(`[Vector] Upserted: ${id}`);
  } catch (error) {
    console.error("[Vector] Upsert error:", error);
    throw error;
  }
}

/**
 * Query vectors by semantic similarity
 */
export async function queryVectors(
  query: string,
  topK: number = 5
): Promise<Array<{ id: string; score: number; metadata: Metadata }>> {
  if (!vectorConfig.enabled) {
    console.warn("[Vector] Not configured");
    return [];
  }

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbeddings(query);

    // Search
    const response = await fetch(`${VECTOR_ENDPOINT}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VECTOR_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.matches || [];
  } catch (error) {
    console.error("[Vector] Query error:", error);
    throw error;
  }
}

/**
 * RAG Pattern: Retrieve context + Generate response
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
