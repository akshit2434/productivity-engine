"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Calendar, Anchor, ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CompletedTask {
  id: string;
  title: string;
  updated_at: string;
  project_id: string;
  project_name: string;
  est_duration_minutes: number;
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HistoryPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          updated_at,
          project_id,
          est_duration_minutes,
          projects ( name )
        `)
        .eq('state', 'Done')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error("Error fetching history:", error);
        throw new Error(error.message);
      }

      return data?.map((t: any) => ({
        ...t,
        project_name: t.projects?.name || 'Orbit'
      })) || [];
    }
  });

  const tasks: CompletedTask[] = data || [];

  const undoMutation = useMutation<void, Error, string, { previous: CompletedTask[] | undefined }>({
    mutationFn: async (taskId) => {
      await supabase
        .from('activity_logs')
        .delete()
        .eq('task_id', taskId);

      await supabase
        .from('tasks')
        .update({ state: 'Active', updated_at: new Date().toISOString() })
        .eq('id', taskId);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['history'] });
      const previous = queryClient.getQueryData<CompletedTask[]>(['history']);
      queryClient.setQueryData(['history'], (old: CompletedTask[] | undefined) => old?.filter((t: CompletedTask) => t.id !== taskId));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['history'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const deleteMutation = useMutation<void, Error, string, { previous: CompletedTask[] | undefined }>({
    mutationFn: async (taskId) => {
      await supabase
        .from('activity_logs')
        .delete()
        .eq('task_id', taskId);

      await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['history'] });
      const previous = queryClient.getQueryData<CompletedTask[]>(['history']);
      queryClient.setQueryData(['history'], (old: CompletedTask[] | undefined) => old?.filter((t: CompletedTask) => t.id !== taskId));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['history'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const handleUndo = (id: string) => undoMutation.mutate(id);
  const handleDelete = (id: string) => deleteMutation.mutate(id);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['history'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return (
    <div className="px-6 pt-12 pb-32 max-w-md md:max-w-6xl mx-auto">
      <header className="mb-10 text-center md:text-left">
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] mb-1">Archive</p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2">History</h1>
      </header>

      {isLoading ? (
        <div className="p-8 font-bold text-zinc-600 animate-pulse text-xs uppercase tracking-widest text-center">Syncing Archive...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} className="bg-surface border border-transparent rounded-3xl p-6 group hover:border-border/50 transition-all card-shadow">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-500/60" />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUndo(task.id)}
                      className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-border/20 rounded-lg text-zinc-500 hover:text-white hover:border-border/50 transition-all"
                      title="Undo: Return to Active"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(task.id)}
                      className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-border/20 rounded-lg text-zinc-500 hover:text-rose-500 hover:border-rose-500/30 transition-all"
                      title="Delete Permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                      {task.project_name}
                    </span>
                    <h3 className="text-base font-bold text-white leading-snug">{task.title}</h3>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/10">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Duration</span>
                        <span className="text-xs font-bold text-zinc-400">{task.est_duration_minutes}m</span>
                      </div>
                      <div className="w-px h-6 bg-border/40" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Completed</span>
                        <span className="text-xs font-bold text-zinc-500">{new Date(task.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-24 bg-surface/30 rounded-3xl border border-dashed border-border/50">
              <p className="text-zinc-700 font-bold text-[10px] uppercase tracking-widest italic">0 Historical Records Found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
