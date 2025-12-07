import { useEffect, useState } from "react";

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
}

export const AudioVisualizer = ({ isPlaying, barCount = 40 }: AudioVisualizerProps) => {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    if (!isPlaying) {
      setBars(Array(barCount).fill(10));
      return;
    }

    const interval = setInterval(() => {
      const newBars = Array.from({ length: barCount }, (_, i) => {
        // Create wave-like pattern
        const baseHeight = Math.sin((Date.now() / 200) + (i * 0.3)) * 30 + 40;
        const randomVariation = Math.random() * 30;
        return Math.max(5, Math.min(100, baseHeight + randomVariation));
      });
      setBars(newBars);
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, barCount]);

  return (
    <div className="flex items-end justify-center gap-[2px] h-32 w-full px-4">
      {bars.map((height, index) => (
        <div
          key={index}
          className="visualizer-bar"
          style={{
            height: `${height}%`,
            animationDelay: `${index * 0.05}s`,
            opacity: isPlaying ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};
