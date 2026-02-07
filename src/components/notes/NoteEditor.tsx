"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Save, 
  Trash2, 
  Loader2, 
  Sparkles, 
  Edit3, 
  Eye, 
  Maximize2, 
  Minimize2,
  ChevronLeft,
  Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Note } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { getProjectColor } from "@/lib/colors";
import { useScroll, useTransform } from "framer-motion";
import { useOnlineStatus } from "@/hooks/use-online-status";

import { db } from "@/lib/db";
import { processOutbox } from "@/lib/sync";

interface NoteEditorProps {
  note: Note;
  onClose: () => void;
}

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const isOnline = useOnlineStatus();

  // Mobile optimization: iOS-style physical header transition
  const headerHeight = useTransform(scrollY, [0, 100], ["180px", "64px"]);
  const titleScale = useTransform(scrollY, [0, 100], [1, 0.45]);
  const titleY = useTransform(scrollY, [0, 100], [20, -1]); // Centered in the 64px header when scrollY >= 100
  const titleX = useTransform(scrollY, [0, 100], [0, 48]);
  const projectOpacity = useTransform(scrollY, [0, 50], [1, 0]);
  const vanishOpacity = useTransform(scrollY, [0, 30], [1, 0]);
  const headerBgOpacity = useTransform(scrollY, [0, 50], [0, 1]);

  const [isEditing, setIsEditing] = useState(false);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || "");
  const [isRefining, setIsRefining] = useState(false);
  const [projectId, setProjectId] = useState(note.project_id);

  // Sync local state with props if they change from outside
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || "");
    setProjectId(note.project_id);
  }, [note.id, note.title, note.content, note.project_id]);

  // Fetch Projects for selector from local DB
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      return await db.projects.toArray();
    },
  });

  const selectedProject = projects.find(p => p.id === projectId);
  const projectColor = getProjectColor(selectedProject?.name || "Inbox", selectedProject?.color);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Note>) => {
      // Dexie doesn't like null in updates if they don't match the schema perfectly
      const cleanUpdates: any = { ...updates, updated_at: new Date().toISOString() };
      if (cleanUpdates.project_id === null) cleanUpdates.project_id = undefined;
      
      await db.notes.update(note.id, cleanUpdates);
      await db.recordAction("notes", "update", { id: note.id, ...cleanUpdates });
      processOutbox().catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await db.notes.delete(note.id);
      await db.recordAction("notes", "delete", { id: note.id });
      processOutbox().catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      onClose();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ title, content });
    setIsEditing(false);
  };

  const handleRefine = async () => {
    setIsRefining(true);
    try {
      const response = await fetch("/api/notes/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title }),
      });
      const data = await response.json();
      if (data.refinedContent) {
        setContent(data.refinedContent);
        updateMutation.mutate({ content: data.refinedContent });
      }
    } catch (error) {
      console.error("Failed to refine note:", error);
    } finally {
      setIsRefining(false);
    }
  };

  // Auto-save title on blur if changed
  const handleTitleBlur = () => {
    if (title !== note.title) {
      updateMutation.mutate({ title });
    }
  };

  return (
    <div className="flex flex-col h-full bg-void md:bg-void/50 backdrop-blur-3xl overflow-hidden relative">
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-64 blur-[120px] opacity-20 pointer-events-none z-0"
        style={{ backgroundColor: projectColor }}
      />

      <motion.div 
        style={{ height: headerHeight }}
        className="sticky top-0 z-50 bg-void/80 backdrop-blur-2xl border-b border-border/5"
      >
        <motion.div 
          style={{ opacity: headerBgOpacity }}
          className="absolute inset-0 bg-surface/40 pointer-events-none" 
        />
        
        <div className="max-w-4xl mx-auto h-full px-6 md:px-12 relative flex flex-col justify-center">
          {/* Vanish Button - Fades out on scroll */}
          <motion.button 
            style={{ opacity: vanishOpacity }}
            onClick={onClose}
            className="absolute left-6 md:left-12 top-8 flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] hover:text-white transition-all group"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Archive
          </motion.button>

          {/* Collapsed Back Button - Appears when header is small */}
          <motion.button
            style={{ opacity: useTransform(scrollY, [70, 100], [0, 1]) }}
            onClick={onClose}
            className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-all transform-gpu"
          >
            <ChevronLeft size={20} />
          </motion.button>
          
          <div className="relative">
            <motion.div 
              style={{ scale: titleScale, y: titleY, x: titleX, originX: 0 }}
              className="flex items-center h-full"
            >
              <input 
                className="text-3xl md:text-5xl font-extrabold text-white tracking-tighter bg-transparent border-none outline-none w-full placeholder:opacity-10 py-1"
                style={{ height: '1.2em' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Designation..."
              />
            </motion.div>
            
            <motion.div style={{ opacity: projectOpacity, y: titleY }} className="flex items-center gap-3 mt-1">
               <div className="relative group/select h-7">
                 <select 
                   className="text-[9px] font-black uppercase tracking-[0.3em] font-mono bg-zinc-900/50 border border-border/20 rounded-lg px-3 h-full cursor-pointer hover:border-primary/40 transition-all appearance-none pr-7"
                   style={{ color: projectColor }}
                   value={projectId || "NONE"}
                   onChange={(e) => {
                     const val = e.target.value === "NONE" ? null : e.target.value;
                     setProjectId(val);
                     updateMutation.mutate({ project_id: val });
                   }}
                 >
                   <option value="NONE" className="bg-void text-zinc-400">Inbox</option>
                   {projects.map(p => (
                     <option key={p.id} value={p.id} className="bg-void text-zinc-300">{p.name}</option>
                   ))}
                 </select>
               </div>

               {updateMutation.isPending && (
                  <span className="text-[8px] font-bold text-primary/50 uppercase tracking-widest flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-full animate-pulse border border-primary/10">
                      <Loader2 size={6} className="animate-spin" />
                  </span>
               )}
            </motion.div>
          </div>

          <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button 
              onClick={() => {
                if (window.confirm("Vanish this strategy log?")) {
                  deleteMutation.mutate();
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-rose-500/50 hover:text-rose-500 transition-all"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white transition-all md:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Toolbar - Dynamic Vertical Alignment */}
      <motion.div 
        className="sticky top-[63px] md:top-[63px] z-40 bg-void/60 backdrop-blur-xl border-b border-border/5 px-6 md:px-12 py-3 relative z-10"
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
          <div className="flex gap-4 md:gap-8">
             <button 
               onClick={() => setIsEditing(false)}
               className={cn(
                 "text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 pb-2 relative",
                 !isEditing ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
               )}
             >
               View
               {!isEditing && <motion.div layoutId="editor-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
             </button>
             <button 
               onClick={() => setIsEditing(true)}
               className={cn(
                 "text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 pb-2 relative",
                 isEditing ? "text-primary" : "text-zinc-600 hover:text-zinc-400"
               )}
             >
               Engineer
               {isEditing && <motion.div layoutId="editor-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
             </button>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleRefine}
              disabled={isRefining || !content || !isOnline}
              className={cn(
                "h-8 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all px-4 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 disabled:opacity-30 group",
                !isOnline && "cursor-not-allowed"
              )}
              title={isOnline ? "Refine with AI" : "AI refinement requires connection"}
            >
              <Sparkles size={12} className={cn(isRefining && "animate-spin")} />
              {isOnline ? "Refine" : "Offline"}
            </button>
            {isEditing && (
              <button 
                onClick={handleSave}
                className="h-8 bg-primary text-void hover:scale-105 transition-all px-5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                Commit
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative"
      >
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-8 md:py-16">


        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.textarea
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full bg-transparent border-none outline-none text-zinc-300 text-sm leading-relaxed resize-none font-mono custom-scrollbar min-h-[400px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Inject strategic dumps here using Markdown..."
              autoFocus
            />
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="prose prose-invert max-w-none prose-sm text-zinc-400"
            >
              {content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-24 opacity-30 grayscale pointer-events-none">
                    <Sparkles size={48} className="mb-4 text-zinc-700" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">No Intelligence Logged</p>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="mt-6 pointer-events-auto text-primary hover:underline text-[10px] font-bold uppercase tracking-widest"
                    >
                      Begin Strategic Entry
                    </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {isRefining && (
          <div className="absolute inset-0 bg-void/60 backdrop-blur-md flex flex-col items-center justify-center z-20">
             <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 animate-ping absolute inset-0" />
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center relative border border-primary/30">
                   <Sparkles size={32} className="text-primary animate-pulse" />
                </div>
             </div>
             <p className="mt-12 text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Synchronizing Neural Weights...</p>
             <p className="mt-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Constructing Structured Logic</p>
          </div>
        )}
      </div>
    </div>
  );
}

