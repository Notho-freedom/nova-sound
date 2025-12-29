/**
 * Nexus App - Performance Optimization Configuration
 * Best practices for responsive, accessible, performant UI
 */

// Export critical performance metrics to monitor
export const PERFORMANCE_TARGETS = {
  // Core Web Vitals
  LCP: 2500,           // Largest Contentful Paint (ms)
  FID: 100,            // First Input Delay (ms)
  CLS: 0.1,            // Cumulative Layout Shift
  
  // Navigation timing
  DNS_LOOKUP: 500,     // DNS lookup time (ms)
  TCP_CONNECT: 1000,   // TCP connection time (ms)
  FIRST_BYTE: 1500,    // Time to first byte (ms)
  
  // Rendering
  FIRST_PAINT: 1000,   // First paint (ms)
  INTERACTIVE: 2500,   // Time to interactive (ms)
  
  // Image optimization
  HERO_IMAGE_SIZE: 150000,      // 150KB max
  THUMBNAIL_SIZE: 15000,        // 15KB max
  PRELOAD_THRESHOLD: 2000,      // Preload when 2s remains
};

// Responsive breakpoint configuration
export const BREAKPOINTS = {
  xs: 0,      // Mobile extra small
  sm: 640,    // Mobile small (iPhone SE)
  md: 768,    // Tablet (iPad)
  lg: 1024,   // Tablet large (iPad Pro)
  xl: 1280,   // Desktop
  '2xl': 1536, // Desktop large
} as const;

// Touch-friendly sizing
export const TOUCH_TARGETS = {
  MIN: 44,    // WCAG minimum
  PREFERRED: 48, // Apple HIG
  SPACING: 8, // Between targets
} as const;

// Animation configuration
export const ANIMATIONS = {
  MENU_OPEN: 150,     // ms
  MENU_CLOSE: 220,    // ms
  OVERLAY_APPEAR: 200, // ms
  CAROUSEL_TRANSITION: 300, // ms
  HOVER_FEEDBACK: 150, // ms
} as const;

// Accessibility configuration
export const A11Y = {
  FOCUS_RING_WIDTH: 2,
  FOCUS_RING_OFFSET: 2,
  MIN_CONTRAST_RATIO: 4.5, // WCAG AA for normal text
  ENHANCED_CONTRAST_RATIO: 7, // WCAG AAA for normal text
} as const;

// Network optimization
export const NETWORK = {
  // Request debounce delays
  SEARCH_DEBOUNCE: 300,     // ms
  SYNC_DEBOUNCE: 500,       // ms
  RESIZE_DEBOUNCE: 100,     // ms
  SCROLL_DEBOUNCE: 100,     // ms
  
  // Caching strategies
  IMAGE_CACHE_MAX: 50,      // Max cached images
  SEARCH_CACHE_MAX: 50,     // Max cached searches
  QUERY_TIMEOUT: 5000,      // ms
} as const;

// Device-specific optimizations
export const DEVICE_OPTIMIZATION = {
  // iPhone sizes
  IPHONE_SE: { width: 375, height: 812, dpr: 2 },
  IPHONE_12_13: { width: 390, height: 844, dpr: 3 },
  IPHONE_14_15: { width: 393, height: 852, dpr: 3 },
  
  // iPad sizes
  IPAD_MINI: { width: 768, height: 1024, dpr: 2 },
  IPAD_AIR: { width: 820, height: 1180, dpr: 2 },
  IPAD_PRO: { width: 1024, height: 1366, dpr: 2 },
  
  // Desktop
  DESKTOP_MIN: { width: 1280, height: 720, dpr: 1 },
  DESKTOP_4K: { width: 3840, height: 2160, dpr: 2 },
} as const;

// Image optimization presets
export const IMAGE_PRESETS = {
  HERO: {
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1920px',
    quality: 85,
    formats: ['webp', 'jpg'],
  },
  THUMBNAIL: {
    sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px',
    quality: 75,
    formats: ['webp', 'jpg'],
  },
  AVATAR: {
    sizes: '64px',
    quality: 80,
    formats: ['webp', 'jpg'],
  },
} as const;

// Color contrast checker (WCAG)
export const CONTRAST_RATIOS = {
  PRIMARY_ON_BACKGROUND: 6.5,    // AAA
  SECONDARY_ON_BACKGROUND: 5.2,  // AA
  MUTED_ON_BACKGROUND: 4.8,      // AA
} as const;
