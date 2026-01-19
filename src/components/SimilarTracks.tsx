/**
 * SimilarTracks Component
 * 
 * Displays similar tracks using Vector semantic search
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Play, Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import type { Track } from "@/types/music";
import { findSimilarTracks } from "@/services/vector-search";

interface SimilarTracksProps {
  currentTrack: Track;
  onPlayTrack?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  className?: string;
  limit?: number;
}

export function SimilarTracks({
  currentTrack,
  onPlayTrack,
  onAddToQueue,
  className,
  limit = 5,
}: SimilarTracksProps) {
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSimilarTracks = async () => {
      if (!currentTrack?.id) return;

      setLoading(true);
      setError(null);

      try {
        const results = await findSimilarTracks(currentTrack.id, limit);
        setSimilarTracks(results.map((r) => r.track));
      } catch (err) {
        setError("Failed to load similar tracks");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSimilarTracks();
  }, [currentTrack?.id, limit]);

  if (loading) {
    return (
      <Card className={cn("backdrop-blur-xl bg-card/50", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Similar Tracks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || similarTracks.length === 0) {
    return null;
  }

  return (
    <Card className={cn("backdrop-blur-xl bg-card/50 border-border/50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Similaire à ce titre</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {similarTracks.map((track, index) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "group flex items-center gap-3 p-2 rounded-lg",
                "hover:bg-white/5 transition-all duration-200",
                "border border-transparent hover:border-primary/20"
              )}
            >
              {/* Cover */}
              <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                <img
                  src={getCoverUrl(track.coverUrl || "")}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23374151' width='48' height='48'/%3E%3C/svg%3E";
                  }}
                />
                {/* Play overlay */}
                <div
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => onPlayTrack?.(track)}
                >
                  <Play className="w-5 h-5 text-white fill-current" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {track.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artist}
                </p>
              </div>

              {/* Actions */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => onAddToQueue?.(track)}
                  title="Ajouter à la file"
                >
                  <Music className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
