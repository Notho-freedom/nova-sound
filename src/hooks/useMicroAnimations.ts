import { useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO-ANIMATIONS HOOK
// Provides reusable animation utilities for Vision Pro interactive elements
// ═══════════════════════════════════════════════════════════════════════════════

export interface MicroAnimationConfig {
  scale?: number;
  duration?: number;
  easing?: string;
}

export interface RippleConfig {
  color?: string;
  duration?: number;
  size?: number;
}

export function useMicroAnimations() {
  const rippleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Magnetic hover effect - element follows cursor slightly
  const magneticProps = useCallback((strength: number = 0.15) => ({
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'translate(0, 0)';
    },
  }), []);

  // Tilt effect on hover - 3D perspective tilt
  const tiltProps = useCallback((maxTilt: number = 10) => ({
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const rotateX = (0.5 - y) * maxTilt;
      const rotateY = (x - 0.5) * maxTilt;
      
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    },
  }), []);

  // Ripple effect on click
  const createRipple = useCallback((
    e: React.MouseEvent<HTMLElement>,
    config: RippleConfig = {}
  ) => {
    const {
      color = 'hsl(var(--primary) / 0.3)',
      duration = 600,
      size = 100,
    } = config;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-expand ${duration}ms ease-out forwards;
      pointer-events: none;
    `;

    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);

    if (rippleTimeoutRef.current) {
      clearTimeout(rippleTimeoutRef.current);
    }

    rippleTimeoutRef.current = setTimeout(() => {
      ripple.remove();
    }, duration);
  }, []);

  // Bounce effect
  const bounceProps = useCallback(() => ({
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(0.95)';
    },
    onMouseUp: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(1.02)';
      setTimeout(() => {
        e.currentTarget.style.transform = 'scale(1)';
      }, 150);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(1)';
    },
  }), []);

  // Glow on hover
  const glowProps = useCallback((color: string = 'var(--primary)') => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.boxShadow = `0 0 30px hsl(${color} / 0.4)`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.boxShadow = '';
    },
  }), []);

  // Subtle shake animation
  const shakeElement = useCallback((el: HTMLElement, intensity: number = 5) => {
    el.style.animation = `micro-shake ${intensity * 30}ms ease-in-out`;
    setTimeout(() => {
      el.style.animation = '';
    }, intensity * 30);
  }, []);

  // Success pulse animation
  const pulseSuccess = useCallback((el: HTMLElement) => {
    el.style.animation = 'success-pulse 400ms ease-out';
    setTimeout(() => {
      el.style.animation = '';
    }, 400);
  }, []);

  return {
    magneticProps,
    tiltProps,
    bounceProps,
    glowProps,
    createRipple,
    shakeElement,
    pulseSuccess,
  };
}

// Animation presets for Framer Motion
export const motionPresets = {
  // Smooth fade in with slight upward movement
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Scale in from center
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Slide in from right
  slideInRight: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Slide in from left
  slideInLeft: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Stagger children
  staggerContainer: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  
  // Stagger child item
  staggerItem: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Hover scale
  hoverScale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  
  // Hover lift (scale + shadow)
  hoverLift: {
    whileHover: { 
      scale: 1.02, 
      y: -4,
      transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
    },
    whileTap: { 
      scale: 0.98,
      transition: { duration: 0.1 },
    },
  },
  
  // Spring bounce
  springBounce: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { 
      type: 'spring', 
      stiffness: 400, 
      damping: 25,
    },
  },
  
  // Elastic pop
  elasticPop: {
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
  
  // Smooth rotate
  smoothRotate: {
    animate: { rotate: 360 },
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'linear',
    },
  },
  
  // Pulse glow
  pulseGlow: {
    animate: {
      boxShadow: [
        '0 0 20px hsl(var(--primary) / 0.2)',
        '0 0 40px hsl(var(--primary) / 0.4)',
        '0 0 20px hsl(var(--primary) / 0.2)',
      ],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  
  // Float effect
  float: {
    animate: {
      y: [0, -8, 0],
    },
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Hover animation variants for cards
export const cardHoverVariants = {
  initial: {
    scale: 1,
    boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)',
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: '0 16px 48px hsl(0 0% 0% / 0.3)',
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
    },
  },
};

// Button hover variants
export const buttonHoverVariants = {
  initial: { scale: 1 },
  hover: { 
    scale: 1.05,
  },
  tap: { 
    scale: 0.95,
  },
};

// Icon hover variants with rotation
export const iconHoverVariants = {
  initial: { rotate: 0, scale: 1 },
  hover: { 
    rotate: 10, 
    scale: 1.1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  tap: { 
    rotate: -5, 
    scale: 0.9,
    transition: { duration: 0.1 },
  },
};

export default useMicroAnimations;
