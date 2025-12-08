import { useState, useEffect } from "react";
import { Minus, Square, X, Music, Copy } from "lucide-react";

interface TitleBarProps {
  title?: string;
}

export const TitleBar = ({ title = "NEXUS" }: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(!!window.electronAPI);
  }, []);

  const handleMinimize = async () => {
    await window.electronAPI?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    await window.electronAPI?.close();
  };

  return (
    <div 
      className="h-10 flex items-center justify-between bg-card/80 backdrop-blur-sm border-b border-border/50 px-3 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App Icon & Title */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center glow-cyan">
          <Music className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-display text-sm tracking-wider text-primary neon-text-cyan">
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">
          v1.0.0
          {!isElectron && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px]">
              WEB
            </span>
          )}
        </span>
      </div>

      {/* Window Controls - Only show in Electron */}
      {isElectron && (
        <div 
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
            title="Réduire"
          >
            <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
            title={isMaximized ? "Restaurer" : "Agrandir"}
          >
            {isMaximized ? (
              <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground rotate-90" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-destructive/80 transition-colors group"
            title="Fermer"
          >
            <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>
      )}

      {/* Placeholder for web version */}
      {!isElectron && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Lecteur Audio Futuriste</span>
        </div>
      )}
    </div>
  );
};
