import React from "react";
import { cn, formatTimeRemaining } from "@/lib/utils";
import { hexToRgba } from "@/lib/colors";
import { RotateCcw, Trash2, Check, Maximize2, AlertCircle } from "lucide-react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";

interface FocusCardProps {
  title: string;
  project: string;
  tier: 1 | 2 | 3 | 4;
  duration: string;
  isActive?: boolean;
  onUndo?: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  onClick?: () => void;
  subtasksCount?: number;
  completedSubtasksCount?: number;
  dueDate?: Date;
  projectColor?: string;
}

const TIER_COLORS = {
  1: "text-tier-1 bg-tier-1/5",
  2: "text-tier-2 bg-tier-2/5",
  3: "text-tier-3 bg-tier-3/5",
  4: "text-tier-4 bg-tier-4/5",
};

export function FocusCard({ 
  title, 
  project, 
  tier, 
  duration, 
  isActive,
  onUndo,
  onDelete,
  onComplete,
  onClick,
  subtasksCount = 0,
  completedSubtasksCount = 0,
  dueDate,
  projectColor
}: FocusCardProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const x = useMotionValue(0);
  
  // Transform values for swipe feedback
  const background = useTransform(
    x,
    [-100, 0, 100],
    ["rgba(244, 63, 94, 0.2)", "rgba(24, 24, 27, 0)", "rgba(16, 185, 129, 0.2)"]
  );
  
  const opacityLeft = useTransform(x, [-100, -50], [1, 0]);
  const opacityRight = useTransform(x, [50, 100], [0, 1]);
  const scaleRight = useTransform(x, [50, 100], [0.8, 1.2]);
  const scaleLeft = useTransform(x, [-100, -50], [1.2, 0.8]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100 && onComplete) {
      onComplete();
    } else if (info.offset.x < -100 && onDelete) {
      onDelete();
    }
  };

  const cardContent = (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: projectColor || (tier === 1 ? "#ef4444" : tier === 2 ? "#3b82f6" : "#10b981") }}
          />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
            {project}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {dueDate && (() => {
            const { label, urgency } = formatTimeRemaining(dueDate);
            return (
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                urgency === 'high' ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse" :
                urgency === 'medium' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
                urgency === 'low' ? "bg-primary/10 border-primary/30 text-primary" :
                "bg-zinc-500/10 border-border/30 text-zinc-500"
              )}>
                <AlertCircle size={10} />
                <span>{label}</span>
              </div>
            );
          })()}
          <span className="text-[10px] font-bold text-zinc-500 bg-void/50 px-2 py-0.5 rounded-full border border-border/30">
            {duration}
          </span>
          {onUndo && (
            <button 
              onClick={(e) => { e.stopPropagation(); onUndo(); }}
              className="p-1 text-zinc-500 hover:text-white transition-colors ml-1"
              title="Undo"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      
      <h3 className={cn(
        "text-xl font-semibold tracking-tight leading-tight mb-1",
        isActive ? "text-white" : "text-zinc-300"
      )}>
        {title}
      </h3>
      
      {isActive && subtasksCount > 0 && (
        <div className="absolute bottom-6 right-6 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
            {completedSubtasksCount}/{subtasksCount}
          </span>
        </div>
      )}

      {/* PC Hover Actions */}
      {!isMobile && (
        <div className="absolute inset-0 bg-void/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-2xl flex items-center justify-center gap-4 z-10">
          {onComplete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-void transition-all"
              title="Complete"
            >
              <Check size={20} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:text-void transition-all"
            style={{ 
              backgroundColor: projectColor ? `${projectColor}12` : 'rgba(var(--primary), 0.08)', 
              borderColor: projectColor ? `${projectColor}20` : 'rgba(var(--primary), 0.15)',
              color: projectColor || 'var(--primary)'
            }}
            title="Open Details"
          >
            <Maximize2 size={20} />
          </button>
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
              title="Delete"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative overflow-visible group">
      {/* Mobile Swipe Indicators */}
      {isMobile && (
        <>
          <motion.div 
            style={{ opacity: opacityRight, scale: scaleRight }}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 z-0 pointer-events-none"
          >
            <Check size={32} strokeWidth={3} />
          </motion.div>
          <motion.div 
            style={{ opacity: opacityLeft, scale: scaleLeft }}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-rose-500 z-0 pointer-events-none"
          >
            <Trash2 size={32} strokeWidth={3} />
          </motion.div>
        </>
      )}

      <motion.div
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: -120, right: 120 }}
        onDragEnd={handleDragEnd}
        onClick={() => onClick?.()}
        className={cn(
          "relative bg-surface border rounded-2xl p-5 transition-all duration-300 card-shadow cursor-pointer z-10 touch-pan-y",
          isActive ? "bg-surface/90 border-transparent shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]" : "border-transparent hover:border-border/50",
          !isMobile && "group-hover:border-border/30"
        )}
        style={{ 
          x, 
          background: isActive 
            ? `linear-gradient(135deg, ${hexToRgba(projectColor || '#facc15', 0.05)} 0%, rgba(15, 15, 18, 0.95) 100%)` 
            : `linear-gradient(135deg, ${hexToRgba(projectColor || '#facc15', 0.02)} 0%, rgba(15, 15, 18, 0.98) 100%)`,
          borderColor: isActive && projectColor ? `${projectColor}22` : projectColor ? `${projectColor}15` : undefined,
          boxShadow: isActive && projectColor ? `0 0 40px -15px ${hexToRgba(projectColor, 0.2)}` : undefined
        }}
      >
        {/* Left Accent Bar */}
        <div 
          className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full transition-all duration-300"
          style={{ 
            backgroundColor: projectColor || '#facc15',
            opacity: isActive ? 1 : 0.3
          }}
        />
        {cardContent}
      </motion.div>
    </div>
  );
}
