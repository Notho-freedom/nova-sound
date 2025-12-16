import { Play, Sparkles, Crown, Zap, Shield, Cloud, Music, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useState } from "react";

interface FeatureCard {
  icon: typeof Music;
  title: string;
  description: string;
  highlight?: boolean;
}

interface ProductShowcaseProps {
  className?: string;
  variant?: "default" | "compact" | "grid";
}

const features: FeatureCard[] = [
  {
    icon: Music,
    title: "Bibliothèque Illimitée",
    description: "Organisez et gérez votre collection musicale complète avec une interface intuitive et puissante.",
    highlight: true,
  },
  {
    icon: Cloud,
    title: "Synchronisation Cloud",
    description: "Accédez à votre musique depuis n'importe quel appareil avec la synchronisation automatique.",
    highlight: true,
  },
  {
    icon: Zap,
    title: "Performance Ultra-Rapide",
    description: "Lecture fluide et instantanée grâce à une architecture optimisée pour la vitesse.",
  },
  {
    icon: Shield,
    title: "Sécurité Avancée",
    description: "Vos données sont protégées avec un chiffrement de niveau entreprise.",
  },
  {
    icon: TrendingUp,
    title: "Recommandations Intelligentes",
    description: "Découvrez de nouvelles musiques adaptées à vos goûts avec l'IA.",
  },
  {
    icon: Sparkles,
    title: "Interface Moderne",
    description: "Une expérience utilisateur exceptionnelle avec un design soigné et des animations fluides.",
  },
];

export const ProductShowcase = ({ className, variant = "default" }: ProductShowcaseProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (variant === "compact") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {features.slice(0, 6).map((feature, index) => (
          <div
            key={index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={cn(
              "group relative overflow-hidden rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6 transition-all duration-300 ease-out",
              "hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02]",
              feature.highlight && "bg-primary/5 border-primary/20",
              hoveredIndex === index && "ring-2 ring-primary/50"
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300",
                feature.highlight 
                  ? "bg-primary/20 text-primary" 
                  : "bg-muted/50 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
              )}>
                <feature.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
        {features.map((feature, index) => (
          <div
            key={index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={cn(
              "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border border-border/50 p-8 transition-all duration-500 ease-out",
              "hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.03]",
              feature.highlight && "from-primary/10 to-primary/5 border-primary/30 shadow-lg shadow-primary/10",
              hoveredIndex === index && "ring-2 ring-primary/50"
            )}
          >
            {/* Animated background gradient */}
            <div className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
              "bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
            )} />
            
            <div className="relative z-10">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500",
                feature.highlight 
                  ? "bg-primary/20 text-primary shadow-lg shadow-primary/20" 
                  : "bg-muted/50 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:scale-110 group-hover:rotate-3"
              )}>
                <feature.icon className="w-8 h-8" />
              </div>
              <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default variant - Carousel
  return (
    <div className={cn("relative", className)}>
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {features.map((feature, index) => (
            <CarouselItem key={index} className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3">
              <div
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border border-border/50 p-8 h-full transition-all duration-500 ease-out",
                  "hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.02]",
                  feature.highlight && "from-primary/10 to-primary/5 border-primary/30 shadow-lg shadow-primary/10",
                  hoveredIndex === index && "ring-2 ring-primary/50"
                )}
              >
                {/* Animated background gradient */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  "bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
                )} />
                
                <div className="relative z-10">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500",
                    feature.highlight 
                      ? "bg-primary/20 text-primary shadow-lg shadow-primary/20" 
                      : "bg-muted/50 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:scale-110 group-hover:rotate-3"
                  )}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 md:-left-12" />
        <CarouselNext className="right-0 md:-right-12" />
      </Carousel>
    </div>
  );
};
