// ═══════════════════════════════════════════════════════════════
// useVersionFooter - the stateful core of the sidebar's deploy block
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/components/layout/VersionFooter.tsx, which was 475
// lines of state machine and JSX in one file. Everything that talks to
// /api/update lives here: the version check, the branch dropdown, the
// three deploy actions, the two-step confirm and the status poll. The
// components render what this returns and own no fetch of their own.
//
// This hook is the file that names the restart log inside the Hermes
// home, and it deliberately stays under src/hooks/ rather than moving into
// src/lib/runtime/ or src/modules/hermes/: those prefixes are exempt from
// design-lint's hermes-outside-adapter rule, and moving a Hermes-touching
// string there to silence the rule would be laundering the exemption, not
// paying the debt. The baselined crossing moves with the code and stays
// visible at its original count.
//
// Four things it tells the truth about, since T-0095:
//   - whether the deploy API is on at all, read on mount (D53);
//   - a version check that could not be made, as its own state (D107);
//   - the last lines of the deploy log after a failure (D108);
//   - a deploy that never reaches a terminal state, released after the
//     attempt cap on EVERY tick, not only on thrown ones (D111).

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { setErrorFromCaught, safeApiCallData } from "@/lib/api-fetch";
import { sanitizeGitBranch } from "@/lib/git/git-branch";
import { fallbackForDeployMessage } from "@/lib/deploy-action-fallback";
import {
  DeployAction,
  deployCompletionLabel,
  deployPhaseLabel,
} from "@/lib/deploy-action-labels";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

// VersionCheckState and VersionInfo stay module-private, as they were
// before the split: VersionFooterState is the only shape a caller needs,
// and exporting the two it is built from would add unused public names to
// the knip report.

/** Where the "Check for updates" button is in its little state machine. */
type VersionCheckState =
  | "idle"
  | "checking"
  | "up-to-date"
  | "update-available"
  | "check-failed";

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
  /** The compare could not be made; `updateAvailable` says nothing then. */
  checkFailed?: boolean;
}

/** GET /api/update?deploy=1, the answer the mount read and the poll share. */
interface DeployStatusAnswer {
  deploy?: {
    state?: string;
    action?: string;
    phase?: string;
    message?: string;
    logHint?: string;
    logTail?: string[];
  };
  deployEnabled?: boolean;
}

export interface VersionFooterState {
  version: VersionInfo | null;
  checkState: VersionCheckState;
  restarting: boolean;
  rebuilding: boolean;
  /** True while any of update/restart/rebuild is in flight. */
  isBusy: boolean;
  message: string | null;
  dropdownOpen: boolean;
  branches: string[];
  selectedBranch: string;
  /** Whether POST /api/update is enabled on this install; null until known. */
  deployEnabled: boolean | null;
  /** The last lines of the deploy log after a failed action; empty otherwise. */
  deployLogTail: string[];
  openCheckDropdown: () => Promise<void>;
  closeDropdown: () => void;
  handleDropdownConfirm: (branch: string) => Promise<void>;
  handleUpdate: () => void;
  onRebuildClick: () => void;
  onRestartClick: () => void;
  isArmedFor: (key: string) => boolean;
}

const POLL_INTERVAL_MS = 2000;
/** 450 polls at 2s: fifteen minutes, the same cap as before, now on every tick. */
const MAX_POLL_ATTEMPTS = 450;

