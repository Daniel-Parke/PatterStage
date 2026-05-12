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
import {
  mainSections,
  configSettingsPinnedLinks,
  configGroups,
} from "./sidebar-config";

import type { SidebarLink, ConfigGroup } from "./sidebar-config";

import { sanitizeGitBranch } from "@/lib/git-branch";

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
  // serverRestarting tracks the gap between "background build/restart fired" and "server actually back up"
  const [serverRestarting, setServerRestarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPurpose, setDropdownPurpose] = useState<"check" | "rebuild">("check");
  const [branches, setBranches] = useState<string[]>(["main", "dev"]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  /** Branch last used for GET /api/update?branch=… — POST update uses the same branch. */
  const [deployBranch, setDeployBranch] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

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

  // Fetch branch list and open dropdown
  const openDropdown = async (purpose: "check" | "rebuild") => {
    setDropdownPurpose(purpose);
    setDropdownOpen(true);
    const pickBranch = (list: string[], apiDefault: unknown): string => {
      const def =
        typeof apiDefault === "string" ? sanitizeGitBranch(apiDefault) : "";
      if (def && list.includes(def)) return def;
      return list[0] ?? "dev";
    };
    try {
      const res = await fetch("/api/update?branches=1");
      const d = await res.json();
      const list: string[] =
        d.data?.branches?.length > 0 ? d.data.branches : ["main", "dev"];
      setBranches(list);
      setSelectedBranch(pickBranch(list, d.data?.default));
    } catch {
      const fallback = ["main", "dev"];
      setBranches(fallback);
      setSelectedBranch(pickBranch(fallback, undefined));
    }
  };

  const handleDropdownConfirm = async (branch: string) => {
    setDropdownOpen(false);
    if (dropdownPurpose === "check") {
      await doCheck(branch);
    } else {
      await doRebuild(branch);
    }
  };

  // Check version against a specific branch
  const doCheck = async (branch: string) => {
    setCheckState("checking");
    setMessage(null);
    try {
      const res = await fetch(`/api/update?branch=${encodeURIComponent(branch)}`);
      const d = await res.json();
      if (d.data) {
        setVersion(d.data);
        setDeployBranch(branch);
        setCheckState(d.data.updateAvailable ? "update-available" : "up-to-date");
      } else {
        setCheckState("idle");
        setMessage("Check failed");
      }
    } catch {
      setCheckState("idle");
      setMessage("Check failed");
    }
  };

  const handleUpdate = async () => {
    if (updating || !version?.updateAvailable) return;
    setUpdating(true);
    setMessage("Update started — deploying in background...");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          ...(deployBranch ? { branch: deployBranch } : {}),
        }),
      });
      const d = await res.json();
      if (d.error) {
        setMessage(d.error);
        setUpdating(false);
        return;
      }
      setMessage("Update running in background (~/.hermes/logs/ch-update.log)…");
      pollForReturn();
    } catch {
      setMessage("Update failed");
      setUpdating(false);
    }
  };

  const handleRestart = async () => {
    if (restarting) return;
    setRestarting(true);
    setMessage("Restart requested (~/.hermes/logs/ch-restart.log)…");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });
      if (!res.ok) {
        let msg = "Restart failed";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      setServerRestarting(true);
      setMessage("Restarting server (~/.hermes/logs/ch-restart.log)…");
      pollForReturn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Restart failed";
      setMessage(msg);
      setRestarting(false);
    }
  };

  const doRebuild = async (branch: string) => {
    if (rebuilding) return;
    setRebuilding(true);
    setDeployBranch(branch);
    setMessage("Rebuilding...");
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild", branch }),
      });
      if (!res.ok) {
        let msg = "Rebuild failed";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      setMessage("Build started — restarting server…");
      setServerRestarting(true);
      pollForReturn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rebuild failed";
      setMessage(msg);
      setRebuilding(false);
    }
  };

  const pollForReturn = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const branchQs =
          deployBranch != null
            ? `?branch=${encodeURIComponent(deployBranch)}`
            : "";
        const res = await fetch(`/api/update${branchQs}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          const d = await res.json();
          if (!isMountedRef.current) return;
          if (d.data) setVersion(d.data);
          setUpdating(false);
          setRestarting(false);
          setRebuilding(false);
          setServerRestarting(false);
          setCheckState(d.data?.updateAvailable ? "update-available" : "up-to-date");
          setMessage("Done!");
          setTimeout(() => {
            if (isMountedRef.current) setMessage(null);
          }, 3000);
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          pollIntervalRef.current = null;
          if (!isMountedRef.current) return;
          setUpdating(false);
          setRestarting(false);
          setRebuilding(false);
          setServerRestarting(false);
          setMessage("Timeout — check server");
        }
      }
    }, 2000);
    pollIntervalRef.current = interval;
  };

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
              onClick={() => openDropdown("check")}
              disabled={checkState === "checking" || isBusy}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              title={checkState === "checking" ? "Checking..." : "Check for Update"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkState === "checking" ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Rebuild */}
          <button
            onClick={() => openDropdown("rebuild")}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title={message || "Rebuild App"}
          >
            <Hammer className={`w-3.5 h-3.5 ${rebuilding ? "animate-spin" : ""}`} />
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={message || "Restart App"}
          >
            <Power className={`w-3.5 h-3.5 ${restarting ? "animate-spin" : ""}`} />
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
          onClick={() => openDropdown("check")}
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
            {serverRestarting ? "Restarting server…" : message}
          </div>
        )}

        {/* Check — full width on its own row */}
        {renderCheckButton()}

        {/* Rebuild + Restart — side by side */}
        <div className="flex gap-1.5">
          <button
            onClick={() => openDropdown("rebuild")}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neon-purple/10 border border-neon-purple/20 text-xs font-mono text-neon-purple hover:bg-neon-purple/20 transition-colors disabled:opacity-50"
          >
            <Hammer className={`w-3.5 h-3.5 ${rebuilding ? "animate-spin" : ""}`} />
            {serverRestarting ? "Restarting…" : rebuilding ? "…" : "Rebuild"}
          </button>

          <button
            onClick={handleRestart}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Power className={`w-3.5 h-3.5 ${restarting ? "animate-spin" : ""}`} />
            {restarting ? "Restarting…" : "Restart"}
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
