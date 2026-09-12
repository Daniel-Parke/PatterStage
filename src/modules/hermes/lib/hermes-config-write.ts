// hermes-config-write.ts: the two writers, and the line between them.
//
// `atomicWriteFile` is a generic writer (it writes .env too) that knows nothing
// about caches; `writeHermesConfigFile` writes config.yaml AND drops the read
// cache. WG-ARCH-003 rules B for the config read: one writer, or an
// invalidation every writer must call. Pushing the invalidation down into
// `atomicWriteFile` would be wrong, and
// `tests/unit/config-cache-invalidation.test.ts` carries a control test that
// fails if anyone does it. Writes are atomic (tmpfile + rename), backed up
// under <root>/backups/ first, and idempotent.

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

import { updateAgentRoot } from "@/lib/agents/agent-root-repository";
import { messageFromError } from "@/lib/api/api-fetch";
import { invalidateConfigCache } from "@/lib/config/config-cache";
import { backupFile as backupFileShared } from "@/lib/fs/fs-helpers";

import { buildHermesPathBundle } from "./paths";
import { getHermesDefaultRoot } from "./profile-paths";

/** Stage to a sibling tmpfile, then rename (atomic on POSIX, same volume). Caller ensures the dir exists. */
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
 * Write config.yaml and drop the read cache in the same breath (WG-ARCH-003 B).
 * Before this only `PUT /api/config` invalidated, so push a model and read it
 * back inside the 15s TTL and you saw the old value. A helper rather than a
 * call at each site because WO-0006's enumerated list of four writers is
 * precisely how the gap opened; a fifth writer inherits it. Invalidate rather
 * than repopulate: a stale entry is the failure worth removing, and
 * `invalidateConfigCache` swallows its own throw, leaving the TTL as backstop.
 */
export function writeHermesConfigFile(configPath: string, serialized: string): void {
  // The belt on the object-dump writers too (T-0086): yaml.dump cannot emit
  // duplicate keys, but the corruption survived months because nobody checked
  // what landed on disk.
  assertParseableConfigYaml(serialized, configPath);
  atomicWriteFile(configPath, serialized);
  invalidateConfigCache();
  refreshAgentRootFromWrite(configPath, serialized);
}

/**
 * Keep `agent_root.config_yaml` equal to the file it mirrors: a root Push
 * assembles config.yaml from the row, so a Settings save that wrote the file
 * alone was reverted by the next push, with the drift banner unable to warn
 * (T-0100, D76). Attached to the ACT of writing, as the invalidation is. Only
 * the DEFAULT root is mirrored; a profile's config.yaml is a different file.
 */
function refreshAgentRootFromWrite(configPath: string, serialized: string): void {
  let rootConfig: string;
  try {
    rootConfig = buildHermesPathBundle(getHermesDefaultRoot()).config;
  } catch {
    // No resolvable default root (an unconfigured environment): nothing to mirror.
    return;
  }
  // resolve() on both sides: the bundle joins with "/", callers pass path.join output.
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

/** Timestamped pre-write backup under `<root>/backups/`; an alias over the shared fs-helpers one. */
export function backupFile(originalPath: string, backupsDir: string): string | null {
  return backupFileShared(originalPath, backupsDir);
}

/**
 * The file the operator meant, from a failed write. `atomicWriteFile` stages at
 * `<target>.tmp-<pid>-<ms>` and rethrows raw, so a failure named a staging path
 * that never existed, inside the very directory that was missing (T-0082).
 * Null when the error names no path.
 */
export function targetPathFromWriteError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const quoted = err.message.match(/'([^']+)'/);
  if (!quoted) return null;
  // Only OUR suffix, anchored at the end, so a real file containing ".tmp-" survives.
  return quoted[1].replace(/\.tmp-\d+-\d+$/, "");
}

/** A write failure in terms of the file the operator meant; errno and reason kept, only the path replaced. */
export function describeWriteFailure(err: unknown): string {
  const raw = messageFromError(err, "Write failed");
  const target = targetPathFromWriteError(err);
  if (!target) return raw;
  const staged = (err as Error).message.match(/'([^']+)'/)?.[1];
  return staged && staged !== target ? raw.split(staged).join(target) : raw;
}

/**
 * Refuse to let unparseable YAML reach disk: the belt for T-0086, whose
 * text-assembled writers shipped months of duplicate keys unchecked. js-yaml v4
 * throws on duplicate mapping keys, so a plain load covers the class observed.
 * The message carries the parse error's FIRST LINE and the path, never the
 * content: a config.yaml holds api_key lines and the refusal travels into
 * toasts and logs (the hygiene the PUT /api/config refusal pinned in T-0060).
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
 * The newest config.yaml backup that still parses, or null. Named in refusal
 * messages and ONLY named, never restored: a backup carries older model and
 * provider settings, and reviving one could flip the active model unasked.
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
      // a corrupt backup is what a corruption-then-backup cycle leaves; keep walking
    }
  }
  return null;
}
