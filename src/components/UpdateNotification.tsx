import { useEffect, useState } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpdateInfo {
  version: string;
  changelog?: string;
  buildDate?: string;
  commits?: Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Écouter les mises à jour depuis Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      // @ts-ignore - L'événement sera ajouté dans preload
      const removeListener = window.electronAPI.onUpdateAvailable?.((info: UpdateInfo) => {
        setUpdateInfo(info);
        setIsVisible(true);
      });

      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);

  if (!isVisible || !updateInfo) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
      <div
        className={cn(
          'relative w-full max-w-2xl mx-4 bg-gradient-to-br from-background via-background/95 to-primary/10',
          'border border-primary/20 rounded-2xl shadow-2xl backdrop-blur-xl',
          'px-6 py-4 md:px-8 md:py-6 pointer-events-auto',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-background/50 transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          aria-label="Fermer"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-primary/20">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">
                Mise à jour installée
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Version {updateInfo.version}
              {updateInfo.buildDate && ` • ${formatDate(updateInfo.buildDate)}`}
            </p>
          </div>
        </div>

        {/* Changelog */}
        {updateInfo.changelog && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Nouveautés
            </h3>
            <p className="text-sm text-muted-foreground bg-background/50 rounded-lg p-4 border border-border/50">
              {updateInfo.changelog}
            </p>
          </div>
        )}

        {/* Commits list */}
        {updateInfo.commits && updateInfo.commits.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Derniers changements
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {updateInfo.commits.slice(0, 5).map((commit, idx) => (
                <div
                  key={`${commit.hash}-${idx}`}
                  className="text-xs bg-background/30 rounded-lg p-3 border border-border/30"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-primary/70">
                      {commit.hash}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {formatDate(commit.date)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{commit.message}</p>
                  <p className="text-muted-foreground/70 text-[10px] mt-1">
                    par {commit.author}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setIsVisible(false)}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Parfait !
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10"
        onClick={() => setIsVisible(false)}
      />
    </div>
  );
}

