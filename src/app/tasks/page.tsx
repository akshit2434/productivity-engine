"use client";

import React, { useEffect, useState } from "react";
import { FocusCard } from "@/components/ui/FocusCard";
import { Search, Filter, Trash2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, projects(name, tier)')
      .eq('state', 'Active')
      .order('created_at', { ascending: false });
    
    if (data) setTasks(data);
    setIsLoading(false);
  }

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleComplete = async (task: any) => {
    // 1. Mark current task as Done
    await supabase.from('tasks').update({ state: 'Done' }).eq('id', task.id);
    
    // 2. Log Activity
    await supabase.from('activity_logs').insert({
      task_id: task.id,
      project_id: task.project_id,
      duration_minutes: task.est_duration_minutes || 30
    });

    // 3. Update Project Health
    if (task.project_id) {
       await supabase.from('projects').update({ last_touched_at: new Date().toISOString() }).eq('id', task.project_id);
    }

    // 4. Handle Smart Recurrence
    if (task.recurrence_interval_days) {
      await supabase.from('tasks').insert({
        title: task.title,
        project_id: task.project_id,
        est_duration_minutes: task.est_duration_minutes,
        energy_tag: task.energy_tag,
        state: 'Active',
        recurrence_interval_days: task.recurrence_interval_days,
        // The core "Decay" philosophy: next alert is based on "last touched" (today)
      });
    }

    setTasks(tasks.filter(t => t.id !== task.id));
  };

  const handleUpdateStatus = async (id: string, newState: string) => {
    await supabase.from('tasks').update({ state: newState }).eq('id', id);
    setTasks(tasks.map(t => t.id === id ? { ...t, state: newState } : t));
  };

  const handleSetRecurrence = async (id: string, days: number) => {
    await supabase.from('tasks').update({ recurrence_interval_days: days }).eq('id', id);
    setTasks(tasks.map(t => t.id === id ? { ...t, recurrence_interval_days: days } : t));
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(filter.toLowerCase()) || 
    t.projects?.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="px-6 pt-12 pb-24 max-w-md mx-auto">
      <header className="mb-8">
        <h1 className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-4">
          Central Task Manager
        </h1>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text" 
              placeholder="Filter tasks..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2 font-mono text-xs outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Database_Entries</span>
          <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">{filteredTasks.length} Units</span>
        </div>
        
        {filteredTasks.map((task) => (
          <div key={task.id} className="group relative bg-surface border border-border rounded-xl p-4 transition-all hover:border-zinc-700">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                 <span className="text-[9px] font-mono text-zinc-600 uppercase mb-1">{task.projects?.name || 'Orbit'}</span>
                 <h3 className="text-sm font-medium pr-12">{task.title}</h3>
              </div>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={() => handleComplete(task)}
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors"
                  title="Mark Done"
                >
                  <CheckCircle2 size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
               {/* State Toggle */}
               <select 
                 className="bg-void border border-zinc-800 rounded px-2 py-1 text-[9px] font-mono uppercase text-zinc-400 outline-none focus:border-primary/40"
                 value={task.state}
                 onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
               >
                 <option value="Active">Active</option>
                 <option value="Waiting">Waiting</option>
                 <option value="Blocked">Blocked</option>
               </select>

               {/* Recurrence Setup */}
               <div className="flex items-center bg-void border border-zinc-800 rounded px-2 py-1 gap-1">
                 <span className="text-[9px] font-mono text-zinc-600">RECUR:</span>
                 <select 
                   className="bg-transparent text-[9px] font-mono text-zinc-400 outline-none"
                   value={task.recurrence_interval_days || ""}
                   onChange={(e) => handleSetRecurrence(task.id, parseInt(e.target.value))}
                 >
                   <option value="">Off</option>
                   <option value="1">1D</option>
                   <option value="7">7D</option>
                   <option value="15">15D</option>
                   <option value="30">30D</option>
                 </select>
               </div>

               {task.state === 'Waiting' && (
                  <div className="flex items-center bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-[9px] font-mono text-amber-500">
                    DEFERRED
                  </div>
               )}
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && !isLoading && (
          <div className="text-center py-20 text-zinc-600 font-mono text-xs uppercase border border-dashed border-border rounded-lg">
            No matches in current orbit
          </div>
        )}
      </section>
    </div>
  );
}
