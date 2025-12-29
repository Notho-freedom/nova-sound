/**
 * Nexus App - Global Accessibility Standards
 * WCAG 2.1 AA compliance + enhanced best practices
 */

export const ACCESSIBILITY_STANDARDS = {
  // Color contrast ratios (WCAG AA/AAA)
  NORMAL_TEXT_AA: 4.5,
  NORMAL_TEXT_AAA: 7,
  LARGE_TEXT_AA: 3,
  LARGE_TEXT_AAA: 4.5,
  GRAPHICS_COMPONENTS_AA: 3,
  GRAPHICS_COMPONENTS_AAA: 4.5,

  // Timing
  ANIMATION_DURATION_MS: 300,
  FOCUS_VISIBLE_DELAY_MS: 0, // Immediate
  TOAST_NOTIFICATION_DURATION_MS: 5000,

  // Touch targets (WCAG 2.5.5)
  MIN_TOUCH_TARGET_SIZE: 44, // pixels
  PREFERRED_TOUCH_TARGET_SIZE: 48,
  MIN_SPACING_BETWEEN_TARGETS: 8, // pixels

  // Focus indicators
  FOCUS_OUTLINE_WIDTH: 2, // pixels
  FOCUS_OUTLINE_OFFSET: 2, // pixels
  
  // Text sizing
  MIN_FONT_SIZE: 12, // pixels
  BASE_FONT_SIZE: 16, // pixels
  LINE_HEIGHT_RATIO: 1.5, // Minimum for body text
} as const;

// ARIA labels and descriptions for common components
export const ARIA_LABELS = {
  NAVIGATION: {
    MENU_TRIGGER: (label: string) => `Menu ${label} - Toggle menu`,
    MENU_EXPANDED: (label: string, expanded: boolean) => `Menu ${label} is ${expanded ? 'open' : 'closed'}`,
    SEARCH_INPUT: 'Search music, artists, albums',
    SEARCH_RESULTS: (count: number) => `Search results: ${count} items found`,
    PREV_BUTTON: 'Previous slide',
    NEXT_BUTTON: 'Next slide',
  },
  STATUS: {
    LOADING: 'Loading...',
    SYNCING: 'Synchronizing with cloud...',
    ERROR: 'Error occurred',
    SUCCESS: 'Operation completed successfully',
  },
  CONTROLS: {
    PLAY: 'Play',
    PAUSE: 'Pause',
    SHUFFLE: 'Shuffle',
    REPEAT: 'Repeat',
    VOLUME: 'Volume control',
  },
} as const;

// Keyboard shortcuts for power users
export const KEYBOARD_SHORTCUTS = {
  // Navigation
  'Escape': 'Close menu/dialog',
  'Enter': 'Activate menu item or search',
  'Tab': 'Navigate forward',
  'Shift+Tab': 'Navigate backward',
  'ArrowLeft': 'Previous menu or carousel',
  'ArrowRight': 'Next menu or carousel',
  'ArrowUp': 'Scroll up in menu',
  'ArrowDown': 'Scroll down in menu',

  // Global
  'Ctrl+K': 'Focus search',
  'Ctrl+/': 'Show keyboard shortcuts',
  'Ctrl+Q': 'Logout',

  // Media
  'Space': 'Play/Pause',
  'M': 'Mute/Unmute',
  '<': 'Previous track',
  '>': 'Next track',
} as const;

// Screen reader announcements
export const SR_ANNOUNCEMENTS = {
  MENU_OPENED: (menuName: string) => `${menuName} menu opened`,
  MENU_CLOSED: (menuName: string) => `${menuName} menu closed`,
  SEARCH_RESULTS: (count: number) => `${count} results found, use arrow keys to navigate`,
  SYNC_STARTED: 'Synchronization started',
  SYNC_COMPLETE: 'Synchronization complete',
  SYNC_ERROR: 'Synchronization failed, please try again',
  CAROUSEL_SLIDE: (current: number, total: number) => `Slide ${current} of ${total}`,
} as const;

// Focus management configuration
export const FOCUS_MANAGEMENT = {
  // Auto-focus first interactive element
  AUTO_FOCUS_ON_OPEN: true,
  
  // Return focus to trigger on close
  RESTORE_FOCUS_ON_CLOSE: true,
  
  // Focus trap on modals/dropdowns
  FOCUS_TRAP_ENABLED: true,
  
  // Skip to main content link
  SKIP_TO_MAIN_ENABLED: true,
} as const;

// Testing utilities
export const A11Y_TESTING = {
  // Lighthouse accessibility threshold
  LIGHTHOUSE_MIN_SCORE: 95,
  
  // axe-core violation threshold
  MAX_VIOLATIONS: 0,
  
  // WAVE errors threshold
  MAX_WAVE_ERRORS: 0,
  
  // Color contrast check
  CHECK_COLOR_CONTRAST: true,
} as const;
