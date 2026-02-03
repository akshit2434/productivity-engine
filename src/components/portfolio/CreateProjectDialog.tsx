"use client";

import React, { useState } from "react";
import { X, Check, Anchor, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({ isOpen, onClose }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<number>(3);
  const [decayThreshold, setDecayThreshold] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!name) return;
      const { data, error } = await supabase.from('projects').insert({
        name,
        tier,
        decay_threshold_days: decayThreshold,
        last_touched_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previousProjects = queryClient.getQueryData<any[]>(['projects']);

      if (previousProjects) {
        const optimisticProject = {
          id: 'temp-' + Math.random().toString(),
          name,
          tier,
          decay_threshold_days: decayThreshold,
          last_touched_at: new Date().toISOString()
        };
        queryClient.setQueryData(['projects'], [...previousProjects, optimisticProject].sort((a, b) => a.tier - b.tier));
      }

      onClose();
      // Reset form
      setName("");
      setTier(3);
      setDecayThreshold(15);

      return { previousProjects };
    },
    onError: (err, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(['projects'], context.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-void/80 backdrop-blur-md" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-surface border border-border/50 rounded-[2.5rem] p-8 card-shadow animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-8">
          <div>
             <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1">New Entity</p>
             <h2 className="text-2xl font-black text-white">Scale Orbit</h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-void border border-border/50 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Project Identifier</label>
            <input
              autoFocus
              className="w-full bg-void border border-border/50 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-zinc-800 font-medium"
              placeholder="Enter project name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Priority Stratum (Tier)</label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "py-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1",
                    tier === t 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-void border-border/50 text-zinc-600 hover:border-zinc-700"
                  )}
                >
                  <span className="opacity-50 text-[8px] uppercase tracking-tighter">Tier</span>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Decay Threshold</label>
              <span className="text-[10px] font-mono text-primary">{decayThreshold} Days</span>
            </div>
            <input 
              type="range"
              min="1"
              max="30"
              value={decayThreshold}
              onChange={(e) => setDecayThreshold(parseInt(e.target.value))}
              className="w-full h-1.5 bg-void rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[8px] text-zinc-700 font-bold uppercase tracking-tighter px-1">
              <span>Hyper-Active (1d)</span>
              <span>Maintenance (30d)</span>
            </div>
          </div>

          <button
            onClick={() => createProjectMutation.mutate()}
            disabled={!name || isSubmitting}
            className="w-full bg-primary text-void h-14 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-primary/20 mt-4"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-3 border-void border-t-transparent animate-spin rounded-full" />
            ) : (
              <>Initiate Sequence <Zap size={18} fill="currentColor" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
