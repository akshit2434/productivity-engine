"use client";

import React, { useEffect, useState } from "react";
import { Anchor, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  tier: number;
  kpi_name: string;
  kpi_value: number;
  last_touched_at: string;
  decay_threshold_days: number;
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('tier', { ascending: true });
      
      if (data) setProjects(data);
      setIsLoading(false);
    }
    fetchProjects();
  }, [supabase]);

  const calculateHealth = (lastTouched: string, threshold: number) => {
    const diff = new Date().getTime() - new Date(lastTouched).getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    const health = Math.max(0, 100 - (days / threshold) * 100);
    return Math.round(health);
  };

  const handleIncrementKPI = async (e: React.MouseEvent, projectId: string, currentValue: number) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    
    const newValue = currentValue + 1;
    const { error } = await supabase
      .from('projects')
      .update({ kpi_value: newValue })
      .eq('id', projectId);
    
    if (!error) {
      setProjects(projects.map(p => p.id === projectId ? { ...p, kpi_value: newValue } : p));
    }
  };

  return (
    <div className="px-6 pt-12 max-w-md mx-auto">
      <header className="mb-10">
        <h1 className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-1">
          Project Portfolio
        </h1>
        <div className="h-px w-full bg-zinc-800" />
      </header>

      <div className="grid grid-cols-2 gap-4">
        {projects.map((project) => {
          const health = calculateHealth(project.last_touched_at, project.decay_threshold_days);
          const tierColor = project.tier === 1 ? "text-tier-1" : project.tier === 2 ? "text-tier-2" : "text-tier-3";

          return (
            <Link 
              href={`/portfolio/${project.id}`}
              key={project.id} 
              className="bg-surface border border-border rounded-lg p-4 relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
            >
              <div className={cn("absolute top-0 right-0 w-1 h-full bg-current", tierColor)} />
              
              <div className="flex items-center gap-2 mb-3">
                <Anchor size={14} className={tierColor} />
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Boat_{project.name}</span>
              </div>
              
              <h3 className="text-lg font-medium mb-4 truncate group-hover:text-primary transition-colors">{project.name}</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-end relative">
                  <span className="text-[10px] font-mono text-zinc-600 uppercase leading-none">{project.kpi_name || 'KPI'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-mono leading-none">{project.kpi_value}</span>
                    <button 
                      onClick={(e) => handleIncrementKPI(e, project.id, project.kpi_value)}
                      className="p-1 bg-zinc-900 border border-zinc-800 rounded hover:bg-primary/20 hover:border-primary/50 text-zinc-500 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono text-zinc-600 uppercase">
                    <span>Decay Health</span>
                    <span>{health}%</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-1000", health > 50 ? "bg-emerald-500" : health > 30 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${health}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 && !isLoading && (
        <div className="text-center py-20 text-zinc-600 font-mono text-xs uppercase">
          No active projects in orbit
        </div>
      )}
    </div>
  );
}
