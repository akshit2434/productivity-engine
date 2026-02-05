import React from "react";
import { useUserStore, TimeConstraint } from "@/store/userStore";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

const TIME_OPTIONS: { label: string; value: TimeConstraint }[] = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h+", value: 120 },
  { label: "All", value: null },
];

export function TimeAvailableSelector() {
  const { timeAvailable, setTimeAvailable } = useUserStore();

  return (
    <div className="flex items-center gap-3 mb-0 md:mb-6 bg-surface border border-border rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Clock size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Limit</span>
      </div>
      <div className="h-4 w-px bg-zinc-800" />
      <div className="flex flex-1 justify-between">
        {TIME_OPTIONS.map((opt) => {
          const isActive = timeAvailable === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => setTimeAvailable(opt.value)}
              className={cn(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded transition-all",
                isActive 
                  ? "bg-primary/20 text-primary font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
