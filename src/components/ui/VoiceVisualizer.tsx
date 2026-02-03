"use client";

import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  analyser: AnalyserNode | null;
  className?: string;
  color?: string;
}

export function VoiceVisualizer({ analyser, className, color = "#6366f1" }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        // Gradient color based on intensity
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `${color}88`);

        ctx.fillStyle = gradient;
        
        // Rounded bars
        const radius = barWidth / 2;
        const barX = x;
        const barY = height - barHeight;
        
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth - 1, barHeight, [radius, radius, 0, 0]);
        ctx.fill();

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, color]);

  return (
    <canvas 
      ref={canvasRef} 
      className={className} 
      width={300} 
      height={60} 
    />
  );
}
