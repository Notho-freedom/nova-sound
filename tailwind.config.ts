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
        display: ["var(--design-font-display)", "sans-serif"],
        body: ["var(--design-font-body)", "sans-serif"],
      },
      spacing: {
        'design-xs': 'var(--design-spacing-xs)',
        'design-sm': 'var(--design-spacing-sm)',
        'design-md': 'var(--design-spacing-md)',
        'design-lg': 'var(--design-spacing-lg)',
        'design-xl': 'var(--design-spacing-xl)',
        'design-2xl': 'var(--design-spacing-2xl)',
      },
      boxShadow: {
        'design-sm': 'var(--design-shadow-sm)',
        'design-md': 'var(--design-shadow-md)',
        'design-lg': 'var(--design-shadow-lg)',
        'design-xl': 'var(--design-shadow-xl)',
        'design-inner': 'var(--design-shadow-inner)',
        'design-colored': 'var(--design-shadow-colored)',
      },
      transitionDuration: {
        'design-fast': 'var(--design-transition-fast)',
        'design-normal': 'var(--design-transition-normal)',
        'design-slow': 'var(--design-transition-slow)',
        'design-bounce': 'var(--design-transition-bounce)',
      },
      backdropBlur: {
        'design-sm': 'var(--design-blur-sm)',
        'design-md': 'var(--design-blur-md)',
        'design-lg': 'var(--design-blur-lg)',
        'design-xl': 'var(--design-blur-xl)',
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "shimmer": "shimmer 3s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "scale-pulse": "scale-pulse 2s ease-in-out infinite",
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
