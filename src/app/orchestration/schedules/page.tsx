// ═══════════════════════════════════════════════════════════════
// Schedules — Control Hub-owned recurring missions
//
// The scheduler tick (orchestration/scheduler) fires these via the runtime;
// Control Hub owns the timer (no Hermes jobs.json). Demonstrates the new data
// layer (TanStack Query via useSchedules), LoadErrorBanner, and live SSE run
// progress.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Clock, Plus, Play, Trash2, RefreshCw } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import RunProgress from "@/components/schedule/RunProgress";
import { useSchedules, useMissionOptions } from "@/hooks/useSchedules";
import { timeUntil } from "@/lib/utils";

const PRESETS = ["every 30m", "every 1h", "0 9 * * *", "0 9 * * 1-5"];

export default function SchedulesPage() {
  const { schedules, isLoading, error, refetch, create, remove, toggle, runNow } = useSchedules();
  const missions = useMissionOptions();

  const [missionId, setMissionId] = useState("");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("every 30m");
  const [catchUpPolicy, setCatchUpPolicy] = useState<"fire_once" | "skip">("fire_once");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!missionId.trim()) {
      setFormError("A mission is required");
      return;
    }
    create.mutate(
      { missionId: missionId.trim(), name: name.trim() || undefined, schedule: schedule.trim(), catchUpPolicy },
      {
        onSuccess: (res) => {
          if (!res.ok) setFormError(res.error ?? "Failed to create schedule");
          else {
            setName("");
            setMissionId("");
          }
        },
      },
    );
  };

  const triggerRun = (id: string) => {
    runNow.mutate(id, {
      onSuccess: (res) => {
        const rid = res.data?.data?.runId;
        if (rid) setActiveRunId(rid);
      },
    });
  };

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-dark-900/60 px-3 py-2 text-sm text-white/80 focus:border-neon-orange/50 focus:outline-none";

  return (
    <AppPageShell>
      <PageHeader
        icon={Clock}
        title="Schedules"
        subtitle="Control Hub-owned recurring missions"
        color="orange"
        backHref="/"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6 flex-1 w-full">
        {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}

        {/* Create form */}
        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-dark-900/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-mono text-white/60">
            <Plus className="w-4 h-4 text-neon-orange" /> New schedule
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/30">Mission</label>
              {missions.data && missions.data.length > 0 ? (
                <select className={inputCls} value={missionId} onChange={(e) => setMissionId(e.target.value)}>
                  <option value="">Select a mission…</option>
                  {missions.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  placeholder="mission id"
                  value={missionId}
                  onChange={(e) => setMissionId(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/30">Name (optional)</label>
              <input className={inputCls} placeholder="daily digest" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/30">
              Schedule (cron or &quot;every Nm/Nh/Nd&quot;)
            </label>
            <input className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSchedule(p)}
                  className="px-2 py-1 rounded-md text-[11px] font-mono border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/5"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              className={`${inputCls} max-w-[180px]`}
              value={catchUpPolicy}
              onChange={(e) => setCatchUpPolicy(e.target.value as "fire_once" | "skip")}
            >
              <option value="fire_once">Catch up: fire once</option>
              <option value="skip">Catch up: skip</option>
            </select>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 rounded-lg text-sm font-mono border border-neon-orange/30 bg-neon-orange/10 text-neon-orange hover:bg-neon-orange/20 transition-colors disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create schedule"}
            </button>
          </div>
          {formError && <div className="text-xs text-red-300 font-mono">{formError}</div>}
        </form>

        {activeRunId && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-white/40">Triggered run</div>
            <RunProgress runId={activeRunId} />
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-white/30 font-mono py-8 text-center">Loading schedules…</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No schedules yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-dark-900/30 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white/80 truncate">{s.name || s.scheduleDisplay || s.schedule}</div>
                  <div className="text-[11px] font-mono text-white/30 truncate">
                    {s.schedule}
                    {" · "}
                    {s.enabled ? (
                      s.nextRunAt ? (
                        <>next {timeUntil(s.nextRunAt)}</>
                      ) : (
                        "no next run"
                      )
                    ) : (
                      "paused"
                    )}
                    {s.lastStatus ? ` · last: ${s.lastStatus}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono border border-white/10 text-white/50 hover:bg-white/5"
                >
                  {s.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerRun(s.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
                >
                  <Play className="w-3 h-3" /> Run
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(s.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-red-500/30 text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
