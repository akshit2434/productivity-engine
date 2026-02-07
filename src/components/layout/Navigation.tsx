"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, FolderOpen, BarChart3, LogOut, Sparkles, Book, Star, BookOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/db";

const NAV_ITEMS = [
  { label: "Focus", href: "/", icon: Home },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "History", href: "/history", icon: List },
  { label: "Intel", href: "/docs", icon: BookOpen },
  { label: "Projects", href: "/portfolio", icon: FolderOpen },
  { label: "Analytics", href: "/review", icon: BarChart3 },
  { label: "Assistant", href: "/chat", icon: Sparkles },
];

import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { mapTaskData } from "@/lib/engine";

export function Navigation() {
  const pathname = usePathname();
  const [showCatchUp, setShowCatchUp] = useState(false);
  const isChat = pathname === '/chat';
  
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Query for unread thoughts
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread_thoughts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      return count || 0;
    },
    refetchInterval: 30000, // Poll every 30 seconds
    enabled: !isChat
  });

  const handlePrefetch = (href: string) => {
    // ... existing prefetch logic remains the same
    if (href === "/history") {
      queryClient.prefetchQuery({
        queryKey: ['history'],
        queryFn: async () => {
          const { data } = await supabase
            .from('tasks')
            .select('id, title, updated_at, project_id, est_duration_minutes, projects(name)')
            .eq('state', 'Done')
            .order('updated_at', { ascending: false });
          return (data || []).map((t: any) => ({
            ...t,
            project_name: t.projects?.name || 'Inbox'
          }));
        }
      });
    } else if (href === "/notes") {
      queryClient.prefetchQuery({
        queryKey: ['notes'],
        queryFn: async () => {
          const { data } = await supabase.from('notes').select('*, projects(name, color)').order('updated_at', { ascending: false });
          return data || [];
        }
      });
    } else if (href === "/portfolio") {
      queryClient.prefetchQuery({
        queryKey: ['projects'],
        queryFn: async () => {
          const { data } = await supabase.from('projects').select('*').order('tier', { ascending: true });
          return data || [];
        }
      });
    } else if (href === "/") {
      queryClient.prefetchQuery({
        queryKey: ['tasks', 'active'],
        queryFn: async () => {
          const { data } = await supabase
            .from('tasks')
            .select(`
              id, title, project_id, due_date, est_duration_minutes, energy_tag,
              last_touched_at, recurrence_interval_days,
              projects(name, tier, decay_threshold_days)
            `)
            .eq('state', 'Active')
            .order('created_at', { ascending: false });
          return (data || []).map(mapTaskData);
        }
      });
    } else if (href === "/docs") {
      queryClient.prefetchQuery({
        queryKey: ['documentation'],
        queryFn: async () => {
          return await db.documentation.toArray();
        }
      });
    }
  };

  if (isChat) return null;

  return (
    <>
      {/* Catch Up Sparkle Button - Fixed Top Right */}
      <motion.button
        onClick={() => setShowCatchUp(true)}
        className={cn(
          "fixed top-6 right-6 z-50 w-12 h-12 rounded-2xl glass flex items-center justify-center card-shadow transition-all",
          unreadCount > 0 ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"
        )}
        whileTap={{ scale: 0.95 }}
      >
        <Star size={20} fill={unreadCount > 0 ? "currentColor" : "none"} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-void text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        )}
        {unreadCount > 0 && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-amber-500/50"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Catch Up Overlay */}
      <AnimatePresence>
        {showCatchUp && (
          <CatchUpOverlay onClose={() => setShowCatchUp(false)} />
        )}
      </AnimatePresence>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[95%] glass rounded-3xl p-1.5 card-shadow">
      <div className="flex items-center justify-between">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => handlePrefetch(item.href)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all duration-300 min-w-0 relative",
                isActive ? "text-primary" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className="absolute inset-0 bg-primary/10 rounded-2xl z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
              
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1.5 z-10"
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-[8px] font-bold uppercase tracking-wider truncate w-full text-center px-1">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
      </nav>
    </>
  );
}

// Catch Up Overlay Component
function CatchUpOverlay({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: thoughts = [], isLoading } = useQuery({
    queryKey: ['unread_thoughts_list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notes').update({ is_read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['unread_thoughts'] });
    queryClient.invalidateQueries({ queryKey: ['unread_thoughts_list'] });
  };

  const markAllRead = async () => {
    await supabase.from('notes').update({ is_read: true }).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['unread_thoughts'] });
    queryClient.invalidateQueries({ queryKey: ['unread_thoughts_list'] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-void/80 backdrop-blur-md" 
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md max-h-[70vh] bg-surface border border-border rounded-3xl p-6 card-shadow overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <Star size={14} fill="currentColor" /> Catch Up
          </h2>
          <div className="flex gap-2">
            {thoughts.length > 0 && (
              <button 
                onClick={markAllRead}
                className="text-[10px] font-bold uppercase tracking-tight text-zinc-500 hover:text-amber-400 transition-colors"
              >
                Mark All Read
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent animate-spin rounded-full" />
            </div>
          ) : thoughts.length === 0 ? (
            <div className="text-center py-10 text-zinc-600">
              <Star size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs">No unread thoughts right now.</p>
            </div>
          ) : (
            thoughts.map((thought: any) => (
              <motion.div
                key={thought.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-void/50 border border-border/50 rounded-2xl p-4 group"
              >
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{thought.content}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/30">
                  <span className="text-[10px] text-zinc-600">
                    {new Date(thought.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => markAsRead(thought.id)}
                    className="text-[10px] font-bold uppercase text-zinc-500 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Mark Read
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
