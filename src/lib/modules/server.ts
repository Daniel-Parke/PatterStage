// ═══════════════════════════════════════════════════════════════
// modules/server.ts — the composition root for server-side module capability
//
// `registry.ts` is pure data: nav, routes, flags, no React and no database, so
// the e2e route matrix can import it from plain node. That purity means it
// cannot carry FUNCTIONS, and some module capability has to be callable by core:
// clearing a module's dev data, probing its health, listing its job kinds.
//
// This file is the one place allowed to import module code. Core calls the
// capability through the interface below and never names a module, which keeps
// the `core-imports-no-module` rule enforceable everywhere else. It is the same
// shape PatterStack uses (`build_server(extra_tools=discover_product_tools())`):
// a composition root that both sides depend on, rather than a dependency from
// core to a product.
//
// Adding a module means adding one entry here, not editing whatever core code
// happened to need it.
// ═══════════════════════════════════════════════════════════════

import { recRoomServerModule } from "@/modules/rec-room/server";

/** A dev-data record a module owns, for the "clean dev data" tool. */
export interface DevDataRecord {
  id: string;
  /** Shown to the operator, and what core matches its test-name pattern against. */
  label: string;
}

/**
 * The side-effectful half of a ProductModule. Everything is optional: a module
 * that owns no data implements none of it.
 */
export interface ServerModule {
  /** Must match the `id` of the same module in registry.ts. */
  id: string;
  /** Records this module would delete if the operator cleans dev data. */
  listDevData?: () => DevDataRecord[];
  /** Delete one of its own records by id. */
  deleteDevData?: (id: string) => void;
}

export const SERVER_MODULES: readonly ServerModule[] = [recRoomServerModule];

export function getServerModule(id: string): ServerModule | undefined {
  return SERVER_MODULES.find((m) => m.id === id);
}
