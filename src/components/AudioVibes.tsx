"use client";

import { useRef, useEffect } from 'react';
import { useAudioVibes, type AudioVibesData } from '@/hooks/useAudioVibes';
import { cn } from '@/lib/utils';

export interface AudioVibesProps {
  audioElement: HTMLAudioElement | HTMLVideoElement | null;
  onAnalyze?: (data: AudioVibesData) => void;
  className?: string;
  enableVisualization?: boolean;
  visualizationType?: 'bars' | 'waveform' | 'circular' | 'particles';
}

/**
 * Composant pour analyser l'audio et déclencher des callbacks
 * Peut également afficher une visualisation optionnelle
 */
export function AudioVibes({
  audioElement,
  onAnalyze,
  className,
  enableVisualization = false,
  visualizationType = 'bars',
}: AudioVibesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vibesData = useAudioVibes(audioElement, {
    onAnalyze: (data) => {
      onAnalyze?.(data);
      if (enableVisualization && canvasRef.current) {
        drawVisualization(canvasRef.current, data, visualizationType);
      }
    },
  });

  // Fonction de dessin de visualisation
  const drawVisualization = (
    canvas: HTMLCanvasElement,
    data: AudioVibesData,
    type: string
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    switch (type) {
      case 'bars':
        drawBars(ctx, width, height, data.frequency);
        break;
      case 'waveform':
        drawWaveform(ctx, width, height, data.waveform);
        break;
      case 'circular':
        drawCircular(ctx, width, height, data.frequency);
        break;
      case 'particles':
        drawParticles(ctx, width, height, data);
        break;
    }
  };

  const drawBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frequency: number[]
  ) => {
    const barWidth = width / frequency.length;
    const maxBarHeight = height;

    ctx.fillStyle = '#3b82f6';
    frequency.forEach((value, index) => {
      const barHeight = (value / 255) * maxBarHeight;
      const x = index * barWidth;
      const y = height - barHeight;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    waveform: number[]
  ) => {
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / waveform.length;
    let x = 0;

    waveform.forEach((value, index) => {
      const v = value / 255;
      const y = (v * height) / 2;

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
    frequency: number[]
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;

    frequency.forEach((value, index) => {
      const angle = (index / frequency.length) * Math.PI * 2;
      const barLength = (value / 255) * radius;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barLength);
      const y2 = centerY + Math.sin(angle) * (radius + barLength);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  };

  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: AudioVibesData
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;

    // Particules basées sur les basses
    const bassParticles = Math.floor(data.bass / 10);
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < bassParticles; i++) {
      const angle = (i / bassParticles) * Math.PI * 2;
      const distance = (data.bass / 255) * Math.min(width, height) * 0.3;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const size = (data.bass / 255) * 5 + 2;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particules basées sur les aigus
    const trebleParticles = Math.floor(data.treble / 20);
    ctx.fillStyle = '#06b6d4';
    for (let i = 0; i < trebleParticles; i++) {
      const angle = (i / trebleParticles) * Math.PI * 2;
      const distance = (data.treble / 255) * Math.min(width, height) * 0.2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const size = (data.treble / 255) * 3 + 1;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (!enableVisualization) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-full', className)}
      width={400}
      height={200}
    />
  );
}

