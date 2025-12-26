/**
 * Composant UI pour afficher une image d'artiste
 * Avec fallback automatique et preview
 */

import { useState, useEffect } from 'react';
import { User, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useArtistImage } from '@/hooks/useArtistImage';
import type { ArtistImage } from '@/types/artist-image';

interface ArtistImageProps {
  artistName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackIcon?: React.ReactNode;
  showLoading?: boolean;
  onImageLoad?: (image: ArtistImage | null) => void;
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
};

export function ArtistImage({
  artistName,
  className,
  size = 'md',
  fallbackIcon,
  showLoading = true,
  onImageLoad,
}: ArtistImageProps) {
  const { image, isLoading, isError } = useArtistImage({
    query: artistName,
    enabled: !!artistName,
  });

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (image && onImageLoad) {
      onImageLoad(image);
    }
  }, [image, onImageLoad]);

  const displayImage = image && !imageError;
  const showFallback = !displayImage && (!isLoading || !showLoading);

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden',
        'bg-gradient-to-br from-primary/20 to-secondary/20',
        'flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {/* Image chargée */}
      {displayImage && (
        <img
          src={image.url}
          alt={artistName}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            imageLoaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
          loading="lazy"
        />
      )}

      {/* Loading */}
      {isLoading && showLoading && !displayImage && (
        <Skeleton className="w-full h-full rounded-full" />
      )}

      {/* Fallback */}
      {showFallback && (
        <div className="w-full h-full flex items-center justify-center">
          {fallbackIcon || (
            <User className={cn('text-primary/50', {
              'w-8 h-8': size === 'sm',
              'w-10 h-10': size === 'md',
              'w-16 h-16': size === 'lg',
              'w-24 h-24': size === 'xl',
            })} />
          )}
        </div>
      )}

      {/* Erreur silencieuse - on affiche juste le fallback */}
      {isError && !displayImage && showFallback && null}
    </div>
  );
}

/**
 * Composant pour afficher plusieurs images (carrousel)
 */
interface ArtistImageCarouselProps {
  artistName: string;
  limit?: number;
  className?: string;
  onImageSelect?: (image: ArtistImage) => void;
}

export function ArtistImageCarousel({
  artistName,
  limit = 5,
  className,
  onImageSelect,
}: ArtistImageCarouselProps) {
  const { images, isLoading } = useArtistImage({
    query: artistName,
    limit,
    enabled: !!artistName,
  });

  if (isLoading) {
    return (
      <div className={cn('flex gap-2', className)}>
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className="w-20 h-20 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <ImageIcon className="w-4 h-4" />
        <span className="text-sm">Aucune image disponible</span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 overflow-x-auto', className)}>
      {images.map((image, index) => (
        <button
          key={index}
          onClick={() => onImageSelect?.(image)}
          className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 hover:scale-105 transition-transform"
        >
          <img
            src={image.thumbnailUrl || image.url}
            alt={`${artistName} - Image ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

