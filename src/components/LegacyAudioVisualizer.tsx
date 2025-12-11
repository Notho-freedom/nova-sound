"use client";

import { useEffect, useRef } from "react";

interface LegacyAudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  className?: string;
}

/**
 * Legacy AudioVisualizer component
 * Simulates audio visualization when no real audio element is available
 */
export function LegacyAudioVisualizer({
  isPlaying,
  barCount = 50,
  className,
}: LegacyAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bars: number[] = Array(barCount).fill(0);
    const targetBars: number[] = Array(barCount).fill(0);

    const animate = () => {
      if (!isPlaying) {
        // Fade out when not playing
        bars.forEach((_, i) => {
          bars[i] = Math.max(0, bars[i] * 0.9);
        });
      } else {
        // Generate random target values
        targetBars.forEach((_, i) => {
          targetBars[i] = Math.random() * height;
        });

        // Smooth interpolation
        bars.forEach((_, i) => {
          bars[i] += (targetBars[i] - bars[i]) * 0.1;
        });
      }

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount;
      const gap = barWidth * 0.1;
      const actualBarWidth = barWidth - gap;

      bars.forEach((barHeight, i) => {
        const x = i * barWidth + gap / 2;
        const y = height - barHeight;

        // Gradient based on position
        const gradient = ctx.createLinearGradient(x, y, x, height);
        const hue = (i / barCount) * 360;
        gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 40%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, actualBarWidth, barHeight);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, barCount]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={800}
      height={200}
    />
  );
}

