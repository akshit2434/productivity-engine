"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Anchor, Settings2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { FocusCard } from "@/components/ui/FocusCard";
import { KPIManager } from "@/components/portfolio/KPIManager";
import { useProjectAnalytics } from "@/hooks/useProjectAnalytics";
import { Clock, TrendingUp, Zap, Brain, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTaskFulfillment } from "@/hooks/useTaskFulfillment";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { AnimatePresence, motion } from "framer-motion";
import { mapTaskData, Task } from "@/lib/engine";

interface Project {
  id: string;
  name: string;
  tier: number;
  decay_threshold_days: number;
  last_touched_at: string;
  settings?: {
    enabledMetrics?: string[];
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    tier: 3,
    decay_threshold_days: 15,
    settings: {
      enabledMetrics: ["weekly_intensity", "7d_velocity", "focus_consistency", "deep_work_ratio"]
    }
  });
  const [activeTab, setActiveTab] = useState<"Active" | "Waiting" | "History">("Active");
  const { metrics, isLoading: isAnalyticsLoading } = useProjectAnalytics(id as string);
  const { completeTask } = useTaskFulfillment();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 1. Fetch Project Query
  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      return data as Project;
    },
    enabled: !!id
  });

  // 2. Fetch Project Tasks Query
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', 'project', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, subtasks(is_completed)')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      return (data || []).map(mapTaskData);
    },
    enabled: !!id
  });

  useEffect(() => {
    if (project) {
      setEditForm({
        name: project.name,
        tier: project.tier,
        decay_threshold_days: project.decay_threshold_days,
        settings: project.settings || {
          enabledMetrics: ["weekly_intensity", "7d_velocity", "focus_consistency", "deep_work_ratio"]
        } as any
      });
    }
  }, [project]);

  // 3. Mutations
  const undoMutation = useMutation<void, Error, string>({
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
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', id] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', 'project', id]);
      queryClient.setQueryData(['tasks', 'project', id], (old: Task[] | undefined) => 
        old?.map((t: Task) => t.id === taskId ? { ...t, state: 'Active' } : t)
      );
      return { previous };
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', id] });
        queryClient.invalidateQueries({ queryKey: ['history'] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const deleteTaskMutation = useMutation<void, Error, string>({
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
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', id] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', 'project', id]);
      queryClient.setQueryData(['tasks', 'project', id], (old: Task[] | undefined) => 
        old?.filter((t: Task) => t.id !== taskId)
      );
      return { previous };
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', id] });
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
        queryClient.invalidateQueries({ queryKey: ['projectAnalytics', id] });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (task: Task) => {
      await completeTask({
        id: task.id,
        title: task.title,
        projectId: id as string,
        durationMinutes: task.durationMinutes,
        recurrenceIntervalDays: task.recurrenceIntervalDays,
        energyTag: task.energyTag
      });
    },
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'project', id] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', 'project', id]);
      queryClient.setQueryData(['tasks', 'project', id], (old: Task[] | undefined) => 
        old?.map((t: Task) => t.id === task.id ? { ...t, state: 'Done' } : t)
      );
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'project', id] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const handleComplete = (task: any) => completeMutation.mutate(task);

  const deleteProjectMutation = useMutation<void, Error, string>({
    mutationFn: async (projectId) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/portfolio');
    }
  });

  const handleDeleteProject = () => {
    if (confirm("Are you sure you want to vanish this project? All associated tasks will be lost forever.")) {
      deleteProjectMutation.mutate(id as string);
    }
  };

  const handleUpdateProject = async () => {
    const { error } = await supabase
      .from('projects')
      .update(editForm)
      .eq('id', id);
    
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setIsEditing(false);
    }
  };

  const handleUndo = (taskId: string) => undoMutation.mutate(taskId);
  const handleDeleteTask = (taskId: string) => deleteTaskMutation.mutate(taskId);

  const selectedTask = (tasks as any[]).find(t => t.id === selectedTaskId);

  const isLoading = isProjectLoading || isTasksLoading;

  if (isLoading) return <div className="px-6 pt-32 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-700 animate-pulse">Syncing Matrix...</div>;
  if (!project) return <div className="px-6 pt-32 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-500/50">Entity Not Found</div>;

  const tierColor = project.tier === 1 ? "text-tier-1" : project.tier === 2 ? "text-tier-2" : "text-tier-3";

  return (
    <div className="px-6 pt-12 pb-32 max-w-md md:max-w-7xl mx-auto">
      <header className="mb-10">
        <Link href="/portfolio" className="flex items-center gap-2 text-zinc-600 hover:text-white transition-all mb-8 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Global Portfolio</span>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("w-2 h-2 rounded-full", tierColor.replace('text-', 'bg-'))} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                Tier_{project.tier}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">{project.name}</h1>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center transition-all card-shadow border shrink-0",
              isEditing ? 'bg-primary border-primary text-void' : 'bg-surface border-border/50 text-zinc-400 hover:text-white'
            )}
          >
            <Settings2 size={24} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Left Column: Stats & Settings */}
        <div className="md:col-span-5 lg:col-span-12 xl:col-span-4 space-y-8">
          {isEditing && (
            <section className="bg-surface border border-primary/20 rounded-3xl p-8 space-y-6 animate-in fade-in slide-in-from-top-4 card-shadow">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Configuration</p>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Identify</label>
                <input 
                  className="w-full bg-void border border-border/50 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all font-medium"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Priority</label>
                  <select 
                    className="w-full bg-void border border-border/50 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all font-medium appearance-none"
                    value={editForm.tier}
                    onChange={(e) => setEditForm({...editForm, tier: parseInt(e.target.value)})}
                  >
                    <option value={1}>1 - Critical</option>
                    <option value={2}>2 - Growth</option>
                    <option value={3}>3 - Maintenance</option>
                    <option value={4}>4 - Icebox</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Decay</label>
                  <input 
                    type="number"
                    className="w-full bg-void border border-border/50 rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all font-medium"
                    value={editForm.decay_threshold_days}
                    onChange={(e) => setEditForm({...editForm, decay_threshold_days: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <button 
                onClick={handleUpdateProject}
                className="w-full bg-primary text-void font-bold py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-primary/90 transition-all card-shadow mt-6"
              >
                Save Protocol Changes
              </button>

              <div className="pt-4 border-t border-border/20">
                <button 
                  onClick={handleDeleteProject}
                  disabled={deleteProjectMutation.isPending}
                  className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all card-shadow flex items-center justify-center gap-2 group"
                >
                  <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                  Vanish Project
                </button>
              </div>
            </section>
          )}

          <div className="bg-surface border border-transparent rounded-3xl p-8 w-full card-shadow relative overflow-hidden">
             <div className="flex justify-between items-center mb-6">
               <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest block">Vitality State</span>
               <span className={cn(
                 "text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter",
                 (new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24) > project.decay_threshold_days
                   ? "text-rose-500 bg-rose-500/10"
                   : "text-emerald-500 bg-emerald-500/10"
               )}>
                 { (new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24) > project.decay_threshold_days ? "Maintenance Required" : "Optimal Momentum" }
               </span>
             </div>
             
             <div className="flex items-baseline gap-4 mb-8">
               <span className="text-6xl md:text-8xl font-extrabold text-white tracking-tighter leading-none">
                 {Math.floor((new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24))}
               </span>
               <div className="flex flex-col">
                 <span className="text-base font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Days</span>
                 <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest opacity-50">Inactive Focus</span>
               </div>
             </div>
             
             <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-zinc-600">Focus Continuity</span>
                  <span className="text-zinc-400">{Math.min(100, Math.round(((new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24)) / project.decay_threshold_days * 100))}%</span>
                </div>
                <div className="h-2.5 w-full bg-void rounded-full overflow-hidden p-[1px] border border-border/20">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      (new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24) > project.decay_threshold_days ? "bg-rose-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, ((new Date().getTime() - new Date(project.last_touched_at).getTime()) / (1000 * 60 * 60 * 24)) / project.decay_threshold_days * 100)}%` }}
                  />
                </div>
             </div>
          </div>

          {!isAnalyticsLoading && metrics && (
            <div className="bg-surface border border-transparent rounded-3xl p-8 card-shadow space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Automated Vitals</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-void/50 rounded-2xl border border-border/10">
                  <div className="flex items-center gap-2 text-zinc-600 mb-2">
                    <Clock size={12} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Intensity</span>
                  </div>
                  <span className="text-xl font-extrabold text-white">
                    {metrics.weeklyAverageMinutes < 60 ? `${metrics.weeklyAverageMinutes}m` : `${(metrics.weeklyAverageMinutes / 60).toFixed(1)}h`}
                  </span>
                </div>
                <div className="p-4 bg-void/50 rounded-2xl border border-border/10">
                  <div className="flex items-center gap-2 text-zinc-600 mb-2">
                    <TrendingUp size={12} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Velocity</span>
                  </div>
                  <span className="text-xl font-extrabold text-white">{metrics.tasksCompletedLast7Days}</span>
                </div>
              </div>

              <div className="p-5 bg-void/50 rounded-2xl border border-border/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Zap size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Focus Consistency</span>
                  </div>
                  <span className="text-lg font-extrabold text-primary">{metrics.consistencyScore}%</span>
                </div>
                <div className="h-1.5 w-full bg-void rounded-full overflow-hidden p-[1px] border border-border/20">
                  <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${metrics.consistencyScore}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Key Results & Backlog */}
        <div className="md:col-span-7 lg:col-span-12 xl:col-span-8 space-y-10">
          <KPIManager projectId={project.id} />

          <section>
            <div className="flex items-center justify-between mb-8 px-1">
              <div className="flex gap-4 p-1 bg-surface/50 rounded-2xl border border-border/30">
                {(["Active", "Waiting", "History"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all rounded-xl",
                      activeTab === tab 
                        ? "bg-primary text-void card-shadow" 
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  {tasks.filter(t => activeTab === "History" ? t.state === 'Done' : t.state === activeTab).length} Entities
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                {tasks.filter(t => activeTab === "History" ? t.state === 'Done' : t.state === activeTab).length > 0 ? (
                  tasks
                    .filter(t => activeTab === "History" ? t.state === 'Done' : t.state === activeTab)
                    .map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <FocusCard 
                        title={task.title}
                        project={project.name}
                        tier={project.tier as any}
                        duration={`${task.durationMinutes}m`}
                        dueDate={task.dueDate}
                        isActive={task.state === 'Active'}
                        onUndo={activeTab === 'History' ? () => handleUndo(task.id) : undefined}
                        onDelete={() => handleDeleteTask(task.id)}
                        onComplete={task.state === 'Active' ? () => handleComplete(task) : undefined}
                        onClick={() => setSelectedTaskId(task.id)}
                        subtasksCount={task.subtasksCount}
                        completedSubtasksCount={task.completedSubtasksCount}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-32 bg-surface/30 border border-dashed border-border/50 rounded-3xl">
                    <div className="w-16 h-16 bg-void/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-border">
                      <Brain className="text-zinc-800" size={32} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Zero focus fragments in {activeTab} state</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
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
