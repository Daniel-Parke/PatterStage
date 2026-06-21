// ═══════════════════════════════════════════════════════════════
// VersionFooter — the sidebar's "Check for updates / Rebuild / Restart" block.
// Polls GET /api/update for version + deploy status; POSTs the three deploy
// actions. Collapsed and expanded render modes. Extracted from Sidebar.tsx.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, AlertTriangle, Check, Hammer, Power } from "lucide-react";

import { setErrorFromCaught, safeApiCallData } from "@/lib/api-fetch";
import { sanitizeGitBranch } from "@/lib/git-branch";
import { fallbackForDeployMessage } from "@/lib/deploy-action-fallback";
import { BranchDropdown } from "./BranchDropdown";

/** The three deploy actions supported by POST /api/update. */
type DeployAction = "update" | "restart" | "rebuild";

interface VersionInfo {
  localHash: string;
  remoteHash: string;
  updateAvailable: boolean;
  commitMessage: string;
  behind: number;
  branch: string;
  /** Remote ref used for compare (when present). */
  comparedBranch?: string;
  checkoutBranch?: string;
  lastChecked: string;
}

export function VersionFooter({ collapsed }: { collapsed: boolean }) {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [checkState, setCheckState] = useState<
    "idle" | "checking" | "up-to-date" | "update-available"
  >("idle");
  const [updating, setUpdating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Synchronous busy guard — ref, not state, so it updates immediately on click
  const busyRef = useRef(false);

  // Dropdown state (Check for updates only)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>(["main", "dev"]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  /** Branch last used for GET /api/update?branch=… — POST update uses the same branch. */
  const [deployBranch, setDeployBranch] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  // Refs to forward-declared callbacks so useCallbacks higher up in the
  // file (handleUpdate/handleRestart/doRebuild) can read the latest
  // pollDeployStatus/clearDeployBusy without depending on declaration
  // order or rebuilding on every render. The forward declarations are
  // reassigned to the real fns below.
  const pollDeployStatusRef = useRef<(action: DeployAction) => void>(() => undefined);
  const clearDeployBusyRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const openCheckDropdown = async () => {
    setDropdownOpen(true);
    const pickBranch = (list: string[], apiDefault: unknown): string => {
      const def = typeof apiDefault === "string" ? sanitizeGitBranch(apiDefault) : "";
      if (def && list.includes(def)) return def;
      return list[0] ?? "dev";
    };
    const data = await safeApiCallData<{ branches: string[]; default: string }>(
      "/api/update?branches=1",
    );
    const list: string[] = data && data.branches.length > 0 ? data.branches : ["main", "dev"];
    setBranches(list);
    setSelectedBranch(pickBranch(list, data?.default));
  };

  const handleDropdownConfirm = async (branch: string) => {
    setDropdownOpen(false);
    await doCheck(branch);
  };

  // Check version against a specific branch
  const doCheck = async (branch: string) => {
    setCheckState("checking");
    setMessage(null);
    const data = await safeApiCallData<VersionInfo & { commitDate: string }>(
      `/api/update?branch=${encodeURIComponent(branch)}`,
    );
    if (!data) {
      setCheckState("idle");
      setMessage("Check failed");
      return;
    }
    setVersion(data);
    setDeployBranch(branch);
    setCheckState(data.updateAvailable ? "update-available" : "up-to-date");
  };

  // ── Deploy actions ──────────────────────────────────────────
  // POST /api/update supports update/restart/rebuild — the three handlers share
  // an identical shape (busy guard → started message → POST → error check →
  // running message + poll → catch). runDeployAction collapses them; only the
  // action name, messages, busy setter, and (for update) the body/error-check
  // differ.
  const runDeployAction = useCallback(
    async (opts: {
      action: DeployAction;
      startedMessage: string;
      runningMessage: string;
      setBusy: (busy: boolean) => void;
      useBusyRef?: boolean;
      body?: Record<string, unknown>;
    }) => {
      const { action, startedMessage, runningMessage, setBusy, useBusyRef, body } = opts;
      setBusy(true);
      if (useBusyRef) busyRef.current = true;
      setMessage(startedMessage);
      try {
        const res = await fetch("/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        if (!res.ok) {
          let msg = fallbackForDeployMessage(startedMessage);
          try {
            const errBody = await res.json();
            if (errBody?.error) msg = errBody.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        if (action === "update") {
          const d = await res.json();
          if (d.error) {
            setMessage(d.error);
            setBusy(false);
            if (useBusyRef) busyRef.current = false;
            return;
          }
        }
        setMessage(runningMessage);
        pollDeployStatusRef.current(action);
      } catch (err: unknown) {
        setErrorFromCaught(setMessage, err, fallbackForDeployMessage(startedMessage));
        setBusy(false);
        if (useBusyRef) busyRef.current = false;
      }
    },
    [],
  );

  const handleUpdate = useCallback(() => {
    if (updating || !version?.updateAvailable) return;
    return runDeployAction({
      action: "update",
      startedMessage: "Update started — deploying in background...",
      runningMessage: "Update running…",
      setBusy: setUpdating,
      body: deployBranch ? { branch: deployBranch } : {},
    });
  }, [runDeployAction, deployBranch, updating, version?.updateAvailable]);

  const handleRestart = useCallback(() => {
    if (busyRef.current) return;
    return runDeployAction({
      action: "restart",
      startedMessage: "Restart requested (~/.hermes/logs/ps-restart.log)…",
      runningMessage: "Restarting server…",
      setBusy: setRestarting,
      useBusyRef: true,
    });
  }, [runDeployAction]);

  const doRebuild = useCallback(() => {
    if (busyRef.current) return;
    return runDeployAction({
      action: "rebuild",
      startedMessage: "Rebuild started…",
      runningMessage: "Rebuild running…",
      setBusy: setRebuilding,
      useBusyRef: true,
    });
  }, [runDeployAction]);

  const clearDeployBusy = useCallback(() => {
    setUpdating(false);
    setRestarting(false);
    setRebuilding(false);
    busyRef.current = false;
  }, []);

  useEffect(() => {
    clearDeployBusyRef.current = clearDeployBusy;
  }, [clearDeployBusy]);

  const pollDeployStatus = useCallback(
    (expectedAction: DeployAction) => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      let attempts = 0;
      const maxAttempts = 450;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch("/api/update?deploy=1", {
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return;
          const d = await res.json();
          const deploy = d.data?.deploy as
            | {
                state?: string;
                action?: string;
                phase?: string;
                message?: string;
                logHint?: string;
              }
            | undefined;
          if (!deploy || !isMountedRef.current) return;

          if (deploy.state === "running") {
            const phaseLabel =
              deploy.phase === "build"
                ? "Building…"
                : deploy.phase === "install"
                  ? "Installing dependencies…"
                  : deploy.phase === "restart"
                    ? "Restarting server…"
                    : deploy.phase === "git"
                      ? "Updating code…"
                      : deploy.message || "Working…";
            setMessage(phaseLabel);
            return;
          }

          if (deploy.state === "success") {
            clearInterval(interval);
            pollIntervalRef.current = null;
            clearDeployBusy();
            const label =
              expectedAction === "rebuild"
                ? "Rebuild complete"
                : expectedAction === "restart"
                  ? "Restart complete"
                  : "Update complete";
            setMessage(label);
            setTimeout(() => {
              if (isMountedRef.current) setMessage(null);
            }, 4000);
            return;
          }

          if (deploy.state === "failed") {
            clearInterval(interval);
            pollIntervalRef.current = null;
            clearDeployBusy();
            const hint = deploy.logHint ? ` — see Logs → ${deploy.logHint}` : "";
            setMessage((deploy.message || "Deploy failed") + hint);
          }
        } catch {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            pollIntervalRef.current = null;
            if (!isMountedRef.current) return;
            clearDeployBusy();
            setMessage("Timed out — check ps-restart.log in Logs");
          }
        }
      }, 2000);
      pollIntervalRef.current = interval;
    },
    [clearDeployBusy],
  );

  useEffect(() => {
    pollDeployStatusRef.current = pollDeployStatus;
  }, [pollDeployStatus]);

  const isBusy = updating || restarting || rebuilding;

  // ── Collapsed view ───────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        <div className="flex flex-col items-center gap-2 relative">
          {/* Branch dropdown for collapsed view */}
          {dropdownOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 z-50">
              <BranchDropdown
                branches={branches}
                defaultBranch={selectedBranch}
                onConfirm={handleDropdownConfirm}
                onCancel={() => setDropdownOpen(false)}
                loading={checkState === "checking" || rebuilding}
              />
            </div>
          )}

          {/* Check transforms to orange alert when update available */}
          {checkState === "update-available" ? (
            <button
              onClick={handleUpdate}
              disabled={isBusy}
              className="p-1.5 rounded-lg bg-orange-500/10 text-neon-orange hover:bg-orange-500/20 transition-colors"
              title={`Update available — ${version?.behind} behind`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => openCheckDropdown()}
              disabled={checkState === "checking" || isBusy}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              title={checkState === "checking" ? "Checking..." : "Check for Update"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkState === "checking" ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Rebuild */}
          <button
            onClick={() => doRebuild()}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={message || "Rebuild App"}
          >
            <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={message || "Restart App"}
          >
            <Power className={`w-3.5 h-3.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
          </button>
        </div>
      </>
    );
  }

  // ── Expanded view ────────────────────────────────────────────
  const renderCheckButton = () => {
    if (checkState === "idle") {
      return (
        <button
          onClick={() => openCheckDropdown()}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          Check for Updates
        </button>
      );
    }
    if (checkState === "checking") {
      return (
        <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-mono text-blue-400 opacity-70">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          Checking...
        </button>
      );
    }
    if (checkState === "up-to-date") {
      return (
        <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-mono text-green-400 cursor-default">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          Up to Date
        </button>
      );
    }
    return (
      <button
        onClick={handleUpdate}
        disabled={isBusy}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs font-mono text-neon-orange hover:bg-orange-500/20 transition-colors disabled:opacity-50"
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        Update Available!
      </button>
    );
  };

  return (
    <div className="relative">
      {/* Branch dropdown — anchored above the button row */}
      {dropdownOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 z-50">
          <BranchDropdown
            branches={branches}
            defaultBranch={selectedBranch}
            onConfirm={handleDropdownConfirm}
            onCancel={() => setDropdownOpen(false)}
            loading={checkState === "checking" || rebuilding}
          />
        </div>
      )}

      {/* Button rows — all content lives here so the status message never pushes layout */}
      <div className="space-y-1.5">
        {/* Status message — visible inline when operation is in progress */}
        {message && (
          <div className="min-h-[1.25rem] px-1 text-[10px] font-mono text-white/50 text-center leading-tight">
            {message}
          </div>
        )}
        {/* Check — full width on its own row */}
        {renderCheckButton()}

        {/* Rebuild + Restart — side by side */}
        <div className="flex gap-1.5">
          <button
            type="button"
            title="npm run build + restart (current checkout)"
            onClick={() => doRebuild()}
            disabled={isBusy}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              rebuilding
                ? "bg-neon-purple/20 border border-neon-purple/30 text-neon-purple/90"
                : "bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20"
            }`}
          >
            <Hammer className={`w-3.5 h-3.5 flex-shrink-0 ${rebuilding ? "animate-spin" : ""}`} />
            Rebuild
          </button>

          <button
            type="button"
            title="Restart next-server only (no build)"
            onClick={handleRestart}
            disabled={isBusy}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 ${
              restarting
                ? "bg-red-500/20 border border-red-500/30 text-red-300"
                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
            }`}
          >
            <Power className={`w-3.5 h-3.5 flex-shrink-0 ${restarting ? "animate-spin" : ""}`} />
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
