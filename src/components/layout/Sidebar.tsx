// ═══════════════════════════════════════════════════════════════

// Sidebar Navigation — Config Settings with categorized groups

// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { useSidebar } from "./SidebarContext";

import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Terminal,
  Settings,
  RefreshCw,
  AlertTriangle,
  Check,
  Hammer,
  Power,
} from "lucide-react";

import { iconColorMap } from "@/lib/theme";
import { setErrorFromCaught, safeApiCallData } from "@/lib/api-fetch";
import {
  mainSections,
  configSettingsPinnedLinks,
  configGroups,
} from "./sidebar-config";

import type { SidebarLink, ConfigGroup } from "./sidebar-config";

import { sanitizeGitBranch } from "@/lib/git-branch";
import { fallbackForDeployMessage } from "@/lib/deploy-action-fallback";

/** The three deploy actions supported by POST /api/update. */
type DeployAction = "update" | "restart" | "rebuild";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  return pathname.startsWith(href);
}

// ── Branch Dropdown ─────────────────────────────────────────────
// Inline dropdown anchored above the footer buttons, not a modal overlay.

function BranchDropdown({
  branches,
  defaultBranch,
  onConfirm,
  onCancel,
  loading,
}: {
  branches: string[];
  defaultBranch: string;
  onConfirm: (branch: string) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [selected, setSelected] = useState(defaultBranch);
  const [customBranch, setCustomBranch] = useState("");

  // Close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/10 bg-dark-950 shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-mono text-white/50">Branch</span>
        <button
          onClick={onCancel}
          className="p-0.5 rounded text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md bg-dark-900 border border-white/10 text-white text-xs focus:outline-none focus:border-neon-cyan/50"
        >
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className="block mt-2 text-[10px] font-mono text-white/40 uppercase tracking-wide">
          Other branch
        </label>
        <input
          type="text"
          value={customBranch}
          onChange={(e) => setCustomBranch(e.target.value)}
          placeholder="e.g. feature/my-branch"
          className="w-full mt-0.5 px-2 py-1.5 rounded-md bg-dark-900 border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-neon-cyan/50"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-2 pb-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1 rounded text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onConfirm(
              customBranch.trim()
                ? sanitizeGitBranch(customBranch)
                : selected,
            )
          }
          disabled={loading || (!customBranch.trim() && !selected)}
          className="px-3 py-1 rounded text-xs font-medium bg-neon-cyan text-dark-900 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

// ── Version Check & Update ─────────────────────────────────────

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

function VersionFooter({ collapsed }: { collapsed: boolean }) {
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
      const def =
        typeof apiDefault === "string" ? sanitizeGitBranch(apiDefault) : "";
      if (def && list.includes(def)) return def;
      return list[0] ?? "dev";
    };
    // Envelope-typed: the route returns `{ data: { branches, default } }`.
    // `safeApiCallData<T>` returns `T | null` (the inner payload directly —
    // no manual `data?.data` indirection). On error it returns `null` and
    // falls through to the same `["main", "dev"]` fallback the inline
    // `try/catch` previously had. The "if data" branch reads the list
    // and default directly from the unwrapped payload.
    const data = await safeApiCallData<{ branches: string[]; default: string }>(
      "/api/update?branches=1",
    );
    const list: string[] =
      data && data.branches.length > 0 ? data.branches : ["main", "dev"];
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
    // Envelope-typed: the route returns `{ data: { ...ver, branch } }` where
    // `ver` is the full `VersionCache` shape (see `api/update/route.ts`).
    // `safeApiCallData<T>` returns `T | null`; on error the original
    // inline form set `d.data` to undefined and took the "Check failed"
    // branch — the helper's `null` return maps to the same branch.
    // Matches the envelope + safeApiCallData shape used by every other
    // read-only fetch in this file.
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
  //
  // POST /api/update supports three actions: update, restart, rebuild.
  // The three click handlers (handleUpdate, handleRestart, doRebuild)
  // shared an identical shape:
  //   1. early-return on busy
  //   2. setMessage("X started…")
  //   3. POST {action, ...extras} to /api/update
  //   4. if !res.ok, parse {error} and throw
  //   5. on success, setMessage("X running…") and pollDeployStatus(action)
  //   6. catch: setMessage(err.message || fallback) + clear busy
  //
  // The only differences are: the action name, the started/running
  // messages, the busy setter, and (for update) the optional branch
  // body + the d.error check. The helper below collapses them.
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
          } catch { /* ignore */ }
          throw new Error(msg);
        }
        // Update reads the response body for the synchronous error
        // envelope ({error: "..."}); restart/rebuild trust the 2xx and
        // let the poll surface failure. We only need the parsed body
        // when the caller asked for it — update is the only one.
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
      startedMessage: "Restart requested (~/.hermes/logs/ch-restart.log)…",
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

  // Sync the forward-declared refs (clearDeployBusyRef, pollDeployStatusRef) to
  // the latest closures. Done in an effect so React's react-hooks/refs rule
  // doesn't flag ref mutations during render. clearDeployBusy and
  // pollDeployStatus are useCallback'd above so this effect only runs on mount
  // and on dep change (stable).
  useEffect(() => {
    clearDeployBusyRef.current = clearDeployBusy;
  }, [clearDeployBusy]);

  const pollDeployStatus = useCallback((expectedAction: DeployAction) => {
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
        const deploy = d.data?.deploy as {
          state?: string;
          action?: string;
          phase?: string;
          message?: string;
          logHint?: string;
        } | undefined;
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
          setMessage("Timed out — check ch-restart.log in Logs");
        }
      }
    }, 2000);
    pollIntervalRef.current = interval;
  }, [clearDeployBusy]);

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
  // Row 1: Check button (full-width)
  // Row 2: Rebuild | Restart side-by-side
  // Dropdown appears above row 1 when open

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

