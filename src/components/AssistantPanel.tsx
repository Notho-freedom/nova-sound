/**
 * Assistant Panel - Side panel for AI assistant
 * 
 * Integrated like other panels (Queue, Lyrics, etc.)
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  X,
  MessageCircle,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getRAGContext, type RAGResponse } from "@/services/vector-search";
import { generateAssistantResponse, type GroqMessage } from "@/lib/groq";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: RAGResponse["sources"];
  timestamp: Date;
}

interface AssistantPanelProps {
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Comment ajouter des titres ?",
  "Comment créer une playlist ?",
  "Synchroniser avec YouTube",
  "Fonctionnalités Pro",
];

export function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "Bonjour ! Je suis votre assistant Nova Sound. Comment puis-je vous aider ?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSendMessage = useCallback(async (question?: string) => {
    const messageText = question || input.trim();
    if (!messageText || loading) return;

    setInput("");

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);

    try {
      let ragResponse: RAGResponse | null = null;
      let ragContext = "";
      let ragSources: RAGResponse["sources"] = [];

      try {
        ragResponse = await getRAGContext(messageText);
        if (ragResponse) {
          ragContext = ragResponse.context;
          ragSources = ragResponse.sources;
        }
      } catch (ragError) {
        console.warn("[Assistant] RAG search failed:", ragError);
      }

      const groqMessages: GroqMessage[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      let assistantResponse: string;
      try {
        assistantResponse = await generateAssistantResponse(
          messageText,
          ragContext || undefined,
          groqMessages
        );
      } catch (groqError) {
        console.error("[Assistant] Groq failed:", groqError);
        throw groqError;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantResponse,
        sources: ragSources && ragSources.length > 0 ? ragSources : undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Assistant error:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Désolé, je n'ai pas pu répondre. Réessayez ou vérifiez votre connexion.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="w-80 h-full flex flex-col overflow-hidden bg-card/80 backdrop-blur-md border-l border-border/50 shadow-2xl shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/20">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-display text-sm tracking-wider text-foreground">ASSISTANT IA</h2>
        </div>
        <button
          onClick={onClose}
          title="Fermer l'assistant"
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-all duration-200 ease-out active:scale-95 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center",
                  message.role === "user"
                    ? "bg-primary/20"
                    : message.role === "system"
                    ? "bg-secondary/20"
                    : "bg-gradient-to-br from-primary/20 to-secondary/20"
                )}
              >
                {message.role === "user" ? (
                  <MessageCircle className="w-3 h-3 text-primary" />
                ) : message.role === "system" ? (
                  <Sparkles className="w-3 h-3 text-secondary" />
                ) : (
                  <Bot className="w-3 h-3 text-primary" />
                )}
              </div>

              {/* Message bubble */}
              <div
                className={cn(
                  "flex-1 rounded-lg p-2.5 max-w-[85%]",
                  message.role === "user"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/40 border border-border"
                )}
              >
                <p className="text-xs whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <BookOpen className="w-3 h-3" />
                      <span>Sources</span>
                    </div>
                    {message.sources.slice(0, 2).map((source, idx) => (
                      <div
                        key={idx}
                        className="text-[10px] text-muted-foreground/80 pl-3 truncate"
                      >
                        • {source.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-muted/40 border border-border rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Réflexion...</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggested questions */}
          {messages.length === 1 && !loading && (
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Suggestions</p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSendMessage(question)}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/20 transition-all text-left"
                  >
                    <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="truncate">{question}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Posez votre question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 h-9 text-xs bg-muted/30 border-border focus:border-primary/30"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-9 w-9"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
