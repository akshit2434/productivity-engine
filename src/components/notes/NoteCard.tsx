"use client";

import { Note } from "@/types/database";
import { Book, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getProjectColor } from "@/lib/colors";
import { motion } from "framer-motion";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  const projectColor = getProjectColor(note.projects?.name || "Inbox", note.projects?.color);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-surface/50 border border-border/20 rounded-[1.5rem] p-5 cursor-pointer hover:border-border/50 transition-all card-shadow group"
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
          <span 
            className="text-[9px] font-bold uppercase tracking-[0.2em] font-mono"
            style={{ color: projectColor }}
          >
            {note.projects?.name || "Inbox"}
          </span>
          <div className="flex items-center gap-1.5 text-zinc-600 text-[9px] font-bold uppercase tracking-wider">
            <Clock size={10} />
            {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
          </div>
        </div>

        <h3 className="text-sm font-extrabold text-white tracking-tight mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {note.title}
        </h3>

        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 italic">
          {note.content || "Empty strategy log..."}
        </p>
        
        {note.task_id && (
           <div className="mt-4 pt-3 border-t border-border/5 flex items-center gap-2">
             <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                <Book size={8} className="text-primary" />
             </div>
             <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Linked to Task</span>
           </div>
        )}
      </div>
    </motion.div>
  );
}
