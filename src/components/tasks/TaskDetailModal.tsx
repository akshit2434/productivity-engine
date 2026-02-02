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
  Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskNote, Subtask } from "@/types/database";
import { Task } from "@/lib/engine";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useEffect, useRef } from "react";

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
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editedSubtaskTitle, setEditedSubtaskTitle] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    setEditedTitle(task.title);
    setEditedDuration((task.durationMinutes || 30).toString());
  }, [task.id, task.title, task.durationMinutes]);

  // Queries
  const { data: notes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ["tasks", task.id, "notes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_notes")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });
      return (data || []) as TaskNote[];
    },
    enabled: isOpen,
  });

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

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: any) => {
      await supabase.from("tasks").update(updates).eq("id", task.id);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      // Map domain updates to domain names for the optimistic state
      const domainUpdates: any = {};
      if (updates.title) domainUpdates.title = updates.title;
      if (updates.est_duration_minutes) domainUpdates.durationMinutes = updates.est_duration_minutes;
      
      queryClient.setQueryData(["tasks", "active"], (old: any) => 
        old?.map((t: any) => t.id === task.id ? { ...t, ...domainUpdates } : t)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
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

  const addNoteMutation = useMutation({
    mutationFn: async ({ content, isVoice }: { content: string; isVoice?: boolean }) => {
      await supabase.from("task_notes").insert({ 
        task_id: task.id, 
        content, 
        is_voice_transcript: !!isVoice 
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "notes"] }),
    onSuccess: () => setNewNote(""),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("task_notes").delete().eq("id", id);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "notes"] }),
  });

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

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Transcription failed");
      const { text } = await response.json();
      
      addNoteMutation.mutate({ content: text, isVoice: true });
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
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2 block font-mono">
                  {task.projectName || "Inbox"}
                </span>
                
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
              <button 
                onClick={onClose}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl bg-void border border-border/50 text-zinc-500 hover:text-white transition-all ml-4"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-4">
                <div className="bg-void/50 border border-border/20 rounded-xl flex items-center gap-3 px-4 py-2 hover:border-primary/30 transition-all cursor-pointer group/dur">
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
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest shrink-0">Minutes</span>
                </div>
                <div className={cn(
                    "px-4 py-2 border rounded-xl flex items-center gap-2",
                    task.energyTag === "Grind" ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                    task.energyTag === "Creative" ? "bg-purple-500/10 border-purple-500/20 text-purple-500" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-500"
                )}>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{task.energyTag}</span>
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
              Intelligence Log {notes.length > 0 && `(${notes.length})`}
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
              <div className="space-y-6">
                {/* Add Note Input */}
                <div className="bg-void border border-border/40 rounded-3xl p-4 focus-within:border-primary/40 transition-all group">
                  <textarea 
                    placeholder="Enter strategic insights..."
                    className="w-full bg-transparent border-none outline-none text-sm text-zinc-300 placeholder:text-zinc-700 resize-none h-20 px-2"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/10">
                    <button 
                      onClick={handleToggleRecording}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        isRecording ? "bg-rose-500/20 text-rose-500 animate-pulse" : "bg-zinc-900 text-zinc-500 hover:text-primary hover:bg-zinc-800"
                      )}
                    >
                      {isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                    <button 
                      onClick={() => addNoteMutation.mutate({ content: newNote })}
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                      className="bg-primary hover:bg-primary/90 text-void px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {addNoteMutation.isPending ? "Syncing..." : <>Save Log <ChevronRight size={14} /></>}
                    </button>
                  </div>
                </div>

                {isTranscribing && (
                    <div className="flex items-center gap-3 px-6 py-4 bg-primary/5 rounded-2xl border border-primary/20 animate-pulse">
                        <Loader2 size={16} className="text-primary animate-spin" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Decoding Audio Transmission...</span>
                    </div>
                )}

                {/* Notes List */}
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="group relative bg-surface-lighter border border-border/10 rounded-2xl p-5 hover:border-border/30 transition-all card-shadow">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                {new Date(note.created_at).toLocaleDateString()}
                             </span>
                             {note.is_voice_transcript && (
                                <span className="text-[9px] font-bold text-primary/50 uppercase tracking-widest flex items-center gap-1">
                                    <Mic size={10} /> Voice
                                </span>
                             )}
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </div>
                        <button 
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          className="w-8 h-8 rounded-lg bg-rose-500/5 text-rose-500/20 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && !isLoadingNotes && (
                    <div className="py-12 text-center text-zinc-700 text-[10px] font-bold uppercase tracking-[0.2em] italic">
                      No data logs available for this target
                    </div>
                  )}
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
