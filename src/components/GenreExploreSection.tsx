"use client";

import { useCallback, useMemo, memo } from "react";
import { Disc, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpIcon } from "@/components/ui/HelpButton";
import { ContentCarousel } from "@/components/ui/ContentCarousel";
import { GenreCard } from "@/components/ui/GenreCard";

export interface GenreExploreItem {
  name: string;
  trackCount: number;
}

interface GenreExploreSectionProps {
  title?: string;
  subtitle?: string;
  genres: GenreExploreItem[];
  onSelectGenre: (genreName: string) => void;
  onViewAll?: () => void;
  showHelp?: boolean;
}

// Memoized genre card wrapper to prevent re-renders
const MemoizedGenreCard = memo(({ 
  genre, 
  onSelect 
}: { 
  genre: GenreExploreItem; 
  onSelect: (name: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onSelect(genre.name);
  }, [genre.name, onSelect]);

  return (
    <GenreCard
      name={genre.name}
      trackCount={genre.trackCount}
      onClick={handleClick}
      className="flex-shrink-0 snap-start w-40"
    />
  );
});
MemoizedGenreCard.displayName = "MemoizedGenreCard";

export function GenreExploreSection({
  title = "Explorer par genre",
  subtitle,
  genres,
  onSelectGenre,
  onViewAll,
  showHelp = true,
}: GenreExploreSectionProps) {
  // Memoize the action button
  const actionButton = useMemo(() => {
    if (!onViewAll || genres.length <= 8) return null;
    return (
      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={onViewAll}>
        Voir tout
        <ChevronRight className="w-4 h-4" />
      </Button>
    );
  }, [onViewAll, genres.length]);

  if (genres.length === 0) return null;

  return (
    <section className="pl-6 pr-6 overflow-hidden max-w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {showHelp && (
          <HelpIcon
            title="Genres"
            description="Explorez votre musique par genre. Cliquez sur un genre pour voir tous les titres de cette catégorie."
          />
        )}
      </div>
      <ContentCarousel
        title={title}
        subtitle={subtitle ?? `${genres.length} genres disponibles`}
        icon={<Disc className="w-5 h-5 text-secondary" />}
        action={actionButton}
      >
        {genres.map((genre) => (
          <MemoizedGenreCard
            key={genre.name}
            genre={genre}
            onSelect={onSelectGenre}
          />
        ))}
      </ContentCarousel>
    </section>
  );
}
