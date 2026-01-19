/**
 * Debug utilities for performance monitoring
 * Add this to window for easy console access
 */

interface PerformanceDebugData {
  bootStartTime: number;
  metrics: Record<string, number>;
}

const debugData: PerformanceDebugData = {
  bootStartTime: performance.now(),
  metrics: {},
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__PERF_DEBUG = {
    /**
     * Log current performance metrics
     * Usage: window.__PERF_DEBUG.logMetrics()
     */
    logMetrics: () => {
      const now = performance.now();
      const bootTime = now - debugData.bootStartTime;
      
      console.group('📊 Performance Metrics');
      console.log(`Total Boot Time: ${bootTime.toFixed(2)}ms`);
      
      // Navigation timing
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (perfData) {
        console.log(`TTFB (Time to First Byte): ${(perfData.responseStart - perfData.fetchStart).toFixed(2)}ms`);
        console.log(`DOM Interactive: ${(perfData.domInteractive - perfData.fetchStart).toFixed(2)}ms`);
        console.log(`DOM Content Loaded: ${(perfData.domContentLoadedEventEnd - perfData.fetchStart).toFixed(2)}ms`);
      }
      
      // Paint timing
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        console.log(`${entry.name}: ${entry.startTime.toFixed(2)}ms`);
      });
      
      // Custom metrics
      Object.entries(debugData.metrics).forEach(([name, value]) => {
        console.log(`${name}: ${value.toFixed(2)}ms`);
      });
      
      console.groupEnd();
    },

    /**
     * Mark a custom metric
     * Usage: window.__PERF_DEBUG.recordMetric('hook-init', startTime)
     */
    recordMetric: (name: string, startTime: number) => {
      const duration = performance.now() - startTime;
      debugData.metrics[name] = duration;
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
    },

    /**
     * Get all recorded metrics as JSON
     */
    getMetrics: () => {
      return {
        bootTime: performance.now() - debugData.bootStartTime,
        custom: debugData.metrics,
      };
    },

    /**
     * Compare before/after optimization
     * Usage: window.__PERF_DEBUG.exportMetricsCSV()
     */
    exportMetricsCSV: () => {
      const metrics = (window as any).__PERF_DEBUG.getMetrics();
      const csv = `Metric,Value (ms)\n${
        Object.entries(metrics.custom)
          .map(([k, v]) => `${k},${(v as number).toFixed(2)}`)
          .join('\n')
      }`;
      console.log('Copy this CSV:\n' + csv);
      return csv;
    },
  };

  // Auto-log metrics when app hydration completes
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const start = performance.now();
      const tick = (now: number) => {
        if (now - start >= 500) {
          console.log('🚀 App Ready. Run: window.__PERF_DEBUG.logMetrics()');
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }
}

export { debugData };
