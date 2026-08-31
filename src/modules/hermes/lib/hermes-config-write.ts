// ═══════════════════════════════════════════════════════════════
// hermes-config-write.ts: the two writers, and the line between them
//
// Split out of config-sync.ts. These two functions live in one file
// on purpose: the whole point of `writeHermesConfigFile` is that it
// is NOT `atomicWriteFile`, and a boundary is easier to keep when
// both sides of it are visible at once.
//
//   atomicWriteFile:       a generic file writer. Knows nothing about
//                          caches. Writes .env as well as config.yaml.
//   writeHermesConfigFile: writes config.yaml AND drops the read
//                          cache, in the same call.
//
// WG-ARCH-003 rules B for the config read: one writer, or an
// invalidation every writer must call. Pushing the invalidation down
// into `atomicWriteFile` would look tidier and would be wrong;
// `tests/unit/config-cache-invalidation.test.ts` carries a control
// test that fails if anyone does it.
//
// Guarantees carried over from config-sync.ts:
//   - atomic writes via tmpfile + fs.renameSync
//   - timestamped backups under <root>/backups/ before any write
//   - idempotent: re-applying the same input produces the same file
// ═══════════════════════════════════════════════════════════════

import {
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";

import { invalidateConfigCache } from "@/lib/config-cache";
import { backupFile as backupFileShared } from "@/lib/fs/fs-helpers";

/**
 * Atomic write: stage to a sibling tmpfile, then rename. fs.rename on
 * POSIX is atomic for same-volume operations. Caller must ensure dir
 * exists.
 */
export function atomicWriteFile(targetPath: string, content: string): void {
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmpPath, content, { encoding: "utf-8" });
    renameSync(tmpPath, targetPath);
  } catch (err) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // best-effort cleanup; surface the original error below
      }
    }
    throw err;
  }
}

/**
 * Write config.yaml and drop the read cache in the same breath.
 *
 * WG-ARCH-003 rules B for the config read: one writer, or an invalidation every
 * writer must call. Before this existed only `PUT /api/config` invalidated, so
 * every other path left the 15s TTL as the sole owner of correctness. Push a
 * model and read it back inside that window and you saw the old value.
 *
 * Why a helper rather than a call at each site: WO-0006 named four writers, and
 * an enumerated list is precisely how the gap opened. Routing the write through
 * one function attaches invalidation to the ACT of writing config.yaml, so a
 * fifth writer inherits it. `finalizeRootConfigOnDisk` is already covered that
 * way, since it writes by calling `syncDefaultsToHermesConfig`.
 *
 * Deliberately NOT folded into `atomicWriteFile`: that also writes `.env`, and a
 * generic file writer should not know which caches exist.
 *
 * Invalidate rather than repopulate. A write is rare and a stale entry is the
 * failure mode worth removing; re-reading costs one yaml.parse on the next GET.
 * If the invalidation throws it is swallowed inside `invalidateConfigCache`,
 * which leaves the TTL as the backstop it was always meant to be.
 */
export function writeHermesConfigFile(configPath: string, serialized: string): void {
  atomicWriteFile(configPath, serialized);
  invalidateConfigCache();
}

/**
 * Timestamped pre-write backup under `<root>/backups/`. A thin alias over
 * the shared helper so every writer in this module family reaches for the
 * same two-argument shape; the implementation was promoted to
 * `@/lib/fs/fs-helpers` when the third caller appeared.
 */
export function backupFile(originalPath: string, backupsDir: string): string | null {
  return backupFileShared(originalPath, backupsDir);
}

/** Placeholder — see T-0082. Returns whatever path the error names, verbatim. */
export function targetPathFromWriteError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const match = err.message.match(/'([^']+)'/);
  return match ? match[1] : null;
}
