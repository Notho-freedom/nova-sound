"use client";

import { useEffect, useRef } from 'react';
import { useAudioVibes, type AudioVibesData } from '@/hooks/useAudioVibes';
import { cn } from '@/lib/utils';

export interface VibrantUIProps {
  audioElement: HTMLAudioElement | HTMLVideoElement | null;
  targetSelector?: string; // Sélecteur CSS de l'élément à animer
  intensity?: number; // Intensité des effets (0-1)
  enableBassPulse?: boolean; // Pulse sur les basses
  enableEnergyGlow?: boolean; // Glow basé sur l'énergie
  enableShake?: boolean; // Shake sur les pics
  className?: string;
  children?: React.ReactNode;
}

/**
 * Composant qui applique des effets visuels vibrants basés sur l'audio
 * Transforme l'UI en réaction aux vibrations audio
 */
export function VibrantUI({
  audioElement,
  targetSelector,
  intensity = 1,
  enableBassPulse = true,
  enableEnergyGlow = true,
  enableShake = true,
  className,
  children,
}: VibrantUIProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const originalTransformRef = useRef<string>('');
  const originalFilterRef = useRef<string>('');

  useAudioVibes(audioElement, {
    onAnalyze: (data: AudioVibesData) => {
      if (!containerRef.current) return;

      const element = targetSelector
        ? document.querySelector(targetSelector)
        : containerRef.current;

      if (!element || !(element instanceof HTMLElement)) return;

      // Sauvegarder les styles originaux
      if (!originalTransformRef.current) {
        originalTransformRef.current = element.style.transform || '';
        originalFilterRef.current = element.style.filter || '';
      }

      // Effet de pulse sur les basses
      if (enableBassPulse) {
        const bassScale = 1 + (data.bass / 255) * 0.1 * intensity;
        const currentTransform = originalTransformRef.current;
        element.style.transform = `${currentTransform} scale(${bassScale})`;
      }

      // Effet de glow basé sur l'énergie
      if (enableEnergyGlow) {
        const brightness = 1 + (data.energy / 255) * 0.3 * intensity;
        const glowIntensity = (data.energy / 255) * 20 * intensity;
        element.style.filter = `${originalFilterRef.current} brightness(${brightness}) drop-shadow(0 0 ${glowIntensity}px rgba(59, 130, 246, 0.5))`;
      }

      // Effet de shake sur les pics
      if (enableShake && data.peak > 200) {
        const shakeIntensity = ((data.peak - 200) / 55) * 2 * intensity;
        const shakeX = Math.sin(Date.now() / 10) * shakeIntensity;
        const shakeY = Math.cos(Date.now() / 15) * shakeIntensity;
        const currentTransform = element.style.transform || '';
        element.style.transform = `${currentTransform} translate(${shakeX}px, ${shakeY}px)`;
      }
    },
  });

  // Nettoyage des styles
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        const element = targetSelector
          ? document.querySelector(targetSelector)
          : containerRef.current;

        if (element && element instanceof HTMLElement) {
          element.style.transform = originalTransformRef.current;
          element.style.filter = originalFilterRef.current;
        }
      }
    };
  }, [targetSelector]);

  if (children) {
    return (
      <div ref={containerRef} className={cn(className)}>
        {children}
      </div>
    );
  }

  return null;
}

/**
 * Composant spécialisé pour créer un effet de "subwoofer" sur les basses
 */
export function BassPulse({
  audioElement,
  intensity = 1,
  className,
  children,
}: {
  audioElement: HTMLAudioElement | HTMLVideoElement | null;
  intensity?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useAudioVibes(audioElement, {
    enableBassFilter: true,
    bassFrequency: 100,
    onAnalyze: (data) => {
      if (!containerRef.current) return;

      // Effet de vibration physique sur les basses
      const vibration = Math.max(0, data.bass - 100);
      const pulseScale = 1 + (vibration / 155) * 0.15 * intensity;
      const translateY = Math.sin(Date.now() / 30) * vibration * 0.1 * intensity;

      containerRef.current.style.transform = `scale(${pulseScale}) translateY(${translateY}px)`;
      containerRef.current.style.transition = 'transform 0.05s ease-out';
    },
  });

  return (
    <div ref={containerRef} className={cn(className)}>
      {children}
    </div>
  );
}

/**
 * Composant pour créer un effet de particules basé sur l'audio
 */
export function AudioParticles({
  audioElement,
  particleCount = 50,
  className,
}: {
  audioElement: HTMLAudioElement | HTMLVideoElement | null;
  particleCount?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useAudioVibes(audioElement, {
    onAnalyze: (data) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Créer des particules basées sur les fréquences
      const particles = Math.min(particleCount, data.frequency.length);

      for (let i = 0; i < particles; i++) {
        const freqValue = data.frequency[i] || 0;
        const intensity = freqValue / 255;

        if (intensity > 0.1) {
          const x = (i / particles) * width;
          const y = height / 2;
          const size = intensity * 10;
          const color = i < particles / 3
            ? `rgba(239, 68, 68, ${intensity})` // Rouge pour basses
            : i < (particles * 2) / 3
            ? `rgba(59, 130, 246, ${intensity})` // Bleu pour médiums
            : `rgba(139, 92, 246, ${intensity})`; // Violet pour aigus

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  });

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-full', className)}
      width={800}
      height={200}
    />
  );
}

