// ═══════════════════════════════════════════════════════════════
// memory-providers/unavailable-provider.ts — active, but nothing here can serve it
//
// The registry's `default:` branch was a hindsight alias, so a type nobody had
// implemented quietly talked to Hindsight's endpoint while claiming to be
// itself (T-0077). This is returned instead. It reports the type the DATABASE
// says is active, not "none", because the operator did select it and what is
// missing is a client: "which provider is active" gets the right answer, and
// trying to USE it gets a refusal that names the type.
// ═══════════════════════════════════════════════════════════════

import { memoryUnavailableMessage } from "../memory-error-copy";
import type {
  MemoryHealth,
  MemoryProvider,
  MemoryProviderType,
  MemoryStats,
} from "./types";

export class UnavailableMemoryProvider implements MemoryProvider {
  readonly type: MemoryProviderType;
  readonly baseUrl = "";

  constructor(type: MemoryProviderType = "none") {
    this.type = type;
  }

  /**
   * The sentences live in @/lib/memory/memory-error-copy because three
   * surfaces read them and the health banner has to recognise them: it renders
   * INSIDE the provider card and used to reprint this as "Hindsight: <sentence>"
   * over an install with no Hindsight in it.
   */
  private reason(): string {
    return memoryUnavailableMessage(this.type);
  }

  bankBase(): string {
    return "";
  }

  async request<T = Record<string, unknown>>(): Promise<T> {
    // The message travels to the client as a toast, so this is user-facing copy.
    throw new Error(this.reason());
  }

  async health(): Promise<MemoryHealth> {
    return { available: false, error: this.reason() };
  }

  async stats(): Promise<MemoryStats> {
    return { available: false, factCount: 0 };
  }
}
