"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface HeroSearchProps {
  /** Current search value */
  value?: string;
  /** Value change callback */
  onChange?: (value: string) => void;
  /** Search submit callback */
  onSubmit?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Enable voice search */
  enableVoice?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Hero search component - integrated search bar for search variant
 * Features voice search and loading states
 */
export const HeroSearch = ({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Rechercher des titres, artistes, albums...",
  enableVoice = false,
  isLoading = false,
  autoFocus = false,
  className,
  size = "lg",
}: HeroSearchProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(value);
  };

  const handleClear = () => {
    onChange?.("");
    inputRef.current?.focus();
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange?.(transcript);
      onSubmit?.(transcript);
    };

    recognition.start();
  };

  const sizeClasses = {
    sm: {
      container: "h-10",
      input: "text-sm px-10",
      icon: "w-4 h-4",
      iconLeft: "left-3",
      iconRight: "right-3",
    },
    md: {
      container: "h-12",
      input: "text-base px-12",
      icon: "w-5 h-5",
      iconLeft: "left-4",
      iconRight: "right-4",
    },
    lg: {
      container: "h-14 md:h-16",
      input: "text-lg md:text-xl px-14 md:px-16",
      icon: "w-5 h-5 md:w-6 md:h-6",
      iconLeft: "left-5 md:left-6",
      iconRight: "right-5 md:right-6",
    },
  }[size];

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn("relative w-full max-w-2xl", className)}
    >
      <div 
        className={cn(
          "relative rounded-full overflow-hidden transition-all duration-300",
          "bg-white/10 backdrop-blur-xl border border-white/20",
          "shadow-lg shadow-black/20",
          isFocused && "bg-white/15 border-white/30 shadow-xl shadow-black/30 ring-2 ring-white/20",
          sizeClasses.container
        )}
      >
        {/* Search Icon */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none",
          sizeClasses.iconLeft
        )}>
          {isLoading ? (
            <Loader2 className={cn(sizeClasses.icon, "text-white/60 animate-spin")} />
          ) : (
            <Search className={cn(sizeClasses.icon, "text-white/60")} />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "w-full h-full bg-transparent border-none outline-none",
            "text-white placeholder:text-white/50",
            "focus:ring-0 focus:outline-none",
            sizeClasses.input
          )}
        />

        {/* Right Icons */}
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center gap-2",
          sizeClasses.iconRight
        )}>
          {/* Clear Button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10",
                "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              )}
              aria-label="Effacer"
            >
              <X className={sizeClasses.icon} />
            </button>
          )}

          {/* Voice Search Button */}
          {enableVoice && 'webkitSpeechRecognition' in window && (
            <button
              type="button"
              onClick={handleVoiceSearch}
              disabled={isListening}
              className={cn(
                "p-1.5 rounded-full transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                isListening 
                  ? "text-red-400 bg-red-500/20 animate-pulse" 
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
              aria-label={isListening ? "Écoute en cours..." : "Recherche vocale"}
            >
              <Mic className={sizeClasses.icon} />
            </button>
          )}
        </div>
      </div>

      {/* Voice feedback */}
      {isListening && (
        <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/80 animate-pulse">
          Parlez maintenant...
        </p>
      )}
    </form>
  );
};
