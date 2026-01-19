/**
 * Performance measurement hook for UI rendering metrics
 * Tracks Time to Interactive (TTI), First Contentful Paint (FCP), etc
 */

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  bootTime: number; // Time from app start to HomeView render
  workerInitTime: number; // Time for first worker result
  statsLoadTime: number; // Time for stats calculation
  genresLoadTime: number; // Time for genres calculation
}

export function usePerformanceMonitoring(componentName: string) {
  const metricsRef = useRef<Partial<PerformanceMetrics>>({});
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    const now = performance.now();
    const bootTime = now - startTimeRef.current;
    
    // Log to performance API
    try {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              console.log(`[Performance] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
            }
          }
        });
        
        observer.observe({ entryTypes: ['measure', 'mark'] });

        // Create marks for navigation timing
        performance.mark(`${componentName}-render-start`);
        
        return () => observer.disconnect();
      }
    } catch (err) {
      console.debug('[Performance] Observer not available:', err);
    }
  }, [componentName]);

  const logMetric = (name: string, value: number) => {
    const msg = `[Performance] ${componentName}.${name}: ${value.toFixed(2)}ms`;
    console.log(msg);
    
    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: `${componentName}_${name}`,
        metric_value: Math.round(value),
      });
    }
  };

  return { logMetric, metricsRef };
}

/**
 * Helper to measure hook initialization time
 * Usage: const { duration } = measureHookInit(() => useExpensiveHook());
 */
export function measureHookInit<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Global performance summary logged to console
 * Call this after app is fully loaded
 */
export function logPerformanceSummary() {
  if (typeof window === 'undefined') return;

  try {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!perfData) return;

    console.group('📊 App Performance Summary');
    console.log(`DNS Lookup: ${(perfData.domainLookupEnd - perfData.domainLookupStart).toFixed(2)}ms`);
    console.log(`TCP Connection: ${(perfData.connectEnd - perfData.connectStart).toFixed(2)}ms`);
    console.log(`DOM Interactive: ${(perfData.domInteractive - perfData.fetchStart).toFixed(2)}ms`);
    console.log(`DOM Content Loaded: ${(perfData.domContentLoadedEventEnd - perfData.fetchStart).toFixed(2)}ms`);
    console.log(`Total Load Time: ${(perfData.loadEventEnd - perfData.fetchStart).toFixed(2)}ms`);
    console.groupEnd();
  } catch (err) {
    console.debug('[Performance] Summary not available:', err);
  }
}
