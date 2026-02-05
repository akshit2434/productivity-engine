"use client";

import { useEffect } from "react";
import { FocusCard } from "@/components/ui/FocusCard";
import { ModeSelector } from "@/components/layout/ModeSelector";
import { TimeAvailableSelector } from "@/components/layout/TimeAvailableSelector";
import { useUserStore } from "@/store/userStore";
import { useTaskFulfillment } from "@/hooks/useTaskFulfillment";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { sortTasksByUrgency, filterAdminTasks, mapTaskData } from "@/lib/engine";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { AnimatePresence, motion } from "framer-motion";
import { Task } from "@/lib/engine";

export default function Home() {
  const { mode, timeAvailable } = useUserStore();
  const { completeTask } = useTaskFulfillment();
  const supabase = createClient();
  const queryClient = useQueryClient();
  // 1. Fetch Active Tasks Query
  const { data: allActive = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', 'active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select(`
          id, title, description, project_id, due_date, est_duration_minutes, energy_tag,
          last_touched_at, recurrence_interval_days, waiting_until,
          projects(name, tier, decay_threshold_days, color),
          subtasks(is_completed)
        `)
        .eq('state', 'Active')
        .or(`waiting_until.is.null,waiting_until.lte.${new Date().toISOString()}`);
      return (data || []).map(mapTaskData);
    },
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 mins
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = allActive.find(t => t.id === selectedTaskId);

  // 2. Fetch Recently Completed Tasks Query
  const { data: completedToday = [] } = useQuery({
    queryKey: ['history', 'recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('state', 'Done')
        .order('updated_at', { ascending: false })
        .limit(3);
      return data || [];
    }
  });

  // 3. Complete Task Mutation
  const completeMutation = useMutation({
    mutationFn: async (task: any) => {
      await completeTask({
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        durationMinutes: task.durationMinutes,
        recurrenceIntervalDays: task.recurrenceIntervalDays,
        energyTag: task.energyTag
      });
    },
    onMutate: async (task: any) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      await queryClient.cancelQueries({ queryKey: ['history', 'recent'] });

      const previousActive = queryClient.getQueryData<any[]>(['tasks', 'active']);
      const previousRecent = queryClient.getQueryData<any[]>(['history', 'recent']);

      queryClient.setQueryData(['tasks', 'active'], (old: any) => old?.filter((t: any) => t.id !== task.id));
      
      queryClient.setQueryData(['history', 'recent'], (old: any) => {
        const newItem = {
          id: task.id,
          title: task.title,
          est_duration_minutes: task.durationMinutes,
          projects: { name: task.projectName }
        };
        const filtered = (old || []).filter((t: any) => t.id !== task.id);
        return [newItem, ...filtered].slice(0, 3);
      });

      return { previousActive, previousRecent };
    },
    onError: (err, task, context) => {
      queryClient.setQueryData(['tasks', 'active'], context?.previousActive);
      queryClient.setQueryData(['history', 'recent'], context?.previousRecent);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await supabase.from('tasks').delete().eq('id', taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previous = queryClient.getQueryData<any[]>(['tasks', 'active']);
      queryClient.setQueryData(['tasks', 'active'], (old: any) => old?.filter((t: any) => t.id !== taskId));
      return { previous };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['tasks', 'active'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  // Realtime Sync - Only for critical external triggers if needed. 
  // Removing broad Task sync to prevent edit-flicker for solo user.
  useEffect(() => {
    const channel = supabase
      .channel('home-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  // Filter & Logic
  let constrainedTasks = allActive;
  if (timeAvailable) {
    constrainedTasks = allActive.filter(t => t.durationMinutes <= timeAvailable);
  }

  const sorted = sortTasksByUrgency(constrainedTasks, mode);
  const { focus: focusTasks, admin: adminTasks } = filterAdminTasks(sorted);
  const isLoading = isTasksLoading;

  return (
    <div className="px-6 pt-12 pb-32 max-w-md md:max-w-6xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1">Intelligence</p>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Today
            </h1>
          </div>
          <div className="flex gap-4">
             <Link 
               href="/chat"
               className="h-10 px-4 md:h-16 md:px-8 rounded-2xl md:rounded-[2rem] bg-primary text-void flex items-center gap-3 card-shadow hover:opacity-90 transition-all font-black text-[10px] md:text-xs tracking-[0.2em]"
             >
               <Sparkles size={18} strokeWidth={2.5} />
               <span>ASK AI</span>
             </Link>
             <div className="w-10 h-10 md:w-16 md:h-16 rounded-2xl md:rounded-[2rem] bg-surface border border-border/50 flex items-center justify-center text-zinc-400 card-shadow">
               <Clock className="md:w-7 md:h-7" size={18} />
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface/40 backdrop-blur-md border border-border/20 rounded-[2rem] p-4 flex flex-col justify-center">
            <ModeSelector />
          </div>
          <div className="bg-surface/40 backdrop-blur-md border border-border/20 rounded-[2rem] p-4 flex flex-col justify-center">
            <TimeAvailableSelector />
          </div>
        </div>

        <div className="md:col-span-7 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              Focus Objectives
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {focusTasks.length > 0 ? (
              focusTasks.map((task, index) => {
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <FocusCard
                      title={task.title}
                      project={task.projectName}
                      tier={task.projectTier as any}
                      duration={task.durationMinutes < 60 ? `${task.durationMinutes}m` : `${Math.floor(task.durationMinutes / 60)}h`}
                      dueDate={task.dueDate}
                      isActive={true}
                      onComplete={() => {
                        if (completeMutation.isPending) return;
                        completeMutation.mutate(task);
                      }}
                      onDelete={() => {
                        if (deleteMutation.isPending) return;
                        deleteMutation.mutate(task.id);
                      }}
                      onClick={() => setSelectedTaskId(task.id)}
                      subtasksCount={task.subtasksCount}
                      completedSubtasksCount={task.completedSubtasksCount}
                      projectColor={task.projectColor}
                    />
                  </motion.div>
                );
              })
            ) : !isLoading && (
              <div className="col-span-full text-center py-24 border border-dashed border-border rounded-3xl text-zinc-600 text-[10px] font-bold uppercase tracking-widest bg-surface/30">
                All objectives synchronized
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-5 lg:col-span-4 space-y-8">
          {completedToday.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  Recent Momentum
                </h2>
                <Link href="/history" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {completedToday.map((task: any) => (
                  <div key={task.id} className="bg-surface/50 border border-transparent rounded-2xl p-4 flex items-center justify-between group card-shadow hover:border-border/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-emerald-500/50" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-300 line-clamp-1">{task.title}</p>
                         <p className="text-[9px] font-bold text-zinc-600 uppercase italic leading-none mt-1.5">{task.projects?.name || 'Inbox'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-700 uppercase bg-void/50 px-2 py-1 rounded-lg border border-border/20">{task.est_duration_minutes}m</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Link 
            href="/tasks"
            className={cn(
              "p-6 bg-surface/30 border border-dashed border-border rounded-3xl block transition-all group hover:border-primary/50 hover:bg-surface/50 card-shadow",
              adminTasks.length === 0 ? "opacity-30 grayscale" : "opacity-80"
            )}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] block text-zinc-500 group-hover:text-primary transition-colors">
                Admin Batch
              </span>
              {adminTasks.length > 0 && (
                <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-1 rounded-lg animate-pulse uppercase tracking-widest">
                  {adminTasks.length} Detected
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-zinc-500 leading-relaxed group-hover:text-zinc-300 transition-colors">
               {adminTasks.length > 0 
                ? `${adminTasks.length} micro-tasks aggregated. Click to process fragmented subtasks.` 
                : "System stability optimal. No fragmentation detected."}
            </div>
          </Link>
        </div>
      </div>

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
