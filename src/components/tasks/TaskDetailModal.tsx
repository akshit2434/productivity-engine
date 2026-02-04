"use client";

import React, { useState } from "react";
import { 
  X, 
  Plus, 
  MessageSquare, 
  CheckSquare, 
  Trash2, 
  Mic, 
  Clock, 
  ChevronRight,
  Loader2,
  Square,
  Edit3,
  Eye,
  Sparkles,
  Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskNote, Subtask } from "@/types/database";
import { Task } from "@/lib/engine";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TaskDetailModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"notes" | "subtasks">("notes");
  const [newSubtask, setNewSubtask] = useState("");
  const [newNote, setNewNote] = useState("");
  const { isRecording, startRecording, stopRecording, audioBlob } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Edit states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDuration, setEditedDuration] = useState((task.durationMinutes || 30).toString());
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editedNote, setEditedNote] = useState(task.description || "");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editedSubtaskTitle, setEditedSubtaskTitle] = useState("");
  const [editedRecurrence, setEditedRecurrence] = useState((task.recurrenceIntervalDays || "").toString());

  // Fetch Projects for selector
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name');
      return data || [];
    },
    enabled: isOpen
  });

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: any) => {
      await supabase.from("tasks").update(updates).eq("id", task.id);
    },
    onMutate: async (updates) => {
      justSavedRef.current = true;
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      // Map domain updates to domain names for the optimistic state
      const domainUpdates: any = {};
      if (updates.title) domainUpdates.title = updates.title;
      if (updates.est_duration_minutes) domainUpdates.durationMinutes = updates.est_duration_minutes;
      if (updates.description !== undefined) domainUpdates.description = updates.description;
      if (updates.due_date !== undefined) domainUpdates.dueDate = updates.due_date ? new Date(updates.due_date) : undefined;
      if (updates.project_id !== undefined) {
          domainUpdates.projectId = updates.project_id;
          domainUpdates.projectName = projects.find(p => p.id === updates.project_id)?.name || "Inbox";
      }
      if (updates.energy_tag !== undefined) domainUpdates.energyTag = updates.energy_tag;
      if (updates.recurrence_interval_days !== undefined) domainUpdates.recurrenceIntervalDays = updates.recurrence_interval_days;
      
      queryClient.setQueryData(["tasks", "active"], (old: any) => 
        old?.map((t: any) => t.id === task.id ? { ...t, ...domainUpdates } : t)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("tasks").delete().eq("id", task.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    }
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      await supabase.from("subtasks").insert({ task_id: task.id, title });
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", task.id, "subtasks"] });
      const previous = queryClient.getQueryData<Subtask[]>(["tasks", task.id, "subtasks"]);
      const optimistic = { id: Math.random().toString(), task_id: task.id, title, is_completed: false, created_at: new Date().toISOString() };
      queryClient.setQueryData(["tasks", task.id, "subtasks"], [...(previous || []), optimistic]);
      return { previous };
    },
    onError: (err, variables, context) => queryClient.setQueryData(["tasks", task.id, "subtasks"], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "subtasks"] }),
    onSuccess: () => setNewSubtask(""),
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, title, is_completed }: { id: string; title?: string; is_completed?: boolean }) => {
      await supabase.from("subtasks").update({ title, is_completed }).eq("id", id);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", task.id, "subtasks"] });
      const previous = queryClient.getQueryData<Subtask[]>(["tasks", task.id, "subtasks"]);
      queryClient.setQueryData(["tasks", task.id, "subtasks"], (old: any) => 
        old?.map((st: any) => st.id === variables.id ? { ...st, ...variables } : st)
      );
      return { previous };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "subtasks"] }),
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("subtasks").delete().eq("id", id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", task.id, "subtasks"] });
      const previous = queryClient.getQueryData<Subtask[]>(["tasks", task.id, "subtasks"]);
      queryClient.setQueryData(["tasks", task.id, "subtasks"], (old: any) => old?.filter((st: any) => st.id !== id));
      return { previous };
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "subtasks"] }),
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const lastTaskId = useRef<string>(task.id);
  const justSavedRef = useRef(false);
  const isMountedRef = useRef(false);

  // Initial mount - sync from prop
  useEffect(() => {
    setEditedNote(task.description || "");
    lastTaskId.current = task.id;
    isMountedRef.current = true;
  }, []); // Empty deps = only on mount

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  // Sync state with props ONLY when task ID changes or not actively editing
  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(task.title);
    }
    setEditedDuration((task.durationMinutes || 30).toString());
    setEditedRecurrence((task.recurrenceIntervalDays || "").toString());
  }, [task.id, task.title, task.durationMinutes, task.recurrenceIntervalDays, isEditingTitle]);

  useEffect(() => {
    // Skip on mount, let the mount effect handle it
    if (!isMountedRef.current) return;

    const hasTaskChanged = task.id !== lastTaskId.current;
    
    if (hasTaskChanged) {
       setEditedNote(task.description || "");
       lastTaskId.current = task.id;
       setIsEditingNote(false);
       justSavedRef.current = false;
    } else if (!isEditingNote && !updateTaskMutation.isPending && !justSavedRef.current) {
       // Only sync if the server has new data we don't have locally
       if ((task.description || "") !== editedNote) {
         setEditedNote(task.description || "");
       }
    }

    // Reset the justSavedRef after a delay if mutation finished
    if (!updateTaskMutation.isPending && justSavedRef.current) {
      const timer = setTimeout(() => {
        justSavedRef.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [task.id, task.description, isEditingNote, updateTaskMutation.isPending, editedNote]);

  // Debounced auto-save for the note
  useEffect(() => {
    if (!isEditingNote) return;

    const timer = setTimeout(() => {
      if (editedNote !== (task.description || "") && !updateTaskMutation.isPending) {
        updateTaskMutation.mutate({ description: editedNote });
      }
    }, 2000); // 2s debounce for auto-save

    return () => clearTimeout(timer);
  }, [editedNote, isEditingNote, task.description, updateTaskMutation.isPending]);

  // Notes and Subtasks queries
  const { data: subtasks = [], isLoading: isLoadingSubtasks } = useQuery({
    queryKey: ["tasks", task.id, "subtasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      return (data || []) as Subtask[];
    },
    enabled: isOpen,
  });

  // No longer using indvidual notes, but keeping the mutation if needed for other things. For now we update description.
  const updateDescription = (content: string) => {
    setEditedNote(content);
    updateTaskMutation.mutate({ description: content });
  };

  // Transcription Logic
  useEffect(() => {
    if (audioBlob) {
      handleTranscription(audioBlob);
    }
  }, [audioBlob]);

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob);
      formData.append("taskTitle", task.title);
      formData.append("currentContent", editedNote);

      const response = await fetch("/api/process-audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Processing failed");
      const { updatedMarkdown } = await response.json();
      
      updateDescription(updatedMarkdown);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleEditor = () => {
    if (isEditingNote) {
      // Closing editor - save immediately if dirty
      if (editedNote !== (task.description || "")) {
        updateTaskMutation.mutate({ description: editedNote });
      }
      setIsEditingNote(false);
    } else {
      setIsEditingNote(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-void/80 backdrop-blur-md" 
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-surface border border-border/50 rounded-[2.5rem] overflow-hidden card-shadow"
      >
        <div className="flex flex-col h-[80vh]">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-border/10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 mr-4">
                <select 
                    className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2 block font-mono bg-transparent border-none outline-none cursor-pointer hover:text-primary/80 transition-all appearance-none"
                    value={task.projectId || "NONE"}
                    onChange={(e) => {
                        const val = e.target.value === "NONE" ? null : e.target.value;
                        updateTaskMutation.mutate({ project_id: val });
                    }}
                >
                    <option value="NONE" className="bg-void text-zinc-400">Inbox</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id} className="bg-void text-zinc-300">{p.name}</option>
                    ))}
                </select>
                
                {isEditingTitle ? (
                    <input 
                        ref={inputRef}
                        className="text-2xl font-extrabold text-white tracking-tight bg-void/50 border border-primary/30 rounded-lg px-2 py-1 w-full outline-none focus:border-primary"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={() => {
                            setIsEditingTitle(false);
                            if (editedTitle !== task.title) updateTaskMutation.mutate({ title: editedTitle });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                setIsEditingTitle(false);
                                if (editedTitle !== task.title) updateTaskMutation.mutate({ title: editedTitle });
                            }
                        }}
                    />
                ) : (
                    <h2 
                        className="text-2xl font-extrabold text-white tracking-tight cursor-text hover:text-primary/80 transition-colors"
                        onClick={() => setIsEditingTitle(true)}
                    >
                        {task.title}
                    </h2>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to vanish this task?")) {
                      deleteTaskMutation.mutate();
                    }
                  }}
                  disabled={deleteTaskMutation.isPending}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl bg-void border border-rose-500/20 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/5 transition-all"
                  title="Vanish Task"
                >
                  {deleteTaskMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl bg-void border border-border/50 text-zinc-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="bg-void/50 border border-border/20 rounded-xl flex items-center gap-3 px-4 py-2 hover:border-primary/30 transition-all cursor-pointer group/dur min-w-[120px]">
                    <Clock size={14} className="text-zinc-500 group-hover/dur:text-primary transition-colors shrink-0" />
                    <input 
                        className="bg-transparent border-none outline-none text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-12 text-center"
                        value={editedDuration}
                        onChange={(e) => setEditedDuration(e.target.value)}
                        onBlur={() => {
                            const val = parseInt(editedDuration);
                            if (!isNaN(val) && val !== task.durationMinutes) {
                                updateTaskMutation.mutate({ est_duration_minutes: val });
                            }
                        }}
                    />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest shrink-0">Mins</span>
                </div>
                
                <div className="flex flex-col gap-2 min-w-[200px]">
                    <div className={cn(
                        "bg-void/50 border border-border/20 rounded-xl flex items-center gap-3 px-4 py-2 hover:border-primary/30 transition-all cursor-pointer group/deadline",
                        task.dueDate && "border-primary/20"
                    )}>
                        <Calendar size={14} className="text-zinc-500 group-hover/deadline:text-primary transition-colors shrink-0" />
                        <input 
                            type="datetime-local"
                            className="bg-transparent border-none outline-none text-[10px] font-bold text-zinc-400 uppercase tracking-widest outline-none text-zinc-300 w-full"
                            value={task.dueDate ? new Date(new Date(task.dueDate).getTime() - new Date(task.dueDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                updateTaskMutation.mutate({ due_date: val ? new Date(val).toISOString() : null });
                            }}
                        />
                    </div>
                    <div className="flex gap-1.5 ml-1">
                        {[
                            { label: 'None', value: null },
                            { label: 'EOD', value: (() => {
                                const d = new Date();
                                d.setHours(18, 0, 0, 0);
                                return d.toISOString();
                            })() },
                            { label: 'Tmrw', value: (() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                d.setHours(9, 0, 0, 0);
                                return d.toISOString();
                            })() }
                        ].map(opt => (
                            <button
                                key={opt.label || 'none'}
                                onClick={() => updateTaskMutation.mutate({ due_date: opt.value })}
                                className="px-2 py-0.5 rounded-md border border-border/20 text-[8px] font-bold uppercase tracking-widest text-zinc-500 hover:text-primary hover:border-primary/30 transition-all bg-void/30"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <select 
                    className={cn(
                        "px-4 py-2 border rounded-xl flex items-center gap-2 h-fit text-[10px] font-bold uppercase tracking-widest outline-none cursor-pointer transition-all appearance-none text-center",
                        task.energyTag === "Deep" ? "bg-purple-500/10 border-purple-500/20 text-purple-500" :
                        task.energyTag === "Normal" ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                        "bg-rose-500/10 border-rose-500/20 text-rose-500"
                    )}
                    value={task.energyTag}
                    onChange={(e) => updateTaskMutation.mutate({ energy_tag: e.target.value })}
                >
                    <option value="Deep" className="bg-void text-purple-500">Deep</option>
                    <option value="Normal" className="bg-void text-blue-500">Normal</option>
                    <option value="Shallow" className="bg-void text-rose-500">Shallow</option>
                </select>

                <div className="bg-void/50 border border-border/20 rounded-xl flex items-center gap-2 px-4 py-2 hover:border-primary/30 transition-all cursor-pointer group/rec min-w-[100px]">
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest shrink-0">Every</span>
                    <input 
                        className="bg-transparent border-none outline-none text-[10px] font-bold text-zinc-400 uppercase tracking-widest w-8 text-center"
                        value={editedRecurrence}
                        onChange={(e) => setEditedRecurrence(e.target.value)}
                        onBlur={() => {
                            const val = editedRecurrence === "" ? null : parseInt(editedRecurrence);
                            if (val !== task.recurrenceIntervalDays) {
                                updateTaskMutation.mutate({ recurrence_interval_days: val });
                            }
                        }}
                        placeholder="--"
                    />
                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest shrink-0">Days</span>
                </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex px-4 pt-4 border-b border-border/5">
            <button 
              onClick={() => setActiveTab("notes")}
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
                activeTab === "notes" ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Sticky Note {task.description && "(Active)"}
              {activeTab === "notes" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button 
              onClick={() => setActiveTab("subtasks")}
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
                activeTab === "subtasks" ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Structural Fragments {subtasks.length > 0 && `(${subtasks.length})`}
              {activeTab === "subtasks" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === "notes" ? (
              <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            {isEditingNote ? <Edit3 size={10} /> : <Eye size={10} />}
                            {isEditingNote ? "Editor Mode" : "Intelligence Preview"}
                        </span>
                        {updateTaskMutation.isPending && (
                            <span className="text-[9px] font-bold text-primary/50 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                <Loader2 size={8} className="animate-spin" /> Syncing...
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={toggleEditor}
                            className="bg-void border border-border/40 text-zinc-600 hover:text-white px-3 py-1 rounded-lg text-[10px] uppercase font-bold transition-all"
                        >
                            {isEditingNote ? "Done Editing" : "Manual Edit"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-void/30 border border-border/10 rounded-[2rem] p-6 relative overflow-hidden group/editor min-h-[300px]">
                  {isEditingNote ? (
                    <textarea 
                        className="w-full h-full bg-transparent border-none outline-none text-zinc-300 text-sm leading-relaxed resize-none font-mono custom-scrollbar"
                        value={editedNote}
                        onChange={(e) => setEditedNote(e.target.value)}
                        placeholder="Start typing strategic details in Markdown..."
                    />
                  ) : (
                    <div className="prose prose-invert max-w-none prose-sm text-zinc-400">
                      {editedNote ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {editedNote}
                        </ReactMarkdown>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 opacity-30 grayscale pointer-events-none">
                            <Sparkles size={48} className="mb-4 text-zinc-700" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">No Intelligence Logged</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Pulse for recording/thinking */}
                  <AnimatePresence>
                    {(isRecording || isTranscribing) && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-primary/5 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center"
                      >
                        <div className="relative">
                           <div className="w-20 h-20 rounded-full bg-primary/10 animate-ping absolute inset-0" />
                           <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center relative border border-primary/30">
                              {isRecording ? <Mic size={32} className="text-primary" /> : <Loader2 size={32} className="text-primary animate-spin" />}
                           </div>
                        </div>
                        <h4 className="mt-8 text-xs font-bold text-primary uppercase tracking-[0.3em]">
                            {isRecording ? "Listening to Objectives..." : "Agent Processing Protocol..."}
                        </h4>
                        <p className="mt-2 text-[10px] text-zinc-600 font-medium max-w-[200px]">
                            {isRecording ? "Release to process and act on your context." : "Adjusting Markdown content based on context-aware logic."}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex justify-between items-center px-1 pt-4">
                    <button 
                      onClick={handleToggleRecording}
                      className={cn(
                        "h-14 flex-1 rounded-[1.25rem] border flex items-center justify-center gap-3 transition-all card-shadow",
                        isRecording ? "bg-rose-500 border-rose-500 text-void scale-95" : "bg-primary border-primary text-void hover:bg-primary/90"
                      )}
                    >
                      <Mic size={20} className={isRecording ? "animate-pulse" : ""} />
                      <span className="text-[11px] font-extrabold uppercase tracking-widest">
                        {isRecording ? "Stop & Process" : "Start Protocol"}
                      </span>
                    </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Add Subtask Input */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-void border border-border/40 rounded-2xl px-4 flex items-center focus-within:border-primary/40 transition-all">
                    <Plus size={16} className="text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="Divide objective into fragments..."
                      className="flex-1 bg-transparent border-none outline-none py-4 px-3 text-sm text-zinc-300 placeholder:text-zinc-700 font-medium"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newSubtask.trim() && addSubtaskMutation.mutate(newSubtask)}
                    />
                  </div>
                  <button 
                    onClick={() => addSubtaskMutation.mutate(newSubtask)}
                    disabled={!newSubtask.trim()}
                    className="w-14 h-14 bg-primary text-void rounded-2xl flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    <Plus size={24} />
                  </button>
                </div>

                {/* Subtasks List */}
                <div className="space-y-3">
                  {subtasks.map((st) => (
                    <div key={st.id} className="group flex items-center gap-4 bg-surface-lighter border border-border/10 rounded-2xl p-4 hover:border-border/30 transition-all card-shadow">
                      <button 
                        onClick={() => updateSubtaskMutation.mutate({ id: st.id, is_completed: !st.is_completed })}
                        className={cn(
                            "w-6 h-6 rounded-md border flex items-center justify-center transition-all shrink-0",
                            st.is_completed ? "bg-emerald-500 border-emerald-500 text-void" : "bg-void border-border/50 text-transparent"
                        )}
                      >
                         <CheckSquare size={14} />
                      </button>
                      
                      {editingSubtaskId === st.id ? (
                        <input 
                            autoFocus
                            className="flex-1 bg-void/50 border border-primary/30 rounded px-2 py-1 text-sm text-zinc-200 outline-none"
                            value={editedSubtaskTitle}
                            onChange={(e) => setEditedSubtaskTitle(e.target.value)}
                            onBlur={() => {
                                if (editedSubtaskTitle.trim() && editedSubtaskTitle !== st.title) {
                                    updateSubtaskMutation.mutate({ id: st.id, title: editedSubtaskTitle });
                                }
                                setEditingSubtaskId(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    if (editedSubtaskTitle.trim() && editedSubtaskTitle !== st.title) {
                                        updateSubtaskMutation.mutate({ id: st.id, title: editedSubtaskTitle });
                                    }
                                    setEditingSubtaskId(null);
                                }
                            }}
                        />
                      ) : (
                        <span 
                            className={cn(
                                "flex-1 text-sm font-medium transition-all cursor-text",
                                st.is_completed ? "text-zinc-600 line-through" : "text-zinc-200"
                            )}
                            onClick={() => {
                                setEditingSubtaskId(st.id);
                                setEditedSubtaskTitle(st.title);
                            }}
                        >
                            {st.title}
                        </span>
                      )}

                      <button 
                         onClick={() => deleteSubtaskMutation.mutate(st.id)}
                         className="w-8 h-8 rounded-lg text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {subtasks.length === 0 && !isLoadingSubtasks && (
                    <div className="py-12 text-center text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em] italic">
                      Structural integrity optimal - no fragments detected
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
