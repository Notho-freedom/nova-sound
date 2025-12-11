"use client";

import { useRef, useEffect } from 'react';
import { useAudioVibes } from '@/hooks/useAudioVibes';
import { cn } from '@/lib/utils';

export interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | HTMLVideoElement | null;
  type?: 'bars' | 'waveform' | 'circular' | 'spectrum';
  height?: number;
  barWidth?: number;
  barGap?: number;
  color?: string;
  className?: string;
}

/**
 * Composant de visualisation audio avancé
 * Affiche différentes visualisations basées sur l'analyse FFT
 */
export function AudioVisualizer({
  audioElement,
  type = 'bars',
  height = 100,
  barWidth = 4,
  barGap = 2,
  color = '#3b82f6',
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const vibesData = useAudioVibes(audioElement, {
    fftSize: 2048, // Plus de détails pour la visualisation
    smoothingTimeConstant: 0.3, // Moins de lissage pour plus de réactivité
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !vibesData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      switch (type) {
        case 'bars':
          drawBars(ctx, width, height, vibesData.frequency, barWidth, barGap, color);
          break;
        case 'waveform':
          drawWaveform(ctx, width, height, vibesData.waveform, color);
          break;
        case 'circular':
          drawCircular(ctx, width, height, vibesData.frequency, color);
          break;
        case 'spectrum':
          drawSpectrum(ctx, width, height, vibesData.frequency, color);
          break;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [vibesData, type, barWidth, barGap, color]);

  const drawBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frequency: number[],
    barWidth: number,
    barGap: number,
    color: string
  ) => {
    const totalBarWidth = barWidth + barGap;
    const maxBars = Math.floor(width / totalBarWidth);
    const step = Math.max(1, Math.floor(frequency.length / maxBars));

    ctx.fillStyle = color;
    for (let i = 0; i < maxBars; i++) {
      const index = i * step;
      const value = frequency[index] || 0;
      const barHeight = (value / 255) * height;
      const x = i * totalBarWidth;
      const y = height - barHeight;

      // Gradient basé sur la fréquence
      const gradient = ctx.createLinearGradient(x, y, x, height);
      const hue = (index / frequency.length) * 360;
      gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
      gradient.addColorStop(1, color);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    waveform: number[],
    color: string
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / waveform.length;
    const centerY = height / 2;
    let x = 0;

    waveform.forEach((value, index) => {
      const v = (value - 128) / 128;
      const y = centerY + v * (height / 2);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    });

    ctx.stroke();
  };

  const drawCircular = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frequency: number[],
    color: string
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const maxBars = frequency.length;
    const angleStep = (Math.PI * 2) / maxBars;

    frequency.forEach((value, index) => {
      const angle = index * angleStep;
      const barLength = (value / 255) * radius * 0.8;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barLength);
      const y2 = centerY + Math.sin(angle) * (radius + barLength);

      // Couleur basée sur la fréquence
      const hue = (index / maxBars) * 360;
      ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  };

  const drawSpectrum = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frequency: number[],
    color: string
  ) => {
    const centerY = height / 2;
    const maxBars = Math.floor(width / 2);
    const step = Math.max(1, Math.floor(frequency.length / maxBars));

    for (let i = 0; i < maxBars; i++) {
      const index = i * step;
      const value = frequency[index] || 0;
      const barHeight = (value / 255) * (height / 2);
      const x = i * 2;

      // Gradient symétrique
      const gradient = ctx.createLinearGradient(x, 0, x, height);
      const hue = (index / frequency.length) * 360;
      gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.3)`);
      gradient.addColorStop(0.5, `hsla(${hue}, 100%, 60%, 0.8)`);
      gradient.addColorStop(1, `hsla(${hue}, 100%, 60%, 0.3)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - barHeight, 1, barHeight * 2);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full', className)}
      width={800}
      height={height}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
