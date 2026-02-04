"use client";

import React, { useState } from "react";
import { X, Check, Anchor, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { getProjectColor } from "@/lib/colors";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

import { motion, AnimatePresence } from "framer-motion";

export function CreateProjectDialog({ isOpen, onClose }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<number>(3);
  const [decayThreshold, setDecayThreshold] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();

  interface CreateProjectVars {
    name: string;
    tier: number;
    decayThreshold: number;
  }

  const createProjectMutation = useMutation({
    mutationFn: async (vars: CreateProjectVars) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const insertData: any = {
        name: vars.name,
        tier: vars.tier,
        decay_threshold_days: vars.decayThreshold,
        color: getProjectColor(vars.name),
      };
      
      if (session?.user?.id) {
        insertData.user_id = session.user.id;
      }

      console.log("Initiating project creation with payload:", insertData);

      const { data, error } = await supabase
        .from('projects')
        .insert([insertData])
        .select()
        .single();
      
      if (error) {
        console.error("Supabase Error during project creation:", error);
        throw error;
      }
      return data;
    },
    onMutate: async (vars: CreateProjectVars) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previousProjects = queryClient.getQueryData<any[]>(['projects']);

      if (previousProjects) {
        const optimisticProject = {
          id: 'temp-' + Math.random().toString(),
          name: vars.name,
          tier: vars.tier,
          decay_threshold_days: vars.decayThreshold,
          color: getProjectColor(vars.name),
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
      console.error("Mutation failed:", err);
      if (context?.previousProjects) {
        queryClient.setQueryData(['projects'], context.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-void/80 backdrop-blur-md" 
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-surface border border-border/50 rounded-[2.5rem] p-8 card-shadow"
          >
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

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => createProjectMutation.mutate({ name, tier, decayThreshold })}
                disabled={!name || isSubmitting}
                className="w-full bg-primary text-void h-14 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-primary/20 mt-4"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-3 border-void border-t-transparent animate-spin rounded-full" />
                ) : (
                  <>Initiate Sequence <Zap size={18} fill="currentColor" /></>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
