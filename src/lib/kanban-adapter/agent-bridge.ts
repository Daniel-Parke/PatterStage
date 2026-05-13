// ═══════════════════════════════════════════════════════════════════════════════
// kanban-adapter/agent-bridge.ts — Bridge between kanban cards and agent missions
//
// This module connects the human-facing kanban board to the agent execution
// layer. When a card moves to "In Progress" (or the user explicitly dispatches
// it), this bridge:
//   1. Creates a mission from the card's title + description
//   2. Dispatches it to the Hermes backend
//   3. Records the missionId on the card (via KanbanAdapter)
//   4. Returns the created mission so the UI can display it
//
// This keeps the kanban UI decoupled from HOW missions run — the
// Hermes backend handles execution without changing the UI.
// ═══════════════════════════════════════════════════════════════════════════════

import { agentBackend } from "@/lib/backends";
import { getKanbanAdapter } from "./default-adapter";
import type { DispatchMissionInput } from "@/lib/agent-backend/types";
import type { KanbanCard } from "./types";
import { logApiError } from "@/lib/api-logger";

// ── Dispatch options ────────────────────────────────────────────────────────────

export interface DispatchCardOptions {
  /** Override the profile used for this mission. Defaults to first available profile. */
  profileId?: string;
  /** Additional prompt suffix appended after the card description. */
  promptSuffix?: string;
}

// ── Core dispatch function ─────────────────────────────────────────────────────

/**
 * Dispatch a kanban card as an agent mission.
 *
 * This is called when:
 *   - A card is manually moved to "In Progress"
 *   - The user clicks "Dispatch" / "Start Goal Loop" on a card
 *   - A card is explicitly dispatched from the UI
 *
 * The card's missionIds array is updated to include the new mission ID,
 * creating a permanent link between the card and its running execution.
 */
export async function dispatchKanbanCard(
  card: KanbanCard,
  options: DispatchCardOptions = {}
): Promise<{ missionId: string; linked: boolean }> {
  const backend = agentBackend;
  const adapter = getKanbanAdapter();

  // Build the mission prompt from the card
  const prompt = buildMissionPrompt(card, options.promptSuffix);

  const input: DispatchMissionInput = {
    name: `[Kanban] ${card.title}`,
    prompt,
    profileId: options.profileId,
  };

  try {
    // Dispatch to the active agent backend
    const mission = await backend.dispatchMission(input);

    // Link the mission to the card via the adapter
    adapter.linkCardToMission(card.id, mission.id);

    return { missionId: mission.id, linked: true };
  } catch (err) {
    logApiError(
      "dispatchKanbanCard",
      `card=${card.id} mission=${input.name}`,
      err
    );
    throw err;
  }
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildMissionPrompt(card: KanbanCard, suffix?: string): string {
  const parts: string[] = [];

  if (card.title) {
    parts.push(`Task: ${card.title}`);
  }

  if (card.description) {
    parts.push(`\nDescription:\n${card.description}`);
  }

  if (card.labels && card.labels.length > 0) {
    parts.push(`\nLabels: ${card.labels.join(", ")}`);
  }

  // Include linked mission IDs if the card has prior missions
  if (card.missionIds && card.missionIds.length > 0) {
    parts.push(`\nPrior related mission IDs: ${card.missionIds.join(", ")}`);
  }

  if (suffix) {
    parts.push(`\n${suffix}`);
  }

  parts.push(
    `\n\nWork in ~/control-hub/ for any file operations. Report progress and outcomes clearly.`
  );

  return parts.join("\n");
}

// ── Status sync helper ─────────────────────────────────────────────────────────
//
// Periodically called by the missions page to reconcile card status with
// the actual state of linked missions. E.g. if all linked missions are
// "completed", the card could auto-move to "done".
//
// Currently a no-op stub — the user moves cards manually in ~/control-hub.
// A future version could implement auto-advance based on mission outcomes.

export async function syncCardWithMissions(
  _cardId: string
): Promise<{ cardStatus: string; allMissionsComplete: boolean }> {
  const adapter = getKanbanAdapter();

  const links = adapter.listMissionLinks(_cardId);
  if (links.length === 0) {
    return { cardStatus: "todo", allMissionsComplete: false };
  }

  const backend = agentBackend;
  let allComplete = true;

  for (const link of links) {
    const status = await backend.getMissionStatus(link.missionId);
    if (status !== "successful") {
      allComplete = false;
      break;
    }
  }

  return {
    cardStatus: allComplete ? "done" : "in_progress",
    allMissionsComplete: allComplete,
  };
}
