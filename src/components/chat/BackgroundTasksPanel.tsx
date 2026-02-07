"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  ChevronRight, 
  ChevronDown,
  ClipboardList,
  Terminal,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: any;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface Log {
  id: string;
  job_id: string;
  message: string;
  level: string;
  created_at: string;
}

export function BackgroundTasksPanel() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<Record<string, Log[]>>({});
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  useEffect(() => {
    // 1. Initial Fetch
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('background_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setJobs(data);
    };

    fetchJobs();

    // 2. Realtime Subscriptions
    const jobsChannel = supabase
      .channel('background_jobs_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'background_jobs' 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setJobs(prev => [payload.new as Job, ...prev]);
          // Auto-expand when new job arrives
          setIsPanelExpanded(true);
        } else if (payload.eventType === 'UPDATE') {
          setJobs(prev => prev.map(j => j.id === payload.new.id ? payload.new as Job : j));
        }
      })
      .subscribe();

    const logsChannel = supabase
      .channel('job_logs_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'job_logs' 
      }, (payload) => {
        const newLog = payload.new as Log;
        setLogs(prev => ({
          ...prev,
          [newLog.job_id]: [...(prev[newLog.job_id] || []), newLog]
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, []);

  const fetchLogsForJob = async (jobId: string) => {
    if (logs[jobId] && logs[jobId].length > 0) return;
    const { data } = await supabase
      .from('job_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (data) {
      setLogs(prev => ({ ...prev, [jobId]: data }));
    }
  };

  // Hide completely when no jobs
  if (jobs.length === 0) return null;

  // Calculate status counts
  const runningCount = jobs.filter(j => j.status === 'running' || j.status === 'pending').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="flex flex-col text-xs py-2">
      {/* Collapsed Header Bar */}
      <button
        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 cursor-pointer select-none group",
          runningCount > 0 
            ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5" 
            : "bg-surface/20 border-border/10 hover:bg-surface/30"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
            runningCount > 0 ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"
          )}>
            {runningCount > 0 ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Activity size={16} />
            )}
          </div>
          
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">
              Background Tasks
            </span>
            <span className="text-[9px] text-zinc-500 font-medium">
              {runningCount > 0 ? `${runningCount} running` : 'All complete'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badges */}
          {runningCount > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/40 text-primary bg-primary/10">
              {runningCount} active
            </span>
          )}
          {completedCount > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              {completedCount} done
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-red-500/40 text-red-400 bg-red-500/10">
              {failedCount} failed
            </span>
          )}
          
          <motion.div
            animate={{ rotate: isPanelExpanded ? 180 : 0 }}
            className="text-zinc-600 group-hover:text-zinc-400 transition-colors ml-1"
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </button>

      {/* Expandable Jobs List */}
      <AnimatePresence>
        {isPanelExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-visible"
          >
            <div className="flex flex-col gap-2 pt-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden",
                      job.status === 'completed' ? "bg-surface/10 border-border/10" : 
                      job.status === 'failed' ? "bg-red-500/5 border-red-500/20" :
                      "bg-surface/30 border-primary/20 shadow-lg shadow-primary/5",
                      expandedJobId === job.id ? "ring-1 ring-primary/40 shadow-xl" : ""
                    )}
                  >
                    <div 
                      className="flex items-center gap-3 p-3 cursor-pointer select-none"
                      onClick={() => {
                        if (expandedJobId === job.id) setExpandedJobId(null);
                        else {
                          setExpandedJobId(job.id);
                          fetchLogsForJob(job.id);
                        }
                      }}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300",
                        job.status === 'running' ? "bg-primary/20 text-primary shadow-inner shadow-primary/20" : 
                        job.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" :
                        job.status === 'failed' ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {job.status === 'running' ? <Loader2 size={18} className="animate-spin" /> :
                         job.status === 'completed' ? <CheckCircle2 size={18} /> :
                         job.status === 'failed' ? <XCircle size={18} /> : <Clock size={18} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-bold text-white truncate capitalize tracking-tight text-sm">
                            {job.type.replace('_', ' ')}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            job.status === 'running' ? "border-primary/40 text-primary bg-primary/10" : 
                            job.status === 'completed' ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" :
                            job.status === 'failed' ? "border-red-500/40 text-red-400 bg-red-500/10" : "border-zinc-700 text-zinc-500 bg-zinc-800"
                          )}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 line-clamp-2 font-medium leading-relaxed">
                          {job.payload.instruction}
                        </p>
                      </div>

                      <motion.div
                        animate={{ rotate: expandedJobId === job.id ? 90 : 0 }}
                        className="text-zinc-600 group-hover:text-zinc-400 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </motion.div>
                    </div>

                    <AnimatePresence>
                      {expandedJobId === job.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                          className="border-t border-border/10 bg-void/40 backdrop-blur-md"
                        >
                          <div className="p-4 flex flex-col gap-4">
                            {/* Logs Section */}
                            <div className="flex flex-col gap-2.5">
                              <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                  <Terminal size={11} className="text-primary/70" />
                                  <span>Execution Logs</span>
                                </div>
                                <div className="text-[8px] font-bold text-zinc-700 font-mono">
                                  {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5 font-mono text-[10px] bg-void/60 rounded-xl p-3.5 border border-border/15 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                                {(!logs[job.id] || logs[job.id].length === 0) && (
                                  <div className="flex items-center gap-2 text-zinc-600 py-1">
                                    <Loader2 size={10} className="animate-spin" />
                                    <span className="italic">Initializing subagent runtime...</span>
                                  </div>
                                )}
                                {logs[job.id]?.map((log) => (
                                  <div key={log.id} className="flex gap-2.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <span className="text-zinc-700 shrink-0 font-bold select-none">
                                      {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(':')[2]}s
                                    </span>
                                    <span className={cn(
                                      "break-all leading-relaxed",
                                      log.level === 'error' ? "text-red-400 font-bold" : 
                                      log.level === 'warn' ? "text-amber-400" : "text-zinc-400"
                                    )}>{log.message}</span>
                                  </div>
                                ))}
                                <div id={`log-end-${job.id}`} />
                              </div>
                            </div>

                            {/* Payload/Result Section */}
                            <div className="flex flex-col gap-2.5">
                              <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">
                                <ClipboardList size={11} className="text-primary/70" />
                                <span>Task Specification</span>
                              </div>
                              <div className="text-[11px] text-zinc-400 leading-relaxed p-3.5 bg-surface/5 rounded-xl border border-border/15 font-medium">
                                {job.payload.instruction}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
