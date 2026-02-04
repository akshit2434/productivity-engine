/**
 * Utility for project color assignment.
 * Generates dark-mode friendly colors that are consistent for the same project name.
 */

// Preset palette of dark-mode friendly colors (high saturation, medium lightness for visibility)
export const PRESET_COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#6366f1", // Indigo
  "#a855f7", // Purple
];

/**
 * Generates a consistent HSL color from a string (project name).
 * Ensures the color has good visibility on dark backgrounds.
 */
export function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use the hash to pick a hue (0-360)
  const hue = Math.abs(hash) % 360;
  
  // Set saturation to 70-90% and lightness to 50-60% for vibrant but readable colors on dark bg
  return `hsl(${hue}, 80%, 60%)`;
}

/**
 * Returns the project color, using the stored color if available,
 * otherwise generating one from the name.
 */
export function getProjectColor(name: string, storedColor?: string | null): string {
  if (storedColor) return storedColor;
  return generateColorFromString(name);
}

/**
 * Converts HSL string to RGB-like values if needed for transparency
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('hsl')) {
    return hex.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
  }
  
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
