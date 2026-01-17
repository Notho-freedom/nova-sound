'use client';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { FirebaseProvider } from "@/components/FirebaseProvider";
import { ProUploadCtaModal } from "@/components/ProUploadCtaModal";
import "./globals.css";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <title>NEXUS Audio System | Futuristic Music Player</title>
        <meta name="description" content="Experience music like never before with NEXUS - a futuristic audio player designed for those who seek something extraordinary and unique." />
        {/* Apply theme immediately before React mounts to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem("nexus-theme");
                  const themes = ["dark", "light", "cyberpunk", "minimal", "spotify", "apple-music", "youtube-music", "tidal", "deezer", "system"];
                  if (saved && themes.includes(saved)) {
                    const root = document.documentElement;
                    root.classList.remove(...themes);
                    if (saved === "system") {
                      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                      root.classList.add(prefersDark ? "dark" : "light");
                    } else {
                      root.classList.add(saved);
                    }
                  } else {
                    document.documentElement.classList.add("dark");
                  }
                } catch (e) {
                  document.documentElement.classList.add("dark");
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        {mounted ? (
          <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <FirebaseProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <ProUploadCtaModal />
                  {children}
                </TooltipProvider>
              </FirebaseProvider>
            </ThemeProvider>
          </QueryClientProvider>
        ) : (
          <div style={{ display: 'none' }}>{children}</div>
        )}
      </body>
    </html>
  );
}

