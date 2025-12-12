import { useState, useEffect } from "react";
import { 
  Play, 
  Zap, 
  Headphones, 
  Music2, 
  Sparkles, 
  Download, 
  ChevronRight,
  Monitor,
  Smartphone,
  Volume2,
  Radio,
  ListMusic,
  Heart,
  Globe,
  Shield,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Headphones className="w-6 h-6" />,
    title: "Audio Hi-Fi",
    description: "Qualité audio sans perte avec support FLAC, WAV et formats haute résolution"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Visualiseur Dynamique",
    description: "Effets visuels réactifs à la musique en temps réel"
  },
  {
    icon: <Radio className="w-6 h-6" />,
    title: "Égaliseur Pro",
    description: "10 bandes d'égalisation avec préréglages personnalisables"
  },
  {
    icon: <ListMusic className="w-6 h-6" />,
    title: "Playlists Intelligentes",
    description: "Organisation automatique par genre, mood et énergie"
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: "Bibliothèque Locale",
    description: "Scannez et organisez toute votre collection musicale"
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: "Sync Cloud",
    description: "Synchronisez vos préférences sur tous vos appareils"
  }
];

const stats = [
  { value: "192kHz", label: "Sample Rate Max" },
  { value: "32-bit", label: "Profondeur Audio" },
  { value: "10", label: "Bandes EQ" },
  { value: "∞", label: "Playlists" }
];

export const LandingPage = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-wider">NEXUS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalités
            </a>
            <a href="#download" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Télécharger
            </a>
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              À propos
            </a>
          </div>

          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Download className="w-4 h-4" />
            Télécharger
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse"
            style={{ transform: `translateY(${scrollY * 0.1}px)` }}
          />
          <div 
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/30 rounded-full blur-[100px] animate-pulse"
            style={{ animationDelay: "1s", transform: `translateY(${-scrollY * 0.05}px)` }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
          
          {/* Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), 
                               linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px"
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Version 2.0 disponible</span>
          </div>

          {/* Main Title */}
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              L'expérience
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              musicale ultime
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Lecteur de musique nouvelle génération avec visualiseur dynamique, 
            égaliseur professionnel et interface futuriste.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8 py-6 text-lg"
            >
              <Download className="w-5 h-5" />
              Télécharger Gratuitement
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 px-8 py-6 text-lg border-border hover:bg-accent/10"
            >
              <Play className="w-5 h-5" />
              Voir la Démo
            </Button>
          </div>

          {/* App Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-2xl opacity-50" />
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl">
              <div className="aspect-video bg-gradient-to-br from-background to-card flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Music2 className="w-16 h-16 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Aperçu de l'application NEXUS</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="font-display text-3xl md:text-4xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Fonctionnalités
              <span className="text-primary"> Avancées</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Conçu pour les audiophiles exigeants qui recherchent une expérience 
              d'écoute exceptionnelle
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={cn(
                  "group p-6 rounded-2xl border transition-all duration-500 cursor-pointer",
                  activeFeature === index
                    ? "bg-primary/10 border-primary/50 scale-[1.02]"
                    : "bg-card/50 border-border hover:border-primary/30 hover:bg-card"
                )}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                  activeFeature === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                )}>
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-24 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                Disponible sur
                <span className="text-primary"> toutes les plateformes</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                NEXUS est optimisé pour offrir la meilleure expérience sur chaque plateforme,
                avec une interface native et des performances optimales.
              </p>

              <div className="space-y-4">
                {[
                  { icon: <Monitor className="w-5 h-5" />, name: "Windows", version: "10, 11" },
                  { icon: <Monitor className="w-5 h-5" />, name: "macOS", version: "12+" },
                  { icon: <Monitor className="w-5 h-5" />, name: "Linux", version: "Ubuntu, Fedora, Arch" },
                ].map((platform, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {platform.icon}
                    </div>
                    <div>
                      <div className="font-semibold">{platform.name}</div>
                      <div className="text-sm text-muted-foreground">{platform.version}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl blur-2xl" />
              <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-card to-background border border-border flex items-center justify-center">
                <div className="text-center">
                  <Volume2 className="w-24 h-24 text-primary mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Interface native</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-sm text-accent">100% Gratuit • Open Source</span>
          </div>

          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Prêt à commencer?
          </h2>
          <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
            Téléchargez NEXUS gratuitement et découvrez une nouvelle façon 
            d'écouter votre musique préférée.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-10 py-7 text-lg"
            >
              <Download className="w-5 h-5" />
              Télécharger pour Windows
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="gap-2 px-10 py-7 text-lg"
            >
              Autres plateformes
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            Version 2.0.0 • 85 MB • Requiert Windows 10 ou supérieur
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold mb-4">
              Ce qu'ils en disent
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Alex M.", role: "Producteur", text: "L'interface la plus belle que j'ai vue pour un lecteur de musique. Le visualiseur est incroyable." },
              { name: "Sophie L.", role: "DJ", text: "L'égaliseur 10 bandes est parfait pour mes sessions. La qualité audio est irréprochable." },
              { name: "Thomas K.", role: "Audiophile", text: "Enfin un lecteur qui supporte nativement le FLAC et les formats haute résolution. Bravo!" }
            ].map((testimonial, index) => (
              <div key={index} className="p-6 rounded-2xl bg-background border border-border">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">"{testimonial.text}"</p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-display text-xl font-bold tracking-wider">NEXUS</span>
              </div>
              <p className="text-muted-foreground max-w-md">
                Lecteur de musique nouvelle génération conçu pour les audiophiles 
                qui exigent le meilleur de leur expérience d'écoute.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Téléchargements</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Roadmap</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 NEXUS. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-foreground transition-colors">Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
