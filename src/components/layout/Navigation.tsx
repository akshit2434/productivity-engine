"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, FolderOpen, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Focus", href: "/", icon: Home },
  { label: "History", href: "/history", icon: List },
  { label: "Projects", href: "/portfolio", icon: FolderOpen },
  { label: "Analytics", href: "/review", icon: BarChart3 },
];

import { useQueryClient } from "@tanstack/react-query";
import { mapTaskData } from "@/lib/engine";

export function Navigation() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const handlePrefetch = (href: string) => {
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
    }
  };

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[90%] glass rounded-3xl p-1.5 card-shadow">
      <div className="flex items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => handlePrefetch(item.href)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300",
                isActive ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <Icon size={18} />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
