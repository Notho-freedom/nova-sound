/**
 * Groq LLM Integration
 * 
 * Groq provides ultra-fast LLM inference
 * Used as fallback for Nexus Assistant when RAG context is insufficient
 * 
 * Models available:
 *   - llama-3.1-70b-versatile (70B - most capable)
 *   - llama-3.1-8b-instant (8B - fastest)
 *   - mixtral-8x7b-32768 (MoE - balanced)
 */

import * as Sentry from "@sentry/nextjs";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const NEXT_API_URL = "/api/groq/generate";
const DEFAULT_MODEL = "llama-3.1-8b-instant"; // Fast model for assistant

/**
 * Call Groq API - uses Next.js route in browser, direct call on server
 */
export async function callGroq(
  messages: GroqMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  try {
    // Use Next.js API route when available (handles browser + server)
    const useApiRoute = typeof window !== "undefined" || !process.env.GROQ_API_KEY;
    
    if (useApiRoute) {
      // Browser or no server API key - use Next.js route
      const response = await fetch(NEXT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          model: options?.model || DEFAULT_MODEL,
          temperature: options?.temperature ?? 0.7,
          maxTokens: options?.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Groq API error: ${error.error || response.statusText}`);
      }

      const data = (await response.json()) as GroqResponse;
      const content = data.choices[0]?.message.content;

      if (!content) {
        throw new Error("No response from Groq");
      }

      return content;
    } else {
      // Server-side with API key - call directly
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured");
      }

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options?.model || DEFAULT_MODEL,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
      }

      const data = (await response.json()) as GroqResponse;
      const content = data.choices[0]?.message.content;

      if (!content) {
        throw new Error("No response from Groq");
      }

      return content;
    }
  } catch (error) {
    console.error("[Groq] Error:", error);
    Sentry.captureException(error);
    throw error;
  }
}

/**
 * Generate assistant response using Groq
 * 
 * Used as fallback when RAG context is not available
 */
export async function generateAssistantResponse(
  userQuestion: string,
  context?: string,
  conversationHistory?: GroqMessage[]
): Promise<string> {
  const systemPrompt = context
    ? `Tu es Nexus, l'assistant IA de Nova Sound. Voici le contexte :

${context}

Utilise ce contexte pour répondre à la question de l'utilisateur. Sois concis et utile.`
    : `Tu es Nexus, l'assistant IA de Nova Sound. Tu aides les utilisateurs avec des questions sur l'application.

Domaines d'expertise :
- Gestion musicale et playlists
- YouTube Sync
- Fonctionnalités Pro/Premium
- Synchronisation et bibliothèque
- Lyrics et métadonnées
- Configuration et préférences

Sois amical, professionnel et utile. Réponds en français.`;

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []),
    { role: "user", content: userQuestion },
  ];

  return callGroq(messages, {
    model: DEFAULT_MODEL,
    temperature: 0.7,
    maxTokens: 512,
  });
}

/**
 * Groq models reference
 */
export const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant", // Fastest, good for chat
  balanced: "mixtral-8x7b-32768", // Balanced quality/speed
  quality: "llama-3.1-70b-versatile", // Highest quality, slower
} as const;

/**
 * Health check for Groq API
 */
export async function groqHealthCheck(): Promise<boolean> {
  try {
    const response = await callGroq(
      [{ role: "user", content: "Hi" }],
      { maxTokens: 10 }
    );
    return !!response;
  } catch (error) {
    console.error("[Groq] Health check failed:", error);
    return false;
  }
}
