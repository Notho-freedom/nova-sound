"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { X, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  showResizeHandle?: boolean;
  persistSize?: boolean;
  side?: "left" | "right";
}

const getStoredWidth = (id: string, defaultWidth: number): number => {
  if (typeof window === "undefined") return defaultWidth;
  const stored = localStorage.getItem(`panel-width-${id}`);
  return stored ? parseInt(stored, 10) : defaultWidth;
};

const setStoredWidth = (id: string, width: number) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`panel-width-${id}`, width.toString());
};

const getStoredExpanded = (id: string): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`panel-expanded-${id}`) === "true";
};

const setStoredExpanded = (id: string, expanded: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`panel-expanded-${id}`, expanded.toString());
};

export function FloatingPanel({
  id,
  isOpen,
  onClose,
  title,
  icon,
  children,
  defaultWidth = 320,
  minWidth = 280,
  maxWidth = 600,
  className,
  showResizeHandle = true,
  persistSize = true,
  side = "right",
}: FloatingPanelProps) {
  const [width, setWidth] = useState(() => 
    persistSize ? getStoredWidth(id, defaultWidth) : defaultWidth
  );
  const [isExpanded, setIsExpanded] = useState(() =>
    persistSize ? getStoredExpanded(id) : false
  );
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Persist width changes
  useEffect(() => {
    if (persistSize && !isExpanded) {
      setStoredWidth(id, width);
    }
  }, [id, width, persistSize, isExpanded]);

  // Persist expanded state
  useEffect(() => {
    if (persistSize) {
      setStoredExpanded(id, isExpanded);
    }
  }, [id, isExpanded, persistSize]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const startWidth = width;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = "touches" in moveEvent 
        ? (moveEvent as TouchEvent).touches[0].clientX 
        : (moveEvent as MouseEvent).clientX;
      
      const diff = side === "right" 
        ? startX - currentX 
        : currentX - startX;
      
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + diff));
      setWidth(newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);
  }, [width, minWidth, maxWidth, side]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const effectiveWidth = isExpanded ? maxWidth : width;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ 
            opacity: 0, 
            x: side === "right" ? 40 : -40,
            scale: 0.95 
          }}
          animate={{ 
            opacity: 1, 
            x: 0,
            scale: 1 
          }}
          exit={{ 
            opacity: 0, 
            x: side === "right" ? 40 : -40,
            scale: 0.95 
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30 
          }}
          style={{ width: effectiveWidth }}
          className={cn(
            "h-full flex flex-col overflow-hidden",
            // Glassmorphism Vision Pro style - même blur que les autres panels
            "bg-card/80 backdrop-blur-md",
            "border-l border-border/50",
            "shadow-2xl shadow-black/20",
            isResizing && "select-none",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              {icon && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/20">
                  {icon}
                </div>
              )}
              <h2 className="font-display text-sm tracking-wider text-foreground uppercase">
                {title}
              </h2>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Expand/Collapse button */}
              <button
                onClick={toggleExpand}
                className="p-1.5 rounded-lg hover:bg-muted/40 transition-all duration-200 text-muted-foreground hover:text-foreground"
                title={isExpanded ? "Réduire" : "Agrandir"}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted/40 transition-all duration-200 text-muted-foreground hover:text-foreground"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>

          {/* Resize handle */}
          {showResizeHandle && !isExpanded && (
            <div
              className={cn(
                "absolute top-0 bottom-0 w-1 cursor-col-resize group z-50",
                "hover:bg-primary/30 active:bg-primary/50 transition-colors",
                side === "right" ? "left-0" : "right-0"
              )}
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            >
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 flex items-center justify-center",
                "w-4 h-10 rounded-md",
                "bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity",
                side === "right" ? "-left-1.5" : "-right-1.5"
              )}>
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FloatingPanel;
