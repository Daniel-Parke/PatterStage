import { randomBytes } from "node:crypto";

export interface BootState {
  generation: string;
  key: Buffer;
}

type BootGlobal = typeof globalThis & { __patterstageAuthBootState?: BootState };

/** Called once by server instrumentation before browser authentication begins. */
export function initialiseBootState(): BootState {
  const scope = globalThis as BootGlobal;
  if (!scope.__patterstageAuthBootState) {
    scope.__patterstageAuthBootState = {
      generation: randomBytes(32).toString("base64url"),
      key: randomBytes(32),
    };
  }
  return getBootState()!;
}

/** Never creates state during a request: an uninitialised bundle fails closed. */
export function getBootState(): BootState | null {
  const state = (globalThis as BootGlobal).__patterstageAuthBootState;
  if (!state || typeof state.generation !== "string" ||
      !Buffer.isBuffer(state.key) || state.key.length !== 32) return null;
  return { generation: state.generation, key: Buffer.from(state.key) };
}
