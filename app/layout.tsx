'use client';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { FirebaseProvider } from "@/components/FirebaseProvider";
import { ProUploadCtaModal } from "@/components/ProUploadCtaModal";
import { I18nProvider, useI18n } from "@/i18n";
import { initIdb } from "@/lib/idb-cache";
import "./globals.css";

if (typeof window !== "undefined" && typeof performance !== "undefined" && typeof performance.measure === "function") {
  const originalMeasure = performance.measure.bind(performance);
  const safeMeasure = (...args: Parameters<Performance["measure"]>) => {
    try {
      return originalMeasure(...args);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("negative time stamp")) {
        return;
      }
      throw error;
    }
  };

  performance.measure = safeMeasure as Performance["measure"];
}

const queryClient = new QueryClient();

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { locale, t } = useI18n();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof performance === "undefined" || typeof performance.measure !== "function") {
      return;
    }

    const originalMeasure = performance.measure.bind(performance);
    return () => {
      performance.measure = originalMeasure as Performance["measure"];
    };
  }, []);

  useEffect(() => {
    // Register service worker for PWA cache/offline and init IndexedDB cache
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Avoid file:// (electron shell) or non-HTTPS
      const protocol = window.location.protocol;
      if (protocol === "https:" || protocol === "http:") {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.warn("[SW] registration failed", err));
      }
    }
    initIdb().catch(() => undefined);
  }, []);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <title>{t("appTitle")}</title>
        <meta name="description" content={t("appDescription")} />
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
          <div className="layout-hidden">{children}</div>
        )}
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <LayoutContent>{children}</LayoutContent>
    </I18nProvider>
  );
}