function ConfigGroupSection({
  group,

  collapsed,

  renderLink,

  pathname,
}: {
  group: ConfigGroup;

  collapsed: boolean;

  renderLink: (link: SidebarLink) => React.ReactNode;

  pathname: string;
}) {
  const [open, setOpen] = useState(() => {
    // Lazy init: auto-expand if any link in this group is active
    return (
      group.defaultOpen ??
      group.links.some(
        (link) =>
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href)),
      )
    );
  });

  if (collapsed) {
    return <>{group.links.map((link) => renderLink(link))}</>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-1 mt-3 first:mt-0 hover:text-white/50 transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />

        {group.label}
      </button>

      {open && (
        <div className="space-y-0.5">
          {group.links.map((link) => renderLink(link))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  const { mobileOpen, setMobileOpen } = useSidebar();

  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  const renderLink = useCallback(
    (link: SidebarLink) => {
      const active = isActive(pathname, link.href);
      const showSubs = active && link.subLinks && !collapsed;

      return (
        <div key={link.href}>
          <Link
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
            onClick={closeMobile}
          >
            <link.icon
              className={`w-4 h-4 flex-shrink-0 ${
                active ? iconColorMap[link.color] : ""
              }`}
            />
            {!collapsed && <span>{link.label}</span>}
          </Link>
          {showSubs && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-white/5 pl-3">
              {link.subLinks!.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`block py-1 text-xs transition-colors ${
                    pathname === sub.href
                      ? "text-white/80"
                      : "text-white/30 hover:text-white/60"
                  }`}
                  onClick={closeMobile}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    },
    [pathname, collapsed, closeMobile],
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo — min-height matches main app chrome (see --ch-shell-header-min-height) */}

      <div className="px-4 min-h-[var(--ch-shell-header-min-height)] flex items-center border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg animated-border p-[1.5px]">
            <div className="w-full h-full bg-dark-900 rounded-[5px] flex items-center justify-center">
              <Terminal className="w-4 h-4 text-neon-cyan" />
            </div>
          </div>

          {!collapsed && (
            <div>
              <div className="text-sm font-bold tracking-tight">
                <span className="text-neon-cyan">PT</span>

                <span className="text-white/40 mx-0.5">/</span>

                <span className="text-white">Hermes</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Main Nav */}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Main + Agent sections */}

        {mainSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-2 mt-4 first:mt-0">
                {section.label}
              </div>
            )}

            {section.links
              .map(renderLink)}
          </div>
        ))}

        {/* Config Settings section */}

        {!collapsed && (
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest px-3 mb-2 mt-4">
            Config Settings
          </div>
        )}

        {collapsed && <div className="my-2 border-t border-white/10" />}

        {configSettingsPinnedLinks.map((link) => renderLink(link))}

        {/* All Settings link */}

        {renderLink({
          icon: Settings,

          label: "All Settings",

          href: "/config",

          color: "purple",
        })}

        {/* Grouped config sections */}

        {configGroups.map((group) => (
          <ConfigGroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            renderLink={renderLink}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Footer */}

      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
        <VersionFooter collapsed={collapsed} />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors font-mono"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />

              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}

      <aside
        className={`hidden lg:flex flex-col bg-dark-900/80 border-r border-white/10 backdrop-blur-xl transition-all duration-200 h-screen ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile drawer */}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-56 bg-dark-950 border-r border-white/10 transform transition-transform h-screen ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
