// ═══════════════════════════════════════════════════════════════
// Shared Personality Constants — used by both Agents & Personalities pages
// ═══════════════════════════════════════════════════════════════
// Single source of truth for built-in personality names, display colors,
// and emoji icons. Import this instead of duplicating constants per page.

export const PERSONALITIES = [
  "technical", "helpful", "creative", "concise", "teacher",
  "philosopher", "pirate", "shakespeare", "surfer", "noir",
  "kawaii", "catgirl", "hype", "uwu",
] as const;

export type PersonalityName = (typeof PERSONALITIES)[number];

export const PERSONALITY_COLORS: Record<string, string> = {
  technical: "cyan", helpful: "green", creative: "pink", concise: "orange",
  teacher: "purple", philosopher: "cyan", pirate: "orange", shakespeare: "purple",
  surfer: "green", noir: "gray", kawaii: "pink", catgirl: "pink",
  hype: "orange", uwu: "pink",
};

export const PERSONALITY_EMOJIS: Record<string, string> = {
  catgirl: "🐱",
  concise: "📌",
  creative: "🎨",
  helpful: "🤝",
  hype: "🔥",
  kawaii: "✨",
  noir: "🕵️",
  philosopher: "🤔",
  pirate: "🏴‍☠️",
  shakespeare: "🎭",
  surfer: "🤙",
  teacher: "📚",
  technical: "🔧",
  uwu: "🌸",
};

export function getPersonalityEmoji(name: string): string {
  return PERSONALITY_EMOJIS[name] || "💬";
}

/** Capitalise first letter: technical → Technical */
export { titleCase as titleCasePersonality } from "@/lib/utils";
