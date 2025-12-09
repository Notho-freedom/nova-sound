'use client';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
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
      </head>
      <body>
        {mounted ? (
          <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {children}
              </TooltipProvider>
            </ThemeProvider>
          </QueryClientProvider>
        ) : (
          <div style={{ display: 'none' }}>{children}</div>
        )}
      </body>
    </html>
  );
}

