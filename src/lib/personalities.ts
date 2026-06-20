// ═══════════════════════════════════════════════════════════════
// Shared Personality Constants — used by both Agents & Personalities pages
// Shared Personality Emoji constants for PatterStage UI.
// PERSONALITIES, PersonalityName, and PERSONALITY_COLORS were removed
// as they were unused and represented stale documentation.

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
