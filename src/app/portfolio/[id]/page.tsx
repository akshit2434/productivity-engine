"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Anchor, ArrowLeft, Plus, Settings2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { FocusCard } from "@/components/ui/FocusCard";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  tier: number;
  decay_threshold_days: number;
  kpi_name: string;
  kpi_value: number;
  last_touched_at: string;
}

interface Task {
  id: string;
  title: string;
  state: string;
  est_duration_minutes: number;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for settings
  const [editForm, setEditForm] = useState({
    name: "",
    tier: 3,
    decay_threshold_days: 15,
    kpi_name: "KPI",
    kpi_value: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (projData) {
        setProject(projData);
        setEditForm({
          name: projData.name,
          tier: projData.tier,
          decay_threshold_days: projData.decay_threshold_days,
          kpi_name: projData.kpi_name || "KPI",
          kpi_value: projData.kpi_value || 0
        });
      }

      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      
      if (taskData) setTasks(taskData);
      setIsLoading(false);
    }

    fetchData();
  }, [id, supabase]);

  const handleUpdateProject = async () => {
    const { error } = await supabase
      .from('projects')
      .update(editForm)
      .eq('id', id);
    
    if (!error) {
      setProject({ ...project!, ...editForm });
      setIsEditing(false);
    }
  };

  if (isLoading) return <div className="p-8 font-mono text-zinc-600 animate-pulse">SYNCHRONIZING_CONTEXT...</div>;
  if (!project) return <div className="p-8 font-mono text-rose-500">PROJECT_NOT_FOUND</div>;

  const tierColor = project.tier === 1 ? "text-tier-1" : project.tier === 2 ? "text-tier-2" : "text-tier-3";

  return (
    <div className="px-6 pt-12 pb-24 max-w-md mx-auto">
      <header className="mb-8">
        <Link href="/portfolio" className="flex items-center gap-2 text-zinc-600 hover:text-primary transition-colors mb-6 text-xs font-mono uppercase tracking-widest group">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Return to Portfolio
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Anchor size={16} className={tierColor} />
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                BOAT_ID: {project.id.slice(0, 8)}
              </span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight">{project.name}</h1>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded-lg border transition-all ${isEditing ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border text-zinc-600 hover:text-zinc-400'}`}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {isEditing ? (
        <section className="bg-surface border border-primary/30 rounded-xl p-6 mb-8 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] mb-4">Cockpit_Settings</h3>
          
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Project Name</label>
            <input 
              className="w-full bg-void border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Priority Tier</label>
              <select 
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
                value={editForm.tier}
                onChange={(e) => setEditForm({...editForm, tier: parseInt(e.target.value)})}
              >
                <option value={1}>1 (Critical)</option>
                <option value={2}>2 (Growth)</option>
                <option value={3}>3 (Maintenance)</option>
                <option value={4}>4 (Icebox)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Decay (Days)</label>
              <input 
                type="number"
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
                value={editForm.decay_threshold_days}
                onChange={(e) => setEditForm({...editForm, decay_threshold_days: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">KPI Name</label>
              <input 
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
                value={editForm.kpi_name}
                onChange={(e) => setEditForm({...editForm, kpi_name: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">KPI Value</label>
              <input 
                type="number"
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary/50"
                value={editForm.kpi_value}
                onChange={(e) => setEditForm({...editForm, kpi_value: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <button 
            onClick={handleUpdateProject}
            className="w-full bg-primary text-void font-bold py-3 rounded-lg text-xs font-mono uppercase tracking-widest hover:opacity-90 transition-all mt-4"
          >
            Apply Modifications
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-surface border border-border rounded-lg p-4">
             <span className="text-[10px] font-mono text-zinc-600 uppercase block mb-1">{project.kpi_name || 'KPI'}</span>
             <span className="text-2xl font-mono">{project.kpi_value}</span>
           </div>
           <div className="bg-surface border border-border rounded-lg p-4">
             <span className="text-[10px] font-mono text-zinc-600 uppercase block mb-1">Health State</span>
             <span className={`text-2xl font-mono ${project.decay_threshold_days > 10 ? 'text-emerald-500' : 'text-rose-500'}`}>Nominal</span>
           </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Project_Backlog</h2>
          <span className="text-[10px] font-mono text-zinc-700">{tasks.length} Entities</span>
        </div>

        <div className="space-y-4">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <FocusCard 
                key={task.id}
                title={task.title}
                project={project.name}
                tier={project.tier as any}
                duration={`${task.est_duration_minutes}m`}
                isActive={task.state === 'Active'}
              />
            ))
          ) : (
            <div className="text-center py-12 border border-dashed border-border rounded-lg text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
              No task data found for this boat
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
