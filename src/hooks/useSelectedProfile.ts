// ═══════════════════════════════════════════════════════════════
// useSelectedProfile — one answer to "which agent am I shaping?"
//
// Agents, Skills and Tools each held their own picker in their own useState, so
// choosing a profile on one screen carried to none of the others. An operator
// working through chapter 3 of the quests picked a profile on Agents, turned a
// skill on for the root agent, saved a toolset for the root agent, and was
// never told: three screens, three subjects, one word for all of them (T-0113).
//
// The store is module-scoped rather than a context so a page can read it
// without a provider above it, and it is mirrored into localStorage so the
// answer survives a reload as well as a navigation. Nothing here reaches the
// network: which profile is SELECTED is the operator's, and the pages already
// fetch what that selection means.
//
// Not the same question as which profile the agent runs by default, which lives
// on disk and belongs to Hermes. This is a view preference, and it is treated
// as one: a selection that no longer exists is reconciled by the screen that
// can see the list.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_PROFILE_SLUG } from "@/lib/agents/profile-slug";

const STORAGE_KEY = "patterstage.selected-profile";

/** Read once, then kept here: getSnapshot must not build a new value per call. */
let selected: string | null = null;
const listeners = new Set<() => void>();

/** The selected profile slug. Falls back to the root agent. */
export function getSelectedProfile(): string {
  if (selected !== null) return selected;
  let stored: string | null = null;
  try {
    stored = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // A browser with storage switched off still gets a working console.
    stored = null;
  }
  selected = stored?.trim() ? stored.trim() : DEFAULT_PROFILE_SLUG;
  return selected;
}

/** Choose the profile every agent screen is talking about. */
export function setSelectedProfile(next: string): void {
  const value = next.trim() || DEFAULT_PROFILE_SLUG;
  if (value === getSelectedProfile()) return;
  selected = value;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Losing the preference on reload is survivable; losing the click is not.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The server has no operator, so it renders the root agent and hydrates. */
function serverSnapshot(): string {
  return DEFAULT_PROFILE_SLUG;
}

/**
 * The selected profile, and how to change it, shared by every screen that
 * shapes an agent.
 */
export function useSelectedProfile(): [string, (next: string) => void] {
  const value = useSyncExternalStore(subscribe, getSelectedProfile, serverSnapshot);
  return [value, setSelectedProfile];
}
