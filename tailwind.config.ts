import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body: ["Rajdhani", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        neon: {
          cyan: "hsl(var(--neon-cyan))",
          magenta: "hsl(var(--neon-magenta))",
          purple: "hsl(var(--neon-purple))",
          blue: "hsl(var(--neon-blue))",
        },
        glass: {
          DEFAULT: "hsl(var(--glass-bg))",
          border: "hsl(var(--glass-border))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-neon": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(var(--neon-cyan) / 0.5), 0 0 40px hsl(var(--neon-cyan) / 0.3)" 
          },
          "50%": { 
            boxShadow: "0 0 30px hsl(var(--neon-cyan) / 0.7), 0 0 60px hsl(var(--neon-cyan) / 0.5)" 
          },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        // Hero animations - Steam/Spotify/Apple Music inspired
        "hero-fade": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "hero-slide": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "hero-zoom": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "stat-count": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "50%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "particle-float": {
          "0%, 100%": { 
            transform: "translateY(0) translateX(0) rotate(0deg)",
            opacity: "0.2" 
          },
          "25%": { 
            transform: "translateY(-30px) translateX(20px) rotate(90deg)",
            opacity: "0.4" 
          },
          "50%": { 
            transform: "translateY(-50px) translateX(-10px) rotate(180deg)",
            opacity: "0.3" 
          },
          "75%": { 
            transform: "translateY(-30px) translateX(-30px) rotate(270deg)",
            opacity: "0.4" 
          },
        },
        "carousel-slide-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "carousel-slide-right": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(255,255,255,0.1), inset 0 0 20px rgba(255,255,255,0.05)" 
          },
          "50%": { 
            boxShadow: "0 0 40px rgba(255,255,255,0.2), inset 0 0 30px rgba(255,255,255,0.1)" 
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "scale-pulse": "scale-pulse 2s ease-in-out infinite",
        // Hero animations
        "hero-fade": "hero-fade 1s ease-out",
        "hero-slide": "hero-slide 0.8s ease-out",
        "hero-zoom": "hero-zoom 0.6s ease-out",
        "stat-count": "stat-count 2s ease-out",
        "particle-float": "particle-float 20s infinite linear",
        "carousel-slide-left": "carousel-slide-left 0.5s ease-out",
        "carousel-slide-right": "carousel-slide-right 0.5s ease-out",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-neon": "linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--neon-magenta)))",
        "grid-pattern": "linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "50px 50px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
