"use client";

import React, { useEffect, useState } from "react";
import { FocusCard } from "@/components/ui/FocusCard";
import { Search, Filter, Trash2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useTaskFulfillment } from "@/hooks/useTaskFulfillment";
import { mapTaskData } from "@/lib/engine";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { AnimatePresence } from "framer-motion";
import { Task } from "@/lib/engine";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function TasksPage() {
  const [filter, setFilter] = useState("");
  const supabase = createClient();
  const { completeTask } = useTaskFulfillment();
  const queryClient = useQueryClient();

  // 1. Fetch Tasks Query
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          project_id,
          state,
          due_date,
          waiting_until,
          est_duration_minutes,
          energy_tag,
          blocked_by_id,
          recurrence_interval_days,
          last_touched_at,
          created_at,
          waiting_until,
          projects(name, tier, decay_threshold_days),
          subtasks(is_completed)
        `)
        .eq('state', 'Active')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[Tasks Query Error]', error);
      }
      
      return (data || []).map(mapTaskData);
    },
    staleTime: 1000 * 60 * 5,
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // 2. Mutations
  const deleteMutation = useMutation<void, Error, string, { previousTasks: any[] | undefined }>({
    mutationFn: async (id: string) => {
      await supabase.from('tasks').delete().eq('id', id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previousTasks = queryClient.getQueryData<any[]>(['tasks', 'active']);
      queryClient.setQueryData(['tasks', 'active'], (old: any) => old?.filter((t: any) => t.id !== id));
      return { previousTasks };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['tasks', 'active'], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
    }
  });

  const completeMutation = useMutation<void, Error, any, { previousTasks: any[] | undefined }>({
    mutationFn: async (task: any) => {
      await completeTask({
        id: task.id,
        title: task.title,
        projectId: task.project_id,
        durationMinutes: task.est_duration_minutes,
        recurrenceIntervalDays: task.recurrence_interval_days,
        energyTag: task.energy_tag
      });
    },
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previousTasks = queryClient.getQueryData<any[]>(['tasks', 'active']);
      queryClient.setQueryData(['tasks', 'active'], (old: any) => old?.filter((t: any) => t.id !== task.id));
      return { previousTasks };
    },
    onError: (err, task, context) => {
      queryClient.setQueryData(['tasks', 'active'], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const updateStatusMutation = useMutation<void, Error, { id: string, newState: string }, { previousTasks: any[] | undefined }>({
    mutationFn: async ({ id, newState }) => {
      await supabase.from('tasks').update({ state: newState }).eq('id', id);
    },
    onMutate: async ({ id, newState }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previousTasks = queryClient.getQueryData<any[]>(['tasks', 'active']);
      queryClient.setQueryData(['tasks', 'active'], (old: any) => 
        old?.map((t: any) => t.id === id ? { ...t, state: newState } : t)
      );
      return { previousTasks };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
    }
  });

  const recurrenceMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string, days: number }) => {
      await supabase.from('tasks').update({ recurrence_interval_days: days }).eq('id', id);
    },
    onMutate: async ({ id, days }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previousTasks = queryClient.getQueryData<any[]>(['tasks', 'active']);
      queryClient.setQueryData(['tasks', 'active'], (old: any) => 
        old?.map((t: any) => t.id === id ? { ...t, recurrenceIntervalDays: days } : t)
      );
      return { previousTasks };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
    }
  });

  const filteredTasks = tasks.filter((t: any) => {
    const searchStr = filter.toLowerCase();
    const inTitle = t.title.toLowerCase().includes(searchStr);
    const inProject = t.projectName?.toLowerCase().includes(searchStr);
    const inDescription = t.description?.toLowerCase().includes(searchStr);
    
    return inTitle || inProject || inDescription;
  });

  const handleDelete = (id: string) => {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate(id);
  };
  const handleComplete = (task: any) => {
    if (completeMutation.isPending) return;
    completeMutation.mutate(task);
  };
  const handleUpdateStatus = (id: string, newState: string) => {
    if (updateStatusMutation.isPending) return;
    updateStatusMutation.mutate({ id, newState });
  };
  const handleSetRecurrence = (id: string, days: number) => {
    if (recurrenceMutation.isPending) return;
    recurrenceMutation.mutate({ id, days });
  };

  return (
    <div className="px-6 pt-12 pb-32 max-w-md md:max-w-6xl mx-auto">
      <header className="mb-10 text-center md:text-left">
        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1">Intelligence</p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-6">Manager</h1>
        
        <div className="flex gap-4 max-w-2xl md:mx-0 mx-auto">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Filter tasks by title or project..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-surface border border-transparent rounded-2xl pl-12 pr-4 py-4 text-sm outline-none focus:border-primary/50 transition-all font-medium card-shadow"
            />
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-[11px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Active Objectives</h2>
          <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest bg-void/50 px-3 py-1 rounded-full border border-border/20">{filteredTasks.length} Entities</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
             Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface/50 border border-border/10 rounded-3xl p-6 h-64 animate-pulse">
                  <div className="w-20 h-2 bg-zinc-800 rounded-full mb-4" />
                  <div className="w-full h-4 bg-zinc-800 rounded-full mb-2" />
                  <div className="w-3/4 h-4 bg-zinc-800 rounded-full mb-8" />
                  <div className="flex justify-end gap-2 mt-auto">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl" />
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl" />
                  </div>
                </div>
             ))
          ) : filteredTasks.map((task: any) => (
            <FocusCard 
              key={task.id}
              title={task.title}
              project={task.projectName}
              tier={task.projectTier as any}
              duration={`${task.durationMinutes}m`}
              dueDate={task.dueDate}
              isActive={task.state === 'Active'}
              onComplete={() => handleComplete(task)}
              onDelete={() => handleDelete(task.id)}
              onClick={() => setSelectedTaskId(task.id)}
              subtasksCount={task.subtasksCount}
              completedSubtasksCount={task.completedSubtasksCount}
            />
          ))}
        </div>

        {filteredTasks.length === 0 && !isLoading && (
          <div className="text-center py-32 bg-surface/30 rounded-3xl border border-dashed border-border/50">
            <p className="text-zinc-700 font-bold text-[10px] uppercase tracking-widest italic">No objectives in current focus</p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedTaskId && selectedTask && (
          <TaskDetailModal 
            key={selectedTaskId}
            task={selectedTask} 
            isOpen={!!selectedTaskId} 
            onClose={() => setSelectedTaskId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
