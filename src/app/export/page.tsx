"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  EyeOff,
  Filter,
  LayoutPanelTop,
  Sparkles,
  UserRound,
} from "lucide-react";

type CompletedTask = {
  id: string;
  title: string;
  energy_tag: "Grind" | "Creative" | "Shallow";
  project_id: string | null;
  updated_at: string;
  est_duration_minutes: number | null;
  projects?: {
    name: string;
    color?: string | null;
  } | null;
};

type Project = {
  id: string;
  name: string;
  color?: string | null;
};

type RangePreset = "today" | "last24" | "last7" | "custom";

const NAME_STORAGE_KEY = "entropy_share_name";
const SETTINGS_STORAGE_KEY = "entropy_export_settings";

type ExportSettings = {
  preset: RangePreset;
  customStart: string;
  customEnd: string;
  displayName: string;
  showTaskList: boolean;
  showProjectNames: boolean;
  blurTaskNames: boolean;
  blurProjectNames: boolean;
  showEnergyTags: boolean;
  showFocusTime: boolean;
  selectedProjects: string[];
  selectedEnergyTags: string[];
  attribution: "powered" | "shared" | "hidden";
};

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { start, end: now };
}

function getLast24Range() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

function getLast7Range() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function formatRangeLabel(preset: RangePreset, start: Date, end: Date) {
  if (preset === "today") return "Today";
  if (preset === "last24") return "Last 24 Hours";
  if (preset === "last7") return "Last 7 Days";
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

export default function ExportPage() {
  const supabase = createClient();

  const [preset, setPreset] = useState<RangePreset>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [cleanView, setCleanView] = useState(false);
  const [showExitHint, setShowExitHint] = useState(false);
  const [showTaskList, setShowTaskList] = useState(true);
  const [showProjectNames, setShowProjectNames] = useState(true);
  const [blurTaskNames, setBlurTaskNames] = useState(false);
  const [blurProjectNames, setBlurProjectNames] = useState(false);
  const [showEnergyTags, setShowEnergyTags] = useState(false);
  const [showFocusTime, setShowFocusTime] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedEnergyTags, setSelectedEnergyTags] = useState<string[]>([]);
  const [attribution, setAttribution] = useState<"powered" | "shared" | "hidden">("powered");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(NAME_STORAGE_KEY) : null;
    if (stored) setDisplayName(stored);
    const settings = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
    if (settings) {
      try {
        const parsed = JSON.parse(settings) as ExportSettings;
        if (parsed.preset) setPreset(parsed.preset);
        if (parsed.customStart) setCustomStart(parsed.customStart);
        if (parsed.customEnd) setCustomEnd(parsed.customEnd);
        if (parsed.displayName !== undefined) setDisplayName(parsed.displayName);
        if (parsed.showTaskList !== undefined) setShowTaskList(parsed.showTaskList);
        if (parsed.showProjectNames !== undefined) setShowProjectNames(parsed.showProjectNames);
        if (parsed.blurTaskNames !== undefined) setBlurTaskNames(parsed.blurTaskNames);
        if (parsed.blurProjectNames !== undefined) setBlurProjectNames(parsed.blurProjectNames);
        if (parsed.showEnergyTags !== undefined) setShowEnergyTags(parsed.showEnergyTags);
        if (parsed.showFocusTime !== undefined) setShowFocusTime(parsed.showFocusTime);
        if (parsed.selectedProjects) setSelectedProjects(parsed.selectedProjects);
        if (parsed.selectedEnergyTags) setSelectedEnergyTags(parsed.selectedEnergyTags);
        if (parsed.attribution) setAttribution(parsed.attribution);
      } catch {
        // Ignore corrupt settings
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(NAME_STORAGE_KEY, displayName);
  }, [displayName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: ExportSettings = {
      preset,
      customStart,
      customEnd,
      displayName,
      showTaskList,
      showProjectNames,
      blurTaskNames,
      blurProjectNames,
      showEnergyTags,
      showFocusTime,
      selectedProjects,
      selectedEnergyTags,
      attribution,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  }, [
    preset,
    customStart,
    customEnd,
    displayName,
    showTaskList,
    showProjectNames,
    blurTaskNames,
    blurProjectNames,
    showEnergyTags,
    showFocusTime,
    selectedProjects,
    selectedEnergyTags,
    attribution,
  ]);

  useEffect(() => {
    if (!cleanView) return;
    setShowExitHint(true);
    const timer = window.setTimeout(() => setShowExitHint(false), 1600);
    return () => window.clearTimeout(timer);
  }, [cleanView]);

  useEffect(() => {
    if (preset !== "custom") return;
    if (!customStart) {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      setCustomStart(iso);
    }
    if (!customEnd) {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      setCustomEnd(iso);
    }
  }, [preset, customStart, customEnd]);

  const { startDate, endDate, rangeLabel } = useMemo(() => {
    if (preset === "today") {
      const { start, end } = getTodayRange();
      return { startDate: start, endDate: end, rangeLabel: formatRangeLabel(preset, start, end) };
    }
    if (preset === "last24") {
      const { start, end } = getLast24Range();
      return { startDate: start, endDate: end, rangeLabel: formatRangeLabel(preset, start, end) };
    }
    if (preset === "last7") {
      const { start, end } = getLast7Range();
      return { startDate: start, endDate: end, rangeLabel: formatRangeLabel(preset, start, end) };
    }
    const start = customStart ? new Date(`${customStart}T00:00:00`) : getTodayRange().start;
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
    return { startDate: start, endDate: end, rangeLabel: formatRangeLabel(preset, start, end) };
  }, [preset, customStart, customEnd]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "export"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, color").order("name", { ascending: true });
      return (data || []) as Project[];
    },
  });

  const { data: completedTasks = [] } = useQuery({
    queryKey: ["tasks", "completed", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, energy_tag, project_id, updated_at, est_duration_minutes, projects(name, color)")
        .eq("state", "Done")
        .gte("updated_at", startDate.toISOString())
        .lte("updated_at", endDate.toISOString())
        .order("updated_at", { ascending: false });
      return (data || []) as CompletedTask[];
    },
  });

  const filteredTasks = useMemo(() => {
    return completedTasks.filter((task) => {
      if (selectedProjects.length > 0 && task.project_id && !selectedProjects.includes(task.project_id)) {
        return false;
      }
      if (selectedProjects.length > 0 && !task.project_id) {
        return false;
      }
      if (selectedEnergyTags.length > 0 && !selectedEnergyTags.includes(task.energy_tag)) {
        return false;
      }
      return true;
    });
  }, [completedTasks, selectedProjects, selectedEnergyTags]);

  const totalMinutes = filteredTasks.reduce((sum, task) => sum + (task.est_duration_minutes || 0), 0);
  const previewTasks = showTaskList ? filteredTasks.slice(0, 8) : [];
  const remainingCount = showTaskList ? Math.max(0, filteredTasks.length - previewTasks.length) : 0;

  const nameLabel = displayName.trim() || "Your Name";
  const attributionLabel =
    attribution === "powered" ? "Powered by Entropy" : attribution === "shared" ? "Shared from Entropy" : "";

  return (
    <div className="px-4 sm:px-6 pt-8 pb-20 max-w-6xl mx-auto">
      <AnimatePresence initial={false}>
        {!cleanView && (
          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 space-y-4"
          >
            <div>
              <p className="text-[9px] font-bold text-primary uppercase tracking-[0.35em] mb-1">Export</p>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Share Progress
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="h-9 px-4 sm:h-10 rounded-2xl bg-surface border border-border/40 text-zinc-200 flex items-center gap-2 card-shadow hover:opacity-90 transition-all text-[10px] font-bold tracking-[0.2em]"
              >
                Back
              </Link>
              <button
                type="button"
                onClick={() => setCleanView(true)}
                className="h-9 px-4 sm:h-10 rounded-2xl bg-primary text-void flex items-center gap-2 card-shadow hover:opacity-90 transition-all text-[10px] font-black tracking-[0.2em]"
              >
                Screenshot Mode
              </button>
              <p className="text-[10px] text-zinc-500">Hide controls for a clean capture.</p>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className={cn("grid gap-6", cleanView ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[320px_1fr]")}>
        <AnimatePresence initial={false}>
          {!cleanView && (
            <motion.section
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <details className="bg-surface/50 border border-border/30 rounded-[1.5rem] p-4" open>
                <summary className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 cursor-pointer">
                  <CalendarDays size={12} /> Time Range
                </summary>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "today", label: "Today" },
                      { id: "last24", label: "Last 24h" },
                      { id: "last7", label: "Last 7d" },
                      { id: "custom", label: "Custom" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreset(item.id as RangePreset)}
                        className={cn(
                          "rounded-xl px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-all",
                          preset === item.id
                            ? "bg-primary text-void"
                            : "bg-surface border border-border/40 text-zinc-300 hover:text-white"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {preset === "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Start</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(event) => setCustomStart(event.target.value)}
                          className="w-full rounded-xl bg-void border border-border/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">End</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(event) => setCustomEnd(event.target.value)}
                          className="w-full rounded-xl bg-void border border-border/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </details>

              <details className="bg-surface/50 border border-border/30 rounded-[1.5rem] p-4" open>
                <summary className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 cursor-pointer">
                  <UserRound size={12} /> Identity
                </summary>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-2xl bg-void border border-border/40 px-4 py-2 text-sm text-white"
                  />
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Attribution</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "powered", label: "Powered" },
                        { id: "shared", label: "Shared" },
                        { id: "hidden", label: "Hidden" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAttribution(item.id as typeof attribution)}
                          className={cn(
                            "rounded-xl px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-all",
                            attribution === item.id
                              ? "bg-primary text-void"
                              : "bg-surface border border-border/40 text-zinc-300 hover:text-white"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              <details className="bg-surface/50 border border-border/30 rounded-[1.5rem] p-4">
                <summary className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 cursor-pointer">
                  <Filter size={12} /> Filters
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Projects</label>
                    <div className="flex flex-wrap gap-2">
                      {projects.map((project) => {
                        const active = selectedProjects.includes(project.id);
                        return (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() =>
                              setSelectedProjects((prev) =>
                                active ? prev.filter((id) => id !== project.id) : [...prev, project.id]
                              )
                            }
                            className={cn(
                              "rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] transition-all border",
                              active
                                ? "bg-primary text-void border-primary"
                                : "bg-void border-border/40 text-zinc-400 hover:text-white"
                            )}
                            style={
                              !active && project.color
                                ? { borderColor: project.color, color: project.color }
                                : undefined
                            }
                          >
                            {project.name}
                          </button>
                        );
                      })}
                      {projects.length === 0 && (
                        <div className="text-[11px] text-zinc-500">No projects found.</div>
                      )}
                    </div>
                    {selectedProjects.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProjects([])}
                        className="text-[10px] font-semibold text-primary hover:opacity-80"
                      >
                        Clear project selection
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Energy Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {["Grind", "Creative", "Shallow"].map((tag) => {
                        const active = selectedEnergyTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setSelectedEnergyTags((prev) =>
                                active ? prev.filter((id) => id !== tag) : [...prev, tag]
                              )
                            }
                            className={cn(
                              "rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] transition-all",
                              active
                                ? "bg-primary text-void"
                                : "bg-void border border-border/40 text-zinc-400 hover:text-white"
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    {selectedEnergyTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedEnergyTags([])}
                        className="text-[10px] font-semibold text-primary hover:opacity-80"
                      >
                        Clear energy tags
                      </button>
                    )}
                  </div>
                </div>
              </details>

              <details className="bg-surface/50 border border-border/30 rounded-[1.5rem] p-4" open>
                <summary className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 cursor-pointer">
                  <LayoutPanelTop size={12} /> Display
                </summary>
                <div className="mt-4 space-y-3 text-xs text-zinc-300">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showTaskList}
                      onChange={(event) => setShowTaskList(event.target.checked)}
                      className="accent-primary"
                    />
                    Show task list
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showProjectNames}
                      onChange={(event) => setShowProjectNames(event.target.checked)}
                      className="accent-primary"
                    />
                    Show project names
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showEnergyTags}
                      onChange={(event) => setShowEnergyTags(event.target.checked)}
                      className="accent-primary"
                    />
                    Show energy tags
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showFocusTime}
                      onChange={(event) => setShowFocusTime(event.target.checked)}
                      className="accent-primary"
                    />
                    Show focus time
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={blurTaskNames}
                      onChange={(event) => setBlurTaskNames(event.target.checked)}
                      className="accent-primary"
                    />
                    Blur task names
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={blurProjectNames}
                      onChange={(event) => setBlurProjectNames(event.target.checked)}
                      className="accent-primary"
                    />
                    Blur project names
                  </label>
                </div>
              </details>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="space-y-4">
          <div className="bg-gradient-to-br from-surface via-[#101015] to-[#0a0a0c] border border-border/40 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 md:p-10 card-shadow">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">Progress Report</p>
                <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight text-white">
                  {nameLabel}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-2">{rangeLabel}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary">
                <Sparkles size={12} />
                Entropy
              </div>
            </div>

            <div
              className={cn(
                "grid gap-3 sm:gap-4 mb-5",
                showFocusTime ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2"
              )}
            >
              <div className="rounded-2xl bg-void/60 border border-border/40 p-3 sm:p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Completed</p>
                <p className="text-2xl sm:text-3xl font-black text-white mt-2">{filteredTasks.length}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Tasks</p>
              </div>
              {showFocusTime && (
                <div className="rounded-2xl bg-void/60 border border-border/40 p-3 sm:p-4">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Focus Time</p>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-2">
                    {Math.round(totalMinutes / 60) || 0}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1">Hours</p>
                </div>
              )}
              <div className="rounded-2xl bg-void/60 border border-border/40 p-3 sm:p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Range</p>
                <p className="text-sm sm:text-base font-semibold text-white mt-2">{rangeLabel}</p>
              </div>
            </div>

            {showTaskList && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-400">
                  <CheckCircle2 size={12} /> Completed Tasks
                </div>
                <div className="space-y-3">
                  {previewTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-void/60 border border-border/40 px-3 sm:px-4 py-3"
                    >
                      <div className="space-y-1">
                        <p
                          className={cn(
                            "text-sm font-semibold text-white flex items-center gap-2",
                            blurTaskNames && "blur-sm select-none"
                          )}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.projects?.color || "#52525b" }}
                          />
                          {task.title}
                        </p>
                        {showProjectNames && (
                          <p
                            className={cn(
                              "text-[10px] uppercase tracking-[0.2em] text-zinc-500",
                              blurProjectNames && "blur-sm select-none"
                            )}
                          >
                            {task.projects?.name || "Inbox"}
                          </p>
                        )}
                      </div>
                      {showEnergyTags && (
                        <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">
                          {task.energy_tag}
                        </div>
                      )}
                    </div>
                  ))}
                  {previewTasks.length === 0 && (
                    <div className="rounded-2xl bg-void/60 border border-border/40 px-4 py-5 text-xs text-zinc-500 flex items-center gap-3">
                      <EyeOff size={14} />
                      No completed tasks in this range.
                    </div>
                  )}
                  {remainingCount > 0 && (
                    <div className="text-[10px] text-zinc-500">+{remainingCount} more tasks completed</div>
                  )}
                </div>
              </div>
            )}

            {attributionLabel && (
              <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-zinc-500">{attributionLabel}</div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {cleanView && (
          <>
            <motion.button
              type="button"
              aria-label="Exit screenshot mode"
              onClick={() => setCleanView(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 cursor-pointer bg-transparent"
            />
            {showExitHint && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.9, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-[10px] uppercase tracking-[0.3em] text-zinc-400 bg-void/80 border border-border/40 rounded-full px-4 py-2"
              >
                Tap anywhere to edit
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
