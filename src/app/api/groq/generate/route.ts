/**
 * Groq API Endpoint
 * 
 * Proxies requests to Groq API for security
 * Protects API key from client exposure
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

interface GenerateRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequest;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || "llama-3.1-8b-instant",
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Groq] API error:", error);
      Sentry.captureException(new Error(`Groq API error: ${JSON.stringify(error)}`));

      return NextResponse.json(
        { error: error.error?.message || "Groq API error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Groq] Error:", error);
    Sentry.captureException(error);

    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
