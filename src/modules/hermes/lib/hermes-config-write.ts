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
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join, resolve } from "path";

import * as yaml from "js-yaml";

import { updateAgentRoot } from "@/lib/agent-root-repository";
import { messageFromError } from "@/lib/api-fetch";
import { invalidateConfigCache } from "@/lib/config-cache";
import { backupFile as backupFileShared } from "@/lib/fs/fs-helpers";

import { buildHermesPathBundle } from "./paths";
import { getHermesDefaultRoot } from "./profile-paths";

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
  // The belt on the object-dump writers too (T-0086). These are structurally
  // safe today — yaml.dump of a plain object cannot emit duplicate keys — but
  // the whole corruption survived for months precisely because nobody checked
  // what actually landed on disk.
  assertParseableConfigYaml(serialized, configPath);
  atomicWriteFile(configPath, serialized);
  invalidateConfigCache();
  refreshAgentRootFromWrite(configPath, serialized);
}

/**
 * Keep `agent_root.config_yaml` equal to the file it mirrors.
 *
 * The row is what a root Push assembles the whole config.yaml from. A Settings
 * save wrote the file and left the row alone, so the next push of the agent
 * rebuilt the file from the stale row and the save was gone from disk AND
 * database, with the drift banner unable to warn in between (T-0100, D76).
 *
 * Attached to the ACT of writing the root config.yaml, for the same reason the
 * cache invalidation above is: an enumerated list of writers is exactly how
 * the previous gap opened. Only the DEFAULT root is mirrored — a profile's own
 * config.yaml is a different file, and copying it into this row would be a
 * different corruption.
 */
function refreshAgentRootFromWrite(configPath: string, serialized: string): void {
  let rootConfig: string;
  try {
    rootConfig = buildHermesPathBundle(getHermesDefaultRoot()).config;
  } catch {
    // No resolvable default root (an unconfigured environment): nothing to mirror.
    return;
  }
  // resolve() on both sides: the bundle joins with "/" while callers pass
  // path.join output, which is backslash-separated on Windows.
  if (resolve(configPath) !== resolve(rootConfig)) return;
  try {
    updateAgentRoot({ configYaml: serialized });
  } catch (err) {
    throw new Error(
      `${configPath} was written, but the agent record could not be refreshed ` +
        `(${messageFromError(err, "unknown error")}). A push would revert the file.`,
    );
  }
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

/**
 * The file the operator was actually trying to write, from a failed write.
 *
 * `atomicWriteFile` stages at `<target>.tmp-<pid>-<ms>` and rethrows the raw
 * error, so a failure reported the staging path -- a file that does not exist,
 * has never existed, and in the case that motivated this sits inside the very
 * directory that was missing. An operator handed
 * `memories/USER.md.tmp-15220-1788188853250` cannot search for it, cannot
 * create it, and cannot tell what went wrong (T-0082).
 *
 * Returns null rather than guessing when the error names no path at all.
 */
export function targetPathFromWriteError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const quoted = err.message.match(/'([^']+)'/);
  if (!quoted) return null;
  // Only OUR staging suffix is stripped, anchored to the end, so a real file
  // that happens to contain ".tmp-" survives intact.
  return quoted[1].replace(/\.tmp-\d+-\d+$/, "");
}

/**
 * A write failure, said in terms of the file the operator meant.
 *
 * Keeps the errno and the reason -- ENOENT and EACCES are different problems
 * with different fixes -- and only replaces the path.
 */
export function describeWriteFailure(err: unknown): string {
  const raw = messageFromError(err, "Write failed");
  const target = targetPathFromWriteError(err);
  if (!target) return raw;
  const staged = (err as Error).message.match(/'([^']+)'/)?.[1];
  return staged && staged !== target ? raw.split(staged).join(target) : raw;
}

/**
 * Refuse to let unparseable YAML reach a config.yaml on disk.
 *
 * The belt for T-0086. The text-assembled writers shipped months of duplicate
 * mapping keys with zero validation; after the assembler rewrite this should
 * never fire, and if it ever does, a loud refusal beats a corrupt file the
 * agent then boots from. js-yaml v4 throws on duplicated mapping keys, so a
 * plain load covers exactly the corruption class observed.
 *
 * The message carries the FIRST LINE of the parse error and the target path,
 * never the content — a real config.yaml holds api_key lines, and the refusal
 * travels into sync errors, toasts and logs (the same hygiene the PUT
 * /api/config refusal pinned in T-0060).
 */
export function assertParseableConfigYaml(content: string, targetPath: string): void {
  try {
    yaml.load(content);
  } catch (err) {
    const firstLine = (err instanceof Error ? err.message : String(err)).split(/\r?\n/)[0].trim();
    throw new Error(
      `refusing to write ${targetPath}: the serialised YAML does not parse (${firstLine})`,
    );
  }
}

/**
 * The newest config.yaml backup that still parses, or null.
 *
 * Named in refusal messages so the repair is one copy command away — and ONLY
 * named, never restored automatically: a backup carries older model/provider
 * settings, and silently reviving one could flip the operator's active model
 * without consent.
 */
export function findLatestParseableBackup(backupsDir: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(backupsDir);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((name) => name.startsWith("config.yaml.") && name.endsWith(".bak"))
    .sort()
    .reverse();
  for (const name of candidates) {
    const full = join(backupsDir, name);
    try {
      yaml.load(readFileSync(full, "utf-8"));
      return full;
    } catch {
      // corrupt backup — exactly what a corruption-then-backup cycle leaves;
      // keep walking toward the last good one.
    }
  }
  return null;
}
