"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, BarChart, Clock, AlertTriangle, Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface ActivityLog {
  completed_at: string;
  duration_minutes: number;
}

interface StagnantTask {
  id: string;
  title: string;
  project_name: string;
  days_idle: number;
}

export default function ReviewPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    efficiency: 0,
    deepWorkHours: 0,
    dailyActivity: [0, 0, 0, 0, 0, 0, 0],
    stagnantTasks: [] as StagnantTask[],
    waitingTasks: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. Fetch Activity Logs
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('completed_at', lastWeek.toISOString());

      // 2. Fetch All Active/Waiting Tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .in('state', ['Active', 'Waiting']);

      if (logs) {
        // Calculate daily counts for the chart
        const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
        let totalMinutes = 0;

        logs.forEach(log => {
          const dayIndex = new Date(log.completed_at).getDay();
          dailyCounts[dayIndex]++;
          totalMinutes += log.duration_minutes || 0;
        });

        // Shift daily counts so today is the last element
        const todayIndex = now.getDay();
        const reorderedCounts = [];
        for (let i = 0; i < 7; i++) {
          reorderedCounts.push(dailyCounts[(todayIndex - 6 + i + 7) % 7]);
        }

        // Calculate Focus Efficiency (Simulated for now based on completed vs total attempted)
        const completedCount = logs.length;
        const activeCount = tasks?.filter(t => t.state === 'Active').length || 0;
        const efficiency = activeCount + completedCount > 0 
          ? Math.round((completedCount / (activeCount + completedCount)) * 100) 
          : 0;

        // 3. Identify Stagnant Tasks (> 14 days idle or created)
        const stagnant = (tasks || [])
          .map(t => {
            const idleTime = now.getTime() - new Date(t.last_touched_at || t.created_at).getTime();
            const daysIdle = Math.floor(idleTime / (1000 * 60 * 60 * 24));
            return { ...t, daysIdle };
          })
          .filter(t => t.daysIdle > 14)
          .map(t => ({
            id: t.id,
            title: t.title,
            project_name: t.projects?.name || 'Orbit',
            days_idle: t.daysIdle
          }));

        // 4. Identify Waiting Tasks
        const waiting = (tasks || []).filter(t => t.state === 'Waiting');

        setStats({
          efficiency,
          deepWorkHours: Math.round((totalMinutes / 60) * 10) / 10,
          dailyActivity: reorderedCounts,
          stagnantTasks: stagnant,
          waitingTasks: waiting
        });
      }
      setIsLoading(false);
    }

    fetchAnalytics();
  }, [supabase]);

  if (isLoading) return <div className="p-8 font-mono text-zinc-600 animate-pulse">ANALYZING_FLIGHT_DATA...</div>;

  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const maxActivity = Math.max(...stats.dailyActivity, 1);

  return (
    <div className="px-6 pt-12 pb-24 max-w-md mx-auto">
      <header className="mb-10">
        <h1 className="text-xs font-mono text-primary uppercase tracking-[0.2em] mb-1">
          Performance Analytics
        </h1>
        <div className="h-px w-full bg-zinc-800" />
      </header>

      <section className="space-y-6">
        {/* Input/Output Chart */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-mono uppercase tracking-widest">Velocity (Tasks/Day)</span>
          </div>
          
          <div className="h-32 flex items-end justify-between gap-2 px-2">
            {stats.dailyActivity.map((count, i) => {
              const height = (count / maxActivity) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-zinc-800 rounded-t-sm relative group overflow-hidden" style={{ height: `${height}%` }}>
                    <div className="absolute inset-0 bg-primary opacity-20 group-hover:opacity-40 transition-opacity" />
                    {count > 0 && <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_var(--color-primary)]" />}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-mono font-bold text-white">{count}</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-700">{days[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <BarChart size={14} className="text-primary mb-2" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase block mb-1">Execution Ratio</span>
            <span className="text-xl font-mono">{stats.efficiency}%</span>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <Clock size={14} className="text-amber-500 mb-2" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase block mb-1">Work Capacity (Hrs)</span>
            <span className="text-xl font-mono">{stats.deepWorkHours}</span>
          </div>
        </div>

        {/* Stagnation Report */}
        <div className="bg-void border border-dashed border-border p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
             <AlertTriangle size={12} className="text-entropy" />
             <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Stagnation Report</h3>
          </div>
          <div className="space-y-4">
            {stats.stagnantTasks.length > 0 ? (
              stats.stagnantTasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex justify-between items-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-200 line-clamp-1">{task.title}</span>
                    <span className="text-[9px] font-mono text-zinc-600 uppercase italic">{task.project_name}</span>
                  </div>
                  <span className="text-entropy font-mono text-[10px] whitespace-nowrap">{task.days_idle}D_IDLE</span>
                </div>
              ))
            ) : (
              <div className="text-[10px] font-mono text-zinc-700 uppercase italic">No stagnant fragments detected.</div>
            )}
            
            {stats.stagnantTasks.length > 3 && (
              <div className="text-[9px] font-mono text-zinc-400 text-center border-t border-zinc-900 pt-2">
                + {stats.stagnantTasks.length - 3} OTHER STAGNANT ENTITIES
              </div>
            )}
          </div>
        </div>

        {/* Waiting List */}
        {stats.waitingTasks.length > 0 && (
          <div className="bg-surface/50 border border-border p-4 rounded-lg">
            <h3 className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Suspended State (Waiting)</h3>
            <div className="space-y-2">
              {stats.waitingTasks.map(task => (
                <div key={task.id} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 truncate pr-4">{task.title}</span>
                  <span className="text-primary font-mono text-[10px]">PENDING</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
