"use client";

import React, { useState } from "react";
import { X, Send, Sparkles, Check, Edit2, Mic, Square, Zap, FileText, MessageCircle, WifiOff } from "lucide-react";
import { cn, parseDuration } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/db";
import { processOutbox } from "@/lib/sync";

interface QuickCaptureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickCaptureDrawer({ isOpen, onClose }: QuickCaptureDrawerProps) {
  const isOnline = useOnlineStatus();
  // Capture modes: 'task' (AI or Manual), 'thought' (silent dump to notes)
  const [captureMode, setCaptureMode] = useState<'task' | 'thought'>('task');
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [thoughtInput, setThoughtInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Manual Form State
  const [manualData, setManualData] = useState({
    title: "",
    description: "",
    projectId: "NONE",
    projectName: "",
    duration: "30m",
    energy: "Normal",
    dueDate: ""
  });

  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Fetch Projects Query from local DB
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      return await db.projects.toArray();
    },
    enabled: isOpen
  });

  // 2. Add Task Mutation using Dexie
  const addTaskMutation = useMutation({
    mutationFn: async (result: any) => {
      if (!result) return;
      let finalProjectId = result.projectId;

      // Handle "None" or "Inbox" project
      if (finalProjectId === "NONE") {
        finalProjectId = undefined;
      }

      if (!finalProjectId && result.project && result.project !== "None" && result.project !== "NONE") {
        // Find existing project by name in Dexie
        const existingProj = await db.projects.where('name').equals(result.project).first();

        if (existingProj) {
          finalProjectId = existingProj.id;
        } else {
          // Create new project in Dexie
          const newProj = {
            id: crypto.randomUUID(),
            name: result.project,
            tier: 3,
            decay_threshold_days: 15,
            last_touched_at: new Date().toISOString(),
            kpi_value: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          await db.projects.add(newProj);
          await db.recordAction('projects', 'insert', newProj);
          finalProjectId = newProj.id;
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      }

      const newTask = {
        id: crypto.randomUUID(),
        title: result.task,
        description: result.description || null,
        project_id: finalProjectId || null,
        est_duration_minutes: parseDuration(result.duration?.toString()) || 30,
        energy_tag: result.energy || 'Shallow',
        recurrence_interval_days: result.recurrence || null,
        due_date: result.dueDate || null,
        state: 'Active' as const,
        last_touched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db.tasks.add(newTask);
      await db.recordAction('tasks', 'insert', newTask);
      processOutbox().catch(() => {});
    },
    onMutate: async (newResult) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'active'] });
      const previousTasks = queryClient.getQueryData<any[]>(['tasks', 'active']);
      
      if (previousTasks && newResult) {
        const optimisticTask = {
          id: Math.random().toString(),
          title: newResult.task,
          description: newResult.description || "",
          projectId: newResult.projectId === "NONE" ? null : newResult.projectId,
          projectName: newResult.project || "Inbox",
          projectTier: 3,
          lastTouchedAt: new Date(),
          decayThresholdDays: 15,
          durationMinutes: parseDuration(newResult.duration?.toString()) || 0,
          energyTag: newResult.energy || 'Shallow',
          recurrenceIntervalDays: newResult.recurrence || null,
          dueDate: newResult.dueDate ? new Date(newResult.dueDate) : undefined,
          state: 'Active',
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['tasks', 'active'], [optimisticTask, ...previousTasks]);
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'active'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onSuccess: () => {
      onClose();
      resetState();
    }
  });

  const resetState = () => {
    setInput("");
    setThoughtInput("");
    setIsExpanded(false);
    setManualData({
      title: "",
      description: "",
      projectId: "NONE",
      projectName: "",
      duration: "30m",
      energy: "Normal",
      dueDate: ""
    });
  };

  // 3. Add Thought Mutation using Dexie
  const addThoughtMutation = useMutation({
    mutationFn: async (content: string) => {
      const newNote = {
        id: crypto.randomUUID(),
        title: 'Quick Thought',
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await db.notes.add(newNote);
      await db.recordAction("notes", "insert", newNote);
      processOutbox().catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['unread_thoughts'] });
      onClose();
      resetState();
    }
  });

  // Force manual mode if offline
  React.useEffect(() => {
    if (!isOnline && isAiEnabled) {
      setIsAiEnabled(false);
    }
  }, [isOnline, isAiEnabled]);

  const { isRecording, startRecording, stopRecording, analyser, audioBlob } = useVoiceRecorder();

  // Shared helper: Convert Blob to base64 string
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleProcess = async (blobOverride?: Blob) => {
    const targetBlob = blobOverride || audioBlob;
    if (!input && !targetBlob) return;
    setIsProcessing(true);
    
    try {
      let body: any = { 
        input,
        existingProjects: projects.map((p: any) => p.name)
      };
      if (targetBlob) {
        const base64Audio = await blobToBase64(targetBlob);
        body = {
          ...body,
          audio: base64Audio,
          mimeType: targetBlob.type
        };
      }

      const response = await fetch("/api/parse-task", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error("Parsing failed");
      
      const data = await response.json();
      const matchingProject = projects.find((p: any) => p.name.toLowerCase() === data.project?.toLowerCase());

      // Populate manual form and exit AI mode
      setManualData({
        title: data.task,
        description: data.description || "",
        projectId: matchingProject?.id || "NONE",
        projectName: matchingProject?.name || data.project || "",
        duration: data.duration || "30m",
        energy: data.energy || "Normal",
        dueDate: data.dueDate ? new Date(new Date(data.dueDate).getTime() - new Date(data.dueDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
      });
      setIsAiEnabled(false);
      setIsExpanded(false);
      setInput("");
    } catch (error) {
      console.error(error);
      setIsAiEnabled(false);
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
    if (!isRecording && audioBlob) {
      if (captureMode === 'task' && isAiEnabled) {
        handleProcess(audioBlob);
      } else if (captureMode === 'thought') {
        handleThoughtVoice(audioBlob);
      }
    }
  }, [isRecording, audioBlob, isAiEnabled, captureMode]);

  const handleThoughtVoice = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(blob);
      const res = await fetch("/api/parse-thought", {
        method: "POST",
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: blob.type
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Thought parsing failed");
      const data = await res.json();
      
      // Auto-save the thought directly (no intermediate text step)
      addThoughtMutation.mutate(data.text);
    } catch (error) {
      console.error("Thought voice error:", error);
      setIsProcessing(false);
    }
    // Note: setIsProcessing(false) is handled by addThoughtMutation's onSuccess/onError via resetState
  };

  const handleManualSubmit = () => {
    addTaskMutation.mutate({
      task: manualData.title,
      description: manualData.description,
      project: manualData.projectName || "None",
      duration: manualData.duration,
      energy: manualData.energy,
      projectId: manualData.projectId === "NONE" ? undefined : manualData.projectId,
      dueDate: manualData.dueDate || undefined,
      recurrence: null
    });
  };

  const isSaving = addTaskMutation.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-void/60 backdrop-blur-sm" 
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-surface border-t border-border rounded-t-2xl p-6 pb-12 card-shadow"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                {captureMode === 'thought' ? <MessageCircle size={14} /> : isAiEnabled ? <Sparkles size={14} /> : <Zap size={14} />} 
                {captureMode === 'thought' ? "Quick Thought" : "Quick Capture"}
              </h2>
              <div className="flex items-center gap-3">
                {/* Mode Toggle: Task vs Thought */}
                <button 
                  onClick={() => setCaptureMode(captureMode === 'task' ? 'thought' : 'task')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all",
                    captureMode === 'thought'
                      ? "bg-amber-500 text-void shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                      : "bg-void border border-border text-zinc-500 hover:text-amber-400 hover:border-amber-500/30"
                  )}
                >
                  <MessageCircle size={10} />
                  Thought
                </button>
                <button 
                  onClick={() => setIsAiEnabled(!isAiEnabled)}
                  disabled={!isOnline}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all",
                    !isOnline 
                      ? "bg-void border border-border/5 text-zinc-800 cursor-not-allowed" 
                      : isAiEnabled 
                        ? "bg-primary text-void shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                        : "bg-void border border-border text-zinc-500 hover:text-primary hover:border-primary/30"
                  )}
                  title={isOnline ? "Toggle AI Parsing" : "AI features require connection"}
                >
                  {!isOnline ? <WifiOff size={10} /> : isAiEnabled ? <Zap size={10} fill="currentColor" /> : <Sparkles size={10} />}
                  {!isOnline ? "Offline" : isAiEnabled ? "AI Mode" : "Manual"}
                </button>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {captureMode === 'thought' ? (
                <motion.div
                  key="thought-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4"
                >
                  {isRecording ? (
                    <div className="w-full h-36 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />
                      <VoiceVisualizer analyser={analyser} className="z-10 w-full" color="#f59e0b" />
                      <p className="text-[10px] font-mono text-amber-500 uppercase tracking-[0.2em] z-10 font-bold">Listening...</p>
                    </div>
                  ) : (
                    <textarea
                      autoFocus
                      className="w-full h-36 bg-void border border-amber-500/20 rounded-2xl p-5 font-medium text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-none placeholder:text-zinc-800 transition-all"
                      placeholder="Dump your thought here. No AI, no parsing. Just capture it."
                      value={thoughtInput}
                      onChange={(e) => setThoughtInput(e.target.value)}
                    />
                  )}
                  
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      className={cn(
                        "w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center transition-all",
                        isRecording 
                          ? "bg-red-500/10 border border-red-500/20 text-red-500" 
                          : "bg-surface border border-border text-amber-500 hover:bg-amber-500/10"
                      )}
                    >
                      {isRecording ? <Square size={20} /> : <Mic size={24} />}
                    </motion.button>
                    
                    {!isRecording && (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addThoughtMutation.mutate(thoughtInput)}
                        disabled={!thoughtInput.trim() || addThoughtMutation.isPending || isProcessing}
                        className="flex-1 bg-amber-500 text-void h-14 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
                      >
                        {addThoughtMutation.isPending || (isProcessing && !isRecording) ? (
                          <div className="w-4 h-4 border-2 border-void border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <>Capture Thought <MessageCircle size={14} /></>
                        )}
                      </motion.button>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center font-medium">This will appear in your Catch Up feed.</p>
                </motion.div>
              ) : !isAiEnabled ? (
                <motion.div
                  key="manual-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Title</label>
                    <input 
                      autoFocus
                      type="text"
                      className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-800"
                      placeholder="Enter task name..."
                      value={manualData.title}
                      onChange={(e) => setManualData({ ...manualData, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      className="w-full h-24 bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-800 resize-none"
                      placeholder="Add short context or steps (Markdown ok)..."
                      value={manualData.description}
                      onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Energy</label>
                      <select 
                        className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none appearance-none"
                        value={manualData.energy}
                        onChange={(e) => setManualData({ ...manualData, energy: e.target.value })}
                      >
                        <option value="Shallow">Shallow</option>
                        <option value="Normal">Normal</option>
                        <option value="Deep">Deep</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 flex items-end">
                      <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className={cn(
                          "w-full bg-void border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all",
                          isExpanded ? "text-primary border-primary/40" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {isExpanded ? "Less Options" : "More Options"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4">
                      <div className="space-y-1.5 overflow-visible">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Duration</label>
                        <div className="space-y-2">
                          <input 
                            type="text"
                            className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-800"
                            placeholder="e.g. 30m, 1.5h, None"
                            value={manualData.duration}
                            onChange={(e) => setManualData({ ...manualData, duration: e.target.value })}
                          />
                          <div className="flex gap-1.5 flex-wrap">
                            {['None', '15m', '30m', '1h', '2h'].map(suggest => (
                              <button
                                key={suggest}
                                type="button"
                                onClick={() => setManualData({ ...manualData, duration: suggest })}
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tight transition-all",
                                  manualData.duration === suggest 
                                    ? "bg-primary text-void" 
                                    : "bg-void border border-border text-zinc-600 hover:border-zinc-700"
                                )}
                              >
                                {suggest}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Project</label>
                        <select 
                          className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none appearance-none"
                          value={manualData.projectId}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "NONE") {
                               setManualData({ ...manualData, projectId: "NONE", projectName: "Inbox" });
                            } else {
                               const p = projects.find((p: any) => p.id === val);
                               setManualData({ ...manualData, projectId: val, projectName: p?.name || "" });
                            }
                          }}
                        >
                          <option value="NONE">Inbox</option>
                          {projects.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">Deadline</label>
                        <div className="space-y-2">
                            <input 
                              type="datetime-local"
                              className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-zinc-800 text-zinc-300"
                              value={manualData.dueDate}
                              onChange={(e) => setManualData({ ...manualData, dueDate: e.target.value })}
                            />
                            <div className="flex gap-1.5 flex-wrap">
                              {[
                                { label: 'None', value: '' },
                                { label: 'Today', value: (() => {
                                    const d = new Date();
                                    d.setHours(18, 0, 0, 0); // Default to 6 PM
                                    return d.toISOString().slice(0, 16);
                                })() },
                                { label: 'Tmrw', value: (() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + 1);
                                    d.setHours(9, 0, 0, 0); // Default to tomorrow 9 AM
                                    return d.toISOString().slice(0, 16);
                                })() },
                                { label: 'Next Mon', value: (() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7 || 7);
                                    d.setHours(9, 0, 0, 0);
                                    return d.toISOString().slice(0, 16);
                                })() }
                              ].map(suggest => (
                                <button
                                  key={suggest.label}
                                  type="button"
                                  onClick={() => setManualData({ ...manualData, dueDate: suggest.value })}
                                  className={cn(
                                    "px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tight transition-all",
                                    manualData.dueDate === suggest.value 
                                      ? "bg-primary text-void" 
                                      : "bg-void border border-border text-zinc-600 hover:border-zinc-700"
                                  )}
                                >
                                  {suggest.label}
                                </button>
                              ))}
                            </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualSubmit}
                    disabled={!manualData.title || isSaving}
                    className="w-full bg-primary text-void h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(99,102,241,0.2)] mt-2"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-void border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <>Create Task <Check size={14} /></>
                    )}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div 
                  key="ai-input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {isRecording ? (
                    <div className="w-full h-36 bg-void/50 border border-primary/20 rounded-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                      <VoiceVisualizer analyser={analyser} className="z-10 w-full" color="#6366f1" />
                      <p className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] z-10 font-bold">Listening...</p>
                    </div>
                  ) : (
                    <textarea
                      autoFocus
                      className="w-full h-36 bg-void border border-border rounded-2xl p-5 font-medium text-sm focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-zinc-800 transition-all"
                      placeholder="What have you achieved recently? Or what's your next mission?"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  )}
                  
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={isRecording ? stopRecording : startRecording}
                      className={cn(
                        "w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center transition-all",
                        isRecording 
                          ? "bg-red-500/10 border border-red-500/20 text-red-500" 
                          : "bg-surface border border-border text-primary hover:bg-primary/10"
                      )}
                    >
                      {isRecording ? <Square size={20} /> : <Mic size={24} />}
                    </motion.button>
                    
                    {!isRecording && (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleProcess()}
                        disabled={!input || isProcessing}
                        className="flex-1 bg-primary text-void h-14 rounded-2xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all font-black shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-void border-t-transparent animate-spin rounded-full" />
                        ) : (
                          <>Deploy Intelligence <Send size={14} /></>
                        )}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
