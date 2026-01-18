/**
 * SkyOS Assistant Component
 * 
 * AI Assistant with RAG (Retrieval Augmented Generation)
 * Uses Vector search to provide context-aware responses
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  X,
  MessageCircle,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getRAGContext, type RAGResponse } from "@/services/vector-search";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: RAGResponse["sources"];
  timestamp: Date;
}

interface NexusAssistantProps {
  className?: string;
  onClose?: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Comment ajouter des titres ?",
  "Comment créer une playlist ?",
  "Comment synchroniser avec YouTube ?",
  "Quelles sont les fonctionnalités Pro ?",
  "Comment utiliser les paroles ?",
];

export function NexusAssistant({ className, onClose }: NexusAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "👋 Bonjour ! Je suis Nexus, votre assistant Nova Sound. Posez-moi n'importe quelle question sur l'application !",
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

  const handleSendMessage = async (question?: string) => {
    const messageText = question || input.trim();
    if (!messageText || loading) return;

    // Clear input
    setInput("");

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Start loading
    setLoading(true);

    try {
      // Get RAG context
      const ragResponse = await getRAGContext(messageText);

      if (!ragResponse) {
        throw new Error("Impossible d'obtenir le contexte");
      }

      // Simulate AI response (in production, send to actual LLM)
      // For now, just show the context
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Voici ce que j'ai trouvé concernant votre question :\n\n${ragResponse.context}\n\n💡 Ces informations proviennent de la documentation de Nova Sound.`,
        sources: ragResponse.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Nexus error:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "😔 Désolé, je n'ai pas pu trouver de réponse à votre question. Essayez de reformuler ou consultez la documentation.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className={cn("flex flex-col h-[600px] backdrop-blur-xl bg-card/50 border-border/50", className)}>
      {/* Header */}
      <CardHeader className="flex-shrink-0 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold">Nexus Assistant</div>
              <div className="text-xs text-muted-foreground font-normal">
                Propulsé par l'IA sémantique
              </div>
            </div>
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea ref={scrollRef} className="h-full p-4">
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" && "flex-row-reverse"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                      message.role === "user"
                        ? "bg-primary"
                        : message.role === "system"
                        ? "bg-secondary"
                        : "bg-gradient-to-br from-primary to-secondary"
                    )}
                  >
                    {message.role === "user" ? (
                      <MessageCircle className="w-4 h-4 text-white" />
                    ) : message.role === "system" ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "flex-1 rounded-2xl p-3 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 space-y-1 pt-3 border-t border-border/30">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          <span>Sources :</span>
                        </div>
                        {message.sources.map((source, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-muted-foreground pl-4"
                          >
                            • {source.title}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="mt-2 text-[10px] opacity-60">
                      {message.timestamp.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Je réfléchis...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Suggested questions */}
            {messages.length === 1 && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2 pt-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HelpCircle className="w-3 h-3" />
                  <span>Questions suggérées :</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendMessage(question)}
                      className="text-xs h-auto py-2 px-3 rounded-full"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Posez votre question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Nexus utilise l'IA sémantique pour vous aider
        </p>
      </div>
    </Card>
  );
}
