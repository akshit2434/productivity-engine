"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformBars] = useState(() => 
    Array.from({ length: 32 }, () => Math.random() * 0.7 + 0.3)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * duration;
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-2xl min-w-[280px]",
      "bg-gradient-to-br from-zinc-900/90 to-zinc-800/90",
      "backdrop-blur-xl border border-white/5",
      "shadow-lg shadow-black/20",
      className
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <motion.button
        onClick={togglePlayPause}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
          isPlaying 
            ? "bg-primary text-black" 
            : "bg-white/10 text-white hover:bg-white/20"
        )}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </motion.button>

      {/* Waveform Visualization */}
      <div 
        className="flex-1 flex items-center gap-[2px] h-10 cursor-pointer group"
        onClick={handleWaveformClick}
      >
        {waveformBars.map((height, i) => {
          const barProgress = (i / waveformBars.length) * 100;
          const isActive = barProgress < progress;
          const isNearPlayhead = Math.abs(barProgress - progress) < 3;
          
          return (
            <motion.div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-all duration-150",
                isActive 
                  ? "bg-primary" 
                  : "bg-white/20 group-hover:bg-white/30"
              )}
              style={{ height: `${height * 100}%` }}
              animate={isPlaying && isNearPlayhead ? {
                scaleY: [1, 1.3, 1],
                transition: { duration: 0.3 }
              } : {}}
            />
          );
        })}
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-mono text-white/60 min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <Volume2 size={14} className="text-white/40" />
      </div>
    </div>
  );
}