export function useVersionFooter(): VersionFooterState {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [checkState, setCheckState] = useState<VersionCheckState>("idle");
  const [updating, setUpdating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deployEnabled, setDeployEnabled] = useState<boolean | null>(null);
  const [deployLogTail, setDeployLogTail] = useState<string[]>([]);
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

  // Learn on mount whether the deploy API is on, so the block can say so
  // before the click rather than 403 after it (D53).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await safeApiCallData<DeployStatusAnswer>("/api/update?deploy=1");
      if (cancelled || !isMountedRef.current) return;
      if (typeof data?.deployEnabled === "boolean") setDeployEnabled(data.deployEnabled);
    })();
    return () => {
      cancelled = true;
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
      setCheckState("check-failed");
      setMessage("Could not check for updates.");
      return;
    }
    setVersion(data);
    setDeployBranch(branch);
    if (data.checkFailed) {
      // A fourth state. "unknown" hashes with updateAvailable:false used to
      // paint the button green (D107).
      setCheckState("check-failed");
      setMessage("Could not check for updates: git could not reach origin.");
      return;
    }
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
      setDeployLogTail([]);
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
      // design-lint-disable-next-line hermes-outside-adapter -- a restart kills the server that would otherwise report on it, so this toast is the last thing the operator sees. Naming the log file is the only way they can find out how the restart went.
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

  // Rebuild + Restart take the app down — require a second click to confirm
  // (two-step, auto-dismissing) rather than firing on a single mis-click.
  // `confirm` is renamed on the way in so the two-step hook's method never
  // reads as the native window.confirm the design-lint rule forbids.
  const { isArmedFor, arm, confirm: confirmArmed } = useTwoStepConfirm({ autoDismissMs: 4000 });
  const onRebuildClick = useCallback(() => {
    if (isArmedFor("rebuild")) void confirmArmed(doRebuild);
    else arm("rebuild");
  }, [isArmedFor, confirmArmed, arm, doRebuild]);
  const onRestartClick = useCallback(() => {
    if (isArmedFor("restart")) void confirmArmed(handleRestart);
    else arm("restart");
  }, [isArmedFor, confirmArmed, arm, handleRestart]);

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
      const stop = () => {
        clearInterval(interval);
        pollIntervalRef.current = null;
      };
      const interval = setInterval(async () => {
        attempts++;
        // The cap applies to every tick. It used to live inside the catch, so
        // only thrown polls counted, and a status file stuck on "running"
        // held the buttons for ever (D111).
        if (attempts > MAX_POLL_ATTEMPTS) {
          stop();
          if (!isMountedRef.current) return;
          clearDeployBusy();
          setMessage("Timed out waiting for the deploy. Check ps-restart.log in Logs.");
          return;
        }
        try {
          const res = await fetch("/api/update?deploy=1", {
            signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
          });
          if (!res.ok) return;
          const d = (await res.json()) as { data?: DeployStatusAnswer };
          const deploy = d.data?.deploy;
          if (!deploy || !isMountedRef.current) return;

          if (deploy.state === "running") {
            setMessage(deployPhaseLabel(deploy));
            return;
          }

          if (deploy.state === "success") {
            stop();
            clearDeployBusy();
            setMessage(deployCompletionLabel(expectedAction));
            setTimeout(() => {
              if (isMountedRef.current) setMessage(null);
            }, 4000);
            return;
          }

          if (deploy.state === "failed") {
            stop();
            clearDeployBusy();
            const hint = deploy.logHint ? ` — see Logs → ${deploy.logHint}` : "";
            setMessage((deploy.message || "Deploy failed") + hint);
            // The route computes the tail on every failed read; keep it (D108).
            setDeployLogTail(Array.isArray(deploy.logTail) ? deploy.logTail : []);
          }
        } catch {
          // A transient network error while the server restarts. The cap above
          // ends the poll if it never comes back.
        }
      }, POLL_INTERVAL_MS);
      pollIntervalRef.current = interval;
    },
    [clearDeployBusy],
  );

  useEffect(() => {
    pollDeployStatusRef.current = pollDeployStatus;
  }, [pollDeployStatus]);

  const isBusy = updating || restarting || rebuilding;

  return {
    version,
    checkState,
    restarting,
    rebuilding,
    isBusy,
    message,
    dropdownOpen,
    branches,
    selectedBranch,
    deployEnabled,
    deployLogTail,
    openCheckDropdown,
    closeDropdown: () => setDropdownOpen(false),
    handleDropdownConfirm,
    handleUpdate,
    onRebuildClick,
    onRestartClick,
    isArmedFor,
  };
}
