import { Minus, Square, X, Music } from "lucide-react";

// Extend window type for Electron API
declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

interface TitleBarProps {
  title?: string;
}

export const TitleBar = ({ title = "NEXUS" }: TitleBarProps) => {
  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <div 
      className="h-10 flex items-center justify-between bg-card border-b border-border px-3 select-none"
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
        <span className="text-[10px] text-muted-foreground ml-1">v1.0.0</span>
      </div>

      {/* Window Controls */}
      <div 
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
          title="Minimize"
        >
          <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors group"
          title="Maximize"
        >
          <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-destructive/80 transition-colors group"
          title="Close"
        >
          <X className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
        </button>
      </div>
    </div>
  );
};
