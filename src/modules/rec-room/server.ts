// ═══════════════════════════════════════════════════════════════
// rec-room/server.ts — the module's server-side capability (ADR-0005)
//
// Registered by src/lib/modules/server.ts, which is the only file allowed to
// import a module. Core reaches Rec Room's data through this interface instead
// of importing its repository, which is what lets `core-imports-no-module` be a
// red build rather than a convention.
//
// Note the split of responsibility: the module says WHAT records it owns, core
// decides WHICH of them count as dev data. The "looks like a test artifact"
// pattern is a core policy and stays there.
// ═══════════════════════════════════════════════════════════════

import type { DevDataRecord, ServerModule } from "@/lib/modules/server";

import { deleteStory, listStories, reconcileStoriesOnBoot } from "./lib/story-repository";

export const recRoomServerModule: ServerModule = {
  id: "rec-room",

  listDevData(): DevDataRecord[] {
    return listStories().map((s) => ({ id: s.id, label: s.title }));
  },

  deleteDevData(id: string): void {
    deleteStory(id);
  },

  reconcileOnBoot(): void {
    reconcileStoriesOnBoot();
  },
};
