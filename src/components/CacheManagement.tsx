/**
 * Cache Management Component
 * Allows users to view and clear their application cache
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

interface CacheStats {
  timestamp: string;
  userId: string | null;
  cacheServices: {
    service: string;
    ttl: number;
  }[];
}

export function CacheManagement() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const handleGetStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cache?action=stats");
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setShowStats(true);
        toast.success("📊 Cache stats loaded");
      } else {
        toast.error("Failed to load cache stats");
      }
    } catch (err) {
      toast.error("Error loading cache stats");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm("🗑️  Clear all cache? (Stats/genres will be recalculated on next boot)")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/cache?action=clear", {
        method: "GET",
      });
      const data = await response.json();

      if (data.success) {
        toast.success("✅ Cache cleared successfully");
        setShowStats(false);
        setStats(null);
      } else {
        toast.error("Failed to clear cache");
      }
    } catch (err) {
      toast.error("Error clearing cache");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Cache Management</h3>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        App caches calculations (stats, genres) in Upstash Redis for faster boot.
        <br />
        Cache auto-expires after defined TTL.
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGetStats}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          View Cache Stats
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleClearCache}
          disabled={loading}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear Cache
        </Button>
      </div>

      {showStats && stats && (
        <div className="mt-4 p-3 bg-background rounded border border-border text-xs space-y-2">
          <div>
            <strong>Cache Services:</strong>
          </div>
          {stats.cacheServices.map((service) => (
            <div key={service.service} className="flex justify-between pl-2">
              <span>{service.service}:</span>
              <span className="text-muted-foreground">
                TTL: {(service.ttl / 60 / 60).toFixed(1)}h
              </span>
            </div>
          ))}
          <div className="text-muted-foreground text-xs pt-2">
            Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
        <div>💡 <strong>Tip:</strong> Clear cache if you notice stale data or want a fresh calculation.</div>
        <div>⚡ <strong>Performance:</strong> Stats load from cache in milliseconds instead of seconds.</div>
        <div>🔄 <strong>Auto-refresh:</strong> Worker recalculates in background, cache updated.</div>
      </div>
    </div>
  );
}
