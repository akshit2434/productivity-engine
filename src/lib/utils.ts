import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function parseDuration(input: string): number | null {
  if (!input || input.toLowerCase() === "none" || input === "0") return null;
  
  // Clean input
  const cleanInput = input.toLowerCase().trim();
  
  // Match hours (e.g., 1.5h, 2 hrs, 1 hour)
  const hMatch = cleanInput.match(/(\d+(\.\d+)?)\s*(h|hour|hr)s?/);
  // Match minutes (e.g., 30m, 15 mins, 20 min, 10 minutes)
  const mMatch = cleanInput.match(/(\d+)\s*(m|min|minute)s?/);
  
  let totalMinutes = 0;
  if (hMatch) totalMinutes += parseFloat(hMatch[1]) * 60;
  if (mMatch) totalMinutes += parseInt(mMatch[1]);
  
  // If no units found, assume minutes if numeric
  if (!hMatch && !mMatch) {
    const numeric = parseFloat(cleanInput);
    if (!isNaN(numeric)) totalMinutes = numeric;
  }
  
  return totalMinutes > 0 ? Math.round(totalMinutes) : null;
}
export function formatTimeRemaining(date: Date): { label: string; urgency: 'none' | 'low' | 'medium' | 'high' } {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = diff / (1000 * 60 * 60);
  
  if (diff < 0) return { label: "Overdue", urgency: 'high' };
  if (hours < 2) return { label: `${Math.round(diff / (1000 * 60))}m`, urgency: 'high' };
  if (hours < 24) return { label: `${Math.round(hours)}h`, urgency: 'medium' };
  if (hours < 48) return { label: "Tomorrow", urgency: 'low' };
  
  return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgency: 'none' };
}
