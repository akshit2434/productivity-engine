"use client";

import React from "react";
import { useUserStore } from "@/store/userStore";
import { SessionMode } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { Zap, Coffee, Brain, Sparkles } from "lucide-react";

const MODES: { label: SessionMode; icon: any; color: string }[] = [
  { label: "Deep Work", icon: Brain, color: "text-primary" },
  { label: "Creative", icon: Sparkles, color: "text-tier-2" },
  { label: "Low Energy", icon: Coffee, color: "text-tier-3" },
  { label: "Admin", icon: Zap, color: "text-zinc-500" },
];

export function ModeSelector() {
  const { mode, setMode } = useUserStore();

  return (
    <div className="flex bg-surface border border-border rounded-lg p-1 mb-0 md:mb-6">
      {MODES.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.label;
        
        return (
          <button
            key={m.label}
            onClick={() => setMode(m.label)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-md transition-all duration-200",
              isActive ? "bg-zinc-800 shadow-inner" : "hover:bg-zinc-900/50"
            )}
          >
            <Icon size={16} className={cn(isActive ? m.color : "text-zinc-600")} />
            <span className={cn(
              "text-[8px] font-bold uppercase tracking-widest",
              isActive ? "text-zinc-200" : "text-zinc-600"
            )}>
              {m.label.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
