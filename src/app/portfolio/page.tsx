"use client";

import React, { useEffect, useState } from "react";
import { Anchor, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  tier: number;
  last_touched_at: string;
  decay_threshold_days: number;
}

import { useQuery } from "@tanstack/react-query";
import { CreateProjectDialog } from "@/components/portfolio/CreateProjectDialog";

export default function PortfolioPage() {
  const supabase = createClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('tier', { ascending: true });
      return data || [];
    }
  });

  const calculateHealth = (lastTouched: string, threshold: number) => {
    // Defensive checks to prevent NaN during optimistic updates or loading states
    if (!lastTouched || !threshold || threshold <= 0) return 100;
    
    const lastTouchedTime = new Date(lastTouched).getTime();
    if (isNaN(lastTouchedTime)) return 100;
    
    const diff = new Date().getTime() - lastTouchedTime;
    const days = diff / (1000 * 60 * 60 * 24);
    const health = Math.max(0, 100 - (days / threshold) * 100);
    return Math.round(health);
  };

  return (
    <div className="px-6 pt-12 pb-32 max-w-md md:max-w-6xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1">Strategy</p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2">Portfolio</h1>
        </div>
        
        <button 
          onClick={() => setIsDialogOpen(true)}
          className="bg-primary text-void px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Scale New Entity</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const health = calculateHealth(project.last_touched_at, project.decay_threshold_days);
          const tierColor = project.tier === 1 ? "bg-tier-1" : project.tier === 2 ? "bg-tier-2" : "bg-tier-3";
          const isOptimistic = project.id.startsWith('temp-');

          return (
            <Link 
              href={isOptimistic ? "#" : `/portfolio/${project.id}`}
              key={project.id} 
              className={cn(
                "bg-surface border border-transparent rounded-3xl p-6 relative group hover:border-border/50 transition-all card-shadow block",
                isOptimistic && "opacity-70 cursor-not-allowed pointer-events-none animate-pulse"
              )}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-void border border-border/50", 
                    project.tier === 1 && "text-tier-1",
                    project.tier === 2 && "text-tier-2",
                    project.tier === 3 && "text-tier-3"
                  )}>
                    <Anchor size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors pr-6">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <div className={cn("w-1.5 h-1.5 rounded-full", tierColor)} />
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tier_{project.tier}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-zinc-700 group-hover:text-primary transition-all group-hover:translate-x-1" />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-zinc-600">Focus Continuity</span>
                  <span className={cn(
                    health > 50 ? "text-emerald-500" : health > 30 ? "text-amber-500" : "text-rose-500"
                  )}>{health}%</span>
                </div>
                <div className="h-2 w-full bg-void rounded-full overflow-hidden p-[1px] border border-border/20">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", health > 50 ? "bg-emerald-500" : health > 30 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${health}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {projects.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-24 bg-surface/30 rounded-3xl border border-dashed border-border/50">
            <p className="text-zinc-700 font-bold text-[10px] uppercase tracking-widest italic">0 Active Entities</p>
          </div>
        )}
      </div>

      <CreateProjectDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
      />
    </div>
  );
}
