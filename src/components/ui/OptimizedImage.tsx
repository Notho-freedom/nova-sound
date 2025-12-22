/**
 * Composant d'image optimisé avec lazy loading et cache
 */

import { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  placeholder?: 'blur' | 'skeleton';
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const DEFAULT_FALLBACK = '/placeholder.svg';

// Cache global des images préchargées
const imageCache = new Set<string>();

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className,
  fallback = DEFAULT_FALLBACK,
  placeholder = 'skeleton',
  priority = false,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(() => imageCache.has(src));
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (priority || loaded) return;

    const img = imgRef.current;
    if (!img) return;

    // Utiliser IntersectionObserver pour lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          img.src = src;
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, priority, loaded]);

  const handleLoad = () => {
    setLoaded(true);
    imageCache.add(src);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  const finalSrc = error ? fallback : (priority ? src : (loaded ? src : ''));

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Placeholder skeleton */}
      {!loaded && placeholder === 'skeleton' && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      <img
        ref={imgRef}
        src={finalSrc}
        alt={alt}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
});

/**
 * Précharge une liste d'images en arrière-plan
 */
export function preloadImages(urls: string[]): void {
  urls.forEach(url => {
    if (imageCache.has(url)) return;
    
    const img = new Image();
    img.onload = () => imageCache.add(url);
    img.src = url;
  });
}

/**
 * Efface le cache d'images
 */
export function clearImageCache(): void {
  imageCache.clear();
}
