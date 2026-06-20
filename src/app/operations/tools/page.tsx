// ═══════════════════════════════════════════════════════════════
// Hermes Toolsets — per-profile platform_toolsets (SQLite → config.yaml)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench,
  Info,
  RefreshCw,
  Upload,
  Download,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import ProfileSelector from "@/components/ui/ProfileSelector";
import { apiFetch, safeApiCallData, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import { profileSyncBody } from "@/lib/profile-sync-body";
import { pluralise } from "@/lib/utils";
import type { PlatformToolsets } from "@/lib/profile-config-builder";
import type { AgentProfile } from "@/types/hermes";
import {
  HERMES_CONFIGURABLE_TOOLSETS,
} from "@/lib/hermes-toolset-catalog";
import {
  expandUnifiedToAllPlatforms,
  unionToolsetsFromPlatforms,
} from "@/lib/hermes-toolset-unify";
import ToolsInsights from "@/components/tools/ToolsInsights";

export default function ToolsPage() {
  const [selectedProfile, setSelectedProfile] = useState("default");
  const [toolsetsJson, setToolsetsJson] = useState("{}");
  const [toolsetsSource, setToolsetsSource] = useState<string | null>(null);
  const [loadingToolsets, setLoadingToolsets] = useState(true);
  const [savingToolsets, setSavingToolsets] = useState(false);
  const [syncing, setSyncing] = useState<"pull" | "push" | null>(null);
  const [unifiedEnabled, setUnifiedEnabled] = useState<string[]>([]);
  const [platformsDiverged, setPlatformsDiverged] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [profileSyncStatus, setProfileSyncStatus] = useState<AgentProfile["syncStatus"] | null>(null);
  const { showToast, toastElement } = useToast();

  // loadProfileSyncStatus — fetches the agent-profiles registry and
  // surfaces the selected profile's syncStatus (drift | error | null).
  // Best-effort: any error (network blip, 500 from the registry,
  // malformed JSON) is swallowed and the status is reset to null —
  // the parent page treats null as "no sync error to surface".
  //
  // Migrated to `safeApiCallData<T>` (List 3 Mode I audit, session 166)
  // from a 9-line try/catch/apiFetch/as-cast form. The pre-migration
  // shape was:
  //
  //   const loadProfileSyncStatus = useCallback(async () => {
  //     try {
  //       const data = await apiFetch("/api/agent/profiles");
  //       const profiles = (data.data?.profiles ?? []) as AgentProfile[];
  //       const match = profiles.find((p) => p.id === selectedProfile);
  //       setProfileSyncStatus(match?.syncStatus ?? null);
  //     } catch {
  //       setProfileSyncStatus(null);
  //     }
  //   }, [selectedProfile]);
  //
  // The migrated form is byte-equivalent:
  //   - Error path: `safeApiCallData<T>` returns `null` on caught error
  //     (per `src/lib/api-fetch.ts:155-157`), then `null?.profiles ?? []`
  //     gives `[]`, `find` returns `undefined`, `undefined?.syncStatus ?? null`
  //     is `null` — same observable result as the pre-migration `catch`
  //     branch's `setProfileSyncStatus(null)`.
  //   - Success path: same `find` + same `match?.syncStatus ?? null`
  //     access. The `as AgentProfile[]` cast is dropped because
  //     `safeApiCallData<{ profiles?: AgentProfile[] }>` already
  //     parameterises the inner payload shape (no `as` widening needed).
  //
  // The companion test `load-profile-sync-status-safe-api-call-data.test.tsx`
  // pins the byte-equivalence across both the success and error paths.
  const loadProfileSyncStatus = useCallback(async () => {
    const data = await safeApiCallData<{ profiles?: AgentProfile[] }>(
      "/api/agent/profiles",
    );
    const profiles = data?.profiles ?? [];
    const match = profiles.find((p) => p.id === selectedProfile);
    setProfileSyncStatus(match?.syncStatus ?? null);
  }, [selectedProfile]);

  const loadToolsets = useCallback(async () => {
    setLoadingToolsets(true);
    try {
      const data = await apiFetch(`/api/agent/profiles/${selectedProfile}/toolsets`);
      const loaded = (data.data?.platformToolsets ?? {}) as PlatformToolsets;
      const unified = (data.data?.unifiedEnabled as string[] | undefined) ??
        unionToolsetsFromPlatforms(loaded);
      setUnifiedEnabled(unified);
      setPlatformsDiverged(Boolean(data.data?.platformsDiverged));
      setToolsetsJson(JSON.stringify(loaded, null, 2));
      setToolsetsSource(data.data?.source ?? null);
    } catch (err) {
      setToolsetsJson("{}");
      setToolsetsSource(null);
      toastError(showToast, err, "Failed to load toolsets");
    } finally {
      setLoadingToolsets(false);
    }
  }, [selectedProfile, showToast]);

  // reloadAll — pairs `loadToolsets` + `loadProfileSyncStatus` for callers
  // that need BOTH reloaded (e.g. after a pull/push from Hermes that
  // may have changed the sync status of the active profile). Appears
  // at 2 sites:
  //   1. The useEffect below (fires-and-forgets on mount and on
  //      selectedProfile change)
  //   2. The `pullFromHermes` onSuccess (awaits so the
  //      `runSyncAction` helper's `await onSuccess()` is honoured
  //      and the busy spinner doesn't clear before the refetch
  //      completes — per the helper's JSDoc)
  // Centralising into a `useCallback` with `[loadToolsets,
  // loadProfileSyncStatus]` deps keeps the 2 sites in lockstep
  // (a future "also reload X" extension lands in one place). The
  // call sites are byte-equivalent:
  //   - `void reloadAll();` ≡ `void loadToolsets(); void loadProfileSyncStatus();`
  //     (sequential awaits inside the callback, caller discards the promise)
  //   - `await reloadAll();` ≡ `await loadToolsets(); await loadProfileSyncStatus();`
  //     (sequential awaits inside the callback, caller awaits the result)
  // Both call shapes produce the same final state: toolsets AND sync
  // status are both reloaded. The `saveToolsets` onSuccess is
  // intentionally NOT migrated — it only needs `loadToolsets`
  // (the sync status doesn't change on a local save, only on
  // pull/push that touches Hermes disk).
  const reloadAll = useCallback(async () => {
    await loadToolsets();
    await loadProfileSyncStatus();
  }, [loadToolsets, loadProfileSyncStatus]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const toggleUnifiedToolset = (toolsetId: string) => {
    setUnifiedEnabled((prev) => {
      const next = [...prev];
      const idx = next.indexOf(toolsetId);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(toolsetId);
      const sorted = [...new Set(next)].sort();
      const expanded = expandUnifiedToAllPlatforms(sorted);
      setToolsetsJson(JSON.stringify(expanded, null, 2));
      return sorted;
    });
  };

  const isUnifiedEnabled = (toolsetId: string): boolean => unifiedEnabled.includes(toolsetId);

  const saveToolsets = () => {
    let payload: PlatformToolsets;
    if (showAdvancedJson) {
      const parsed = JSON.parse(toolsetsJson) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        // Original behaviour: validation error shown via direct
        // showToast (not via the helper's catch path, because the
        // helper's `errorMessage` would replace this with the generic
        // fallback). The error message text is byte-identical to the
        // pre-refactor "Invalid JSON object" toast.
        showToast("Invalid JSON object", "error");
        return Promise.resolve();
      }
      payload = parsed as PlatformToolsets;
    } else {
      payload = expandUnifiedToAllPlatforms(unifiedEnabled);
    }
    return runSyncAction({
      setBusy: setSavingToolsets,
      showToast,
      url: `/api/agent/profiles/${selectedProfile}/toolsets`,
      method: "PUT",
      body: { platformToolsets: payload },
      successMessage: "Toolsets saved and pushed to Hermes",
      errorMessage: "Failed to save toolsets",
      onSuccess: loadToolsets,
    });
  };

  const pullFromHermes = (mode: "pull" | "push") => {
    // syncing is a 2-state string ("pull" | "push" | null) so the
    // buttons can show "Pulling..." / "Pushing..." independently. Wrap
    // it as a boolean setter for the shared runSyncAction helper.
    const setBusy = (busy: boolean) => setSyncing(busy ? mode : null);
    const successMessage = mode === "pull" ? "Pulled toolsets from Hermes" : (
      selectedProfile === "default"
        ? "Pushed profile to Hermes. Model defaults re-applied to config.yaml."
        : "Pushed profile to Hermes"
    );
    const onSuccess = async () => {
      await reloadAll();
    };
    return runSyncAction({
      setBusy,
      showToast,
      url: `/api/agent/profiles/sync/${mode}`,
      body: profileSyncBody(selectedProfile),
      successMessage,
      errorMessage: mode === "pull" ? "Pull failed" : "Push failed",
      onSuccess,
      // /api/agent/profiles/sync/* throw on failure (return 500), they
      // don't return {data: {success: false}}; rely on the catch path.
      checkSuccess: false,
    });
  };

  const enabledCount = unifiedEnabled.length;

  return (
    <AppPageShell>
      {toastElement}
      <PageHeader
        icon={Wrench}
        title="Hermes Toolsets"
        subtitle={
          loadingToolsets
            ? "Loading profile toolsets…"
            : `${enabledCount} toolset${pluralise(enabledCount)} enabled for selected profile`
        }
        color="orange"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              variant="ghost"
              size="sm"
              color="orange"
              icon={syncing === "pull" ? undefined : Download}
              onClick={() => void pullFromHermes("pull")}
              disabled={syncing !== null}
            >
              {syncing === "pull" ? "Pulling…" : "Pull from Hermes"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              color="orange"
              icon={syncing === "push" ? undefined : Upload}
              onClick={() => void pullFromHermes("push")}
              disabled={syncing !== null}
            >
              {syncing === "push" ? "Pushing…" : "Push to Hermes"}
            </Button>
            <Button
              variant="primary"
              color="orange"
              size="sm"
              icon={savingToolsets ? undefined : RefreshCw}
              onClick={() => void saveToolsets()}
              disabled={savingToolsets || loadingToolsets}
            >
              {savingToolsets ? "Saving…" : "Save & push toolsets"}
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6 max-w-5xl">
        {profileSyncStatus === "drift" && (
          <div className="mb-4 p-3 rounded-lg bg-semantic-warning/10 border border-semantic-warning/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-semantic-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-semantic-warning/90">
              Toolset policy on disk differs from PatterStage (format or values).{" "}
              <strong>Pull from Hermes</strong> imports disk into SQLite;{" "}
              <strong>Save &amp; push toolsets</strong> or <strong>Push</strong> writes canonical{" "}
              <code className="text-white/50">config.yaml</code> to{" "}
              <code className="text-white/50">~/.hermes</code>.
            </p>
          </div>
        )}
        {profileSyncStatus === "error" && (
          <div className="mb-4 p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/30">
            <p className="text-xs text-semantic-error">
              Last sync failed. Check gateway logs, then retry Pull or Push.
            </p>
          </div>
        )}
        {platformsDiverged && (
          <div className="mb-4 p-3 rounded-lg bg-semantic-warning/10 border border-semantic-warning/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-semantic-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-semantic-warning/90">
              Platforms have different toolsets on disk. The grid below shows the union.
              <strong>Save &amp; push</strong> applies one list to all gateways (like
              <code className="text-white/50">hermes tools</code> configure all).
            </p>
          </div>
        )}
        <div className="mb-4 p-3 rounded-lg bg-dark-900/50 border border-white/5 flex items-start gap-2">
          <Info className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/30">
            Hermes stores <code className="text-white/40">platform_toolsets</code> per gateway key;
            PatterStage uses one enabled list per profile and fans it out on save (Nous-aligned with
            configure all platforms). Use <strong className="text-white/50">Pull</strong> after{" "}
            <code className="text-white/40">hermes tools</code> on disk.
          </p>
        </div>

        {!loadingToolsets && (
          <ToolsInsights total={HERMES_CONFIGURABLE_TOOLSETS.length} enabled={enabledCount} />
        )}

        <div className="rounded-xl border border-neon-orange/20 bg-neon-orange/5 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="sm:w-72 flex-shrink-0">
              <h2 className="text-sm font-mono text-neon-orange mb-2">Profile</h2>
              <ProfileSelector
                value={selectedProfile}
                onChange={setSelectedProfile}
                subtitle="tooltip"
              />
            </div>
            <div className="flex-1 min-w-0">
              {toolsetsSource && toolsetsSource !== "database" && (
                <p className="text-[10px] font-mono text-neon-orange/70 mb-2">
                  Hydrated from{" "}
                  {toolsetsSource === "config_yaml" ? "config.yaml" : "seed pack"} into SQLite.
                </p>
              )}
              {loadingToolsets ? (
                <LoadingSpinner text="Loading toolsets…" />
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
                      Enabled toolsets
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {HERMES_CONFIGURABLE_TOOLSETS.map((toolset) => {
                        const on = isUnifiedEnabled(toolset.id);
                        return (
                          <button
                            key={`unified-${toolset.id}`}
                            type="button"
                            title={toolset.description}
                            onClick={() => toggleUnifiedToolset(toolset.id)}
                            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                              on
                                ? "border-neon-orange/50 bg-neon-orange/15 text-neon-orange"
                                : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"
                            }`}
                          >
                            {toolset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      className="text-[10px] font-mono text-white/40 hover:text-white/60"
                      onClick={() => setShowAdvancedJson((v) => !v)}
                    >
                      {showAdvancedJson ? "Hide" : "Show"} advanced JSON
                    </button>
                    {showAdvancedJson && (
                      <textarea
                        value={toolsetsJson}
                        onChange={(event) => setToolsetsJson(event.target.value)}
                        className="mt-2 w-full min-h-32 rounded-lg bg-dark-950/80 border border-white/10 p-3 text-xs font-mono text-white/80 outline-none focus:border-neon-orange/50"
                        spellCheck={false}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-dark-900/30 p-4">
          <h3 className="text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
            Reference — Hermes toolset IDs
          </h3>
          <p className="text-[10px] text-white/30 mb-3">
            Catalog for labels only. Enabling toolsets above updates the selected profile config.
          </p>
          <ul className="grid sm:grid-cols-2 gap-2 text-[10px] font-mono text-white/40">
            {HERMES_CONFIGURABLE_TOOLSETS.map((entry) => (
              <li key={entry.id}>
                <span className="text-white/55">{entry.id}</span>
                <span className="text-white/25"> — {entry.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppPageShell>
  );
}
