"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { Note } from "@/types/database";
import { 
  Plus, 
  Search, 
  Filter, 
  Book, 
  Loader2, 
  LayoutGrid, 
  LayoutList,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { db } from "@/lib/db";
import { processOutbox } from "@/lib/sync";

export default function NotesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | "all">("all");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const allNotes = await db.notes.toArray();
      const sorted = allNotes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      
      return await Promise.all(sorted.map(async (n) => {
        const project = n.project_id ? await db.projects.get(n.project_id) : null;
        return { 
          ...n, 
          projects: project ? { name: project.name, color: project.color || "" } : undefined 
        } as Note;
      }));
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      return await db.projects.orderBy('name').toArray();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const newNote = {
        id: crypto.randomUUID(),
        title: "New Strategy",
        content: "",
        project_id: selectedProjectId === "all" ? undefined : selectedProjectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await db.notes.add(newNote);
      await db.recordAction("notes", "insert", newNote);
      processOutbox().catch(() => {});
      
      return newNote as any;
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedNote(newNote);
    },
  });

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(search.toLowerCase()) || 
                         note.content?.toLowerCase().includes(search.toLowerCase());
    const matchesProject = selectedProjectId === "all" || note.project_id === selectedProjectId;
    return matchesSearch && matchesProject;
  });

  return (
    <div className="px-6 pt-12 pb-32 max-w-6xl mx-auto min-h-screen">
      <header className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1">Knowledge Archive</p>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Notes
            </h1>
          </div>
          <button 
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="h-14 px-8 rounded-2xl bg-primary text-void flex items-center justify-center gap-3 card-shadow hover:opacity-90 transition-all font-black text-xs tracking-[0.2em]"
          >
            {createMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
            <span>INITIALIZE NOTE</span>
          </button>
        </div>
      </header>

      {/* Filters & Tools */}
      <div className="bg-surface/30 backdrop-blur-md border border-border/20 rounded-[2rem] p-4 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full bg-void/50 border border-border/20 rounded-xl px-4 flex items-center focus-within:border-primary/40 transition-all">
          <Search size={16} className="text-zinc-600" />
          <input 
            type="text" 
            placeholder="Search through intelligence..."
            className="flex-1 bg-transparent border-none outline-none py-3 px-3 text-sm text-zinc-300 placeholder:text-zinc-700 font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex w-full md:w-auto gap-3">
          <div className="relative group">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
            <select 
              className="bg-void/50 border border-border/20 rounded-xl pl-10 pr-8 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-void/50 border border-border/20 rounded-xl p-1 flex">
            <button 
              onClick={() => setViewMode("grid")}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all",
                viewMode === "grid" ? "bg-surface text-primary shadow-sm" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-all",
                viewMode === "list" ? "bg-surface text-primary shadow-sm" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              <LayoutList size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Notes Display */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4 opacity-50">
          <Loader2 size={32} className="text-primary animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Synchronizing Archive...</p>
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className={cn(
          "grid gap-4",
          viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredNotes.map((note) => (
            <NoteCard 
              key={note.id} 
              note={note} 
              onClick={() => setSelectedNote(note)} 
            />
          ))}
        </div>
      ) : (
        <div className="py-32 text-center border border-dashed border-border rounded-[3rem] bg-surface/20">
          <div className="max-w-xs mx-auto flex flex-col items-center">
            <Book size={48} className="text-zinc-800 mb-6" />
            <h3 className="text-sm font-bold text-zinc-600 uppercase tracking-widest mb-2">Archive Vacant</h3>
            <p className="text-[10px] text-zinc-700 leading-relaxed font-medium">
              No intelligence has been logged in this sector. Standardized records await initialization.
            </p>
            <button 
              onClick={() => createMutation.mutate()}
              className="mt-8 text-primary hover:underline text-[10px] font-black uppercase tracking-[0.2em]"
            >
              Start Note Dump
            </button>
          </div>
        </div>
      )}

      {/* Editor Overlay */}
      <AnimatePresence>
        {selectedNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void/90 backdrop-blur-xl"
              onClick={() => setSelectedNote(null)}
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full h-full"
            >
              <NoteEditor 
                note={selectedNote} 
                onClose={() => setSelectedNote(null)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
