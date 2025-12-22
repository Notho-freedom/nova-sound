/**
 * Liste virtualisée pour de grandes collections
 * Optimise le rendu en ne rendant que les éléments visibles
 */

import { useState, useEffect, useRef, useCallback, memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export const VirtualList = memo(function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 5,
  getItemKey = (_, index) => index,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount + 2 * overscan);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Utiliser requestAnimationFrame pour performance
    requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
    });
  }, []);

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, localIndex) => {
            const globalIndex = startIndex + localIndex;
            return (
              <div
                key={getItemKey(item, globalIndex)}
                style={{ height: itemHeight }}
              >
                {renderItem(item, globalIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) => JSX.Element;

/**
 * Grille virtualisée pour les albums/tracks
 */
interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  gap?: number;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export const VirtualGrid = memo(function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  className,
  gap = 16,
  overscan = 2,
  getItemKey = (_, index) => index,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const columns = Math.floor((containerWidth + gap) / (itemWidth + gap)) || 1;
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap) - gap;

  const visibleRowCount = Math.ceil(containerHeight / (itemHeight + gap));
  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(rows - 1, startRow + visibleRowCount + 2 * overscan);

  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length - 1, (endRow + 1) * columns - 1);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    requestAnimationFrame(() => {
      setScrollTop(e.currentTarget.scrollTop);
    });
  }, []);

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startRow * (itemHeight + gap);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, ${itemWidth}px)`,
            gap: `${gap}px`,
          }}
        >
          {visibleItems.map((item, localIndex) => {
            const globalIndex = startIndex + localIndex;
            return (
              <div key={getItemKey(item, globalIndex)}>
                {renderItem(item, globalIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}) as <T>(props: VirtualGridProps<T>) => JSX.Element;
