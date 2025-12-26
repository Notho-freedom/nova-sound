/**
 * Panneau d'affichage des résultats d'analyse IA
 * Affiche les résultats natifs (gratuits) et IA Pro (si disponible)
 */

"use client";

import { useState } from 'react';
import { Brain, Sparkles, FileText, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AIAnalysisResult } from '@/hooks/useAudioAI';

interface AIAnalysisPanelProps {
  analysis: AIAnalysisResult;
  onStartAI?: () => void;
  className?: string;
}

export function AIAnalysisPanel({ analysis, onStartAI, className }: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'native' | 'transcription' | 'sentiment' | 'chapters'>('native');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("bg-black/80 backdrop-blur-sm rounded-lg border border-white/10 p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-white">Analyse IA</h3>
          {analysis.isPro && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
              PRO
            </span>
          )}
        </div>
        {!analysis.isPro && analysis.browserAnalysis && (
          <span className="text-xs text-muted-foreground">Mode Gratuit</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('native')}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded transition-colors",
            activeTab === 'native'
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-white"
          )}
        >
          <Sparkles className="w-3 h-3 inline mr-1" />
          Natif
        </button>
        {analysis.isPro && (
          <>
            <button
              onClick={() => setActiveTab('transcription')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                activeTab === 'transcription'
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <FileText className="w-3 h-3 inline mr-1" />
              Transcription
            </button>
            <button
              onClick={() => setActiveTab('sentiment')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                activeTab === 'sentiment'
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <TrendingUp className="w-3 h-3 inline mr-1" />
              Sentiment
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                activeTab === 'chapters'
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              <Users className="w-3 h-3 inline mr-1" />
              Chapitres
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {/* Tab: Native Analysis */}
        {activeTab === 'native' && analysis.browserAnalysis && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded p-2">
                <p className="text-xs text-muted-foreground">Intensité</p>
                <p className="text-sm font-semibold text-white">
                  {(analysis.browserAnalysis.intensity * 100).toFixed(0)}%
                </p>
              </div>
              <div className="bg-white/5 rounded p-2">
                <p className="text-xs text-muted-foreground">Voix détectée</p>
                <p className="text-sm font-semibold text-white">
                  {analysis.browserAnalysis.hasVoice ? 'Oui' : 'Non'}
                </p>
              </div>
              {analysis.browserAnalysis.pitch && (
                <div className="bg-white/5 rounded p-2">
                  <p className="text-xs text-muted-foreground">Pitch</p>
                  <p className="text-sm font-semibold text-white">
                    {analysis.browserAnalysis.pitch.toFixed(0)} Hz
                  </p>
                </div>
              )}
              <div className="bg-white/5 rounded p-2">
                <p className="text-xs text-muted-foreground">Silence</p>
                <p className="text-sm font-semibold text-white">
                  {analysis.browserAnalysis.isSilent ? 'Oui' : 'Non'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Équilibre fréquentiel</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 rounded p-2">
                  <p className="text-xs text-muted-foreground">Basses</p>
                  <div className="h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${analysis.browserAnalysis.bassLevel * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded p-2">
                  <p className="text-xs text-muted-foreground">Médiums</p>
                  <div className="h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${analysis.browserAnalysis.midLevel * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded p-2">
                  <p className="text-xs text-muted-foreground">Aigus</p>
                  <div className="h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${analysis.browserAnalysis.trebleLevel * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Transcription */}
        {activeTab === 'transcription' && analysis.isPro && (
          <div className="space-y-2">
            {analysis.isLoading ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : analysis.transcription ? (
              <div className="bg-white/5 rounded p-3">
                <p className="text-sm text-white leading-relaxed">{analysis.transcription}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Aucune transcription disponible
                </p>
                {onStartAI && (
                  <Button
                    onClick={onStartAI}
                    size="sm"
                    variant="outline"
                    className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                  >
                    Lancer l'analyse IA
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Sentiment */}
        {activeTab === 'sentiment' && analysis.isPro && (
          <div className="space-y-2">
            {analysis.isLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`sentiment-skeleton-${i}`} className="bg-white/5 rounded p-2 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : analysis.sentiment && analysis.sentiment.length > 0 ? (
              <div className="space-y-2">
                {analysis.sentiment.map((item, index) => (
                  <div key={index} className="bg-white/5 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(item.start)} - {formatTime(item.end)}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded",
                          item.sentiment === 'POSITIVE' && "bg-emerald-500/20 text-emerald-400",
                          item.sentiment === 'NEGATIVE' && "bg-rose-500/20 text-rose-400",
                          item.sentiment === 'NEUTRAL' && "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {item.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-white">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune analyse de sentiment disponible</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Chapters */}
        {activeTab === 'chapters' && analysis.isPro && (
          <div className="space-y-2">
            {analysis.isLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`chapter-skeleton-${i}`} className="bg-white/5 rounded p-3 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : analysis.chapters && analysis.chapters.length > 0 ? (
              <div className="space-y-2">
                {analysis.chapters.map((chapter, index) => (
                  <div key={index} className="bg-white/5 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">{chapter.headline}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(chapter.start)} - {formatTime(chapter.end)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{chapter.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun chapitre disponible</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {analysis.error && (
        <div className="flex items-center gap-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded text-sm text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <span>{analysis.error}</span>
        </div>
      )}

      {/* Pro Upgrade CTA */}
      {!analysis.isPro && activeTab !== 'native' && (
        <div className="bg-primary/10 border border-primary/20 rounded p-3 text-center space-y-2">
          <p className="text-xs text-primary font-medium">
            🔒 Fonctionnalité Pro
          </p>
          <p className="text-xs text-muted-foreground">
            Passez à Pro pour accéder à l'analyse IA avancée : transcription, sentiment, chapitres automatiques
          </p>
          <Button
            size="sm"
            variant="outline"
            className="bg-primary/20 border-primary/30 text-primary hover:bg-primary/30 w-full"
            onClick={() => {
              // Rediriger vers la page d'upgrade
              const settingsUrl = window.location.pathname.includes('/settings') 
                ? window.location.href.split('?')[0] + '?tab=subscription'
                : '/settings?tab=subscription';
              window.location.href = settingsUrl;
            }}
          >
            Passer à Pro
          </Button>
        </div>
      )}

      {/* Info pour utilisateurs non authentifiés */}
      {!analysis.isPro && activeTab === 'native' && (
        <div className="bg-white/5 border border-white/10 rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">
            Mode gratuit : Analyse audio native uniquement
          </p>
        </div>
      )}
    </div>
  );
}

