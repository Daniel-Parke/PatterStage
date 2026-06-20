// ═══════════════════════════════════════════════════════════════
// ScheduledMissions — recurring agent missions on the PatterStage scheduler
//
// Folded into the Missions page (replaces the standalone Schedules page). The
// scheduler tick (orchestration/scheduler) fires these via the runtime — CH
// owns the timer, no Hermes jobs.json. Lists schedules with pause/resume/
// run-now/delete, plus a compact form to put an existing saved mission on a
// timer (new missions get a schedule straight from the composer's "Schedule"
// dispatch mode).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { CalendarClock, Plus, Play, Trash2, ChevronDown } from "lucide-react";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import RunProgress from "@/components/schedule/RunProgress";
import { useSchedules, useMissionOptions } from "@/hooks/useSchedules";
import { timeUntil } from "@/lib/utils";

const PRESETS = ["every 30m", "every 1h", "0 9 * * *", "0 9 * * 1-5"];

export default function ScheduledMissions() {
  const { schedules, isLoading, error, refetch, create, remove, toggle, runNow } = useSchedules();
  const missions = useMissionOptions();

  const [showForm, setShowForm] = useState(false);
  const [missionId, setMissionId] = useState("");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("every 30m");
  const [catchUpPolicy, setCatchUpPolicy] = useState<"fire_once" | "skip">("fire_once");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const enabledCount = schedules.filter((s) => s.enabled).length;
  const pausedCount = schedules.length - enabledCount;

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
            setShowForm(false);
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
    <section className="mt-6">
      {/* ── Section header ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-neon-orange" />
          <h2 className="font-mono text-sm uppercase tracking-wider text-white/60">Scheduled missions</h2>
          {schedules.length > 0 && (
            <span className="font-mono text-[11px] text-white/35">
              {enabledCount} active{pausedCount > 0 ? ` · ${pausedCount} paused` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-neon-orange/30 bg-neon-orange/10 px-3 py-1.5 font-mono text-xs text-neon-orange transition-colors hover:bg-neon-orange/20"
        >
          {showForm ? <ChevronDown className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Schedule a mission
        </button>
      </div>

      {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}

      {/* ── Create form (collapsible) ── */}
      {showForm && (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-xl border border-white/10 bg-dark-900/30 p-4">
          <p className="font-mono text-[11px] text-white/35">
            Put an existing saved mission on a timer. (New missions can be scheduled directly from the composer&apos;s
            &quot;Schedule&quot; dispatch mode.)
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <input className={inputCls} placeholder="mission id" value={missionId} onChange={(e) => setMissionId(e.target.value)} />
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
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSchedule(p)}
                  className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70"
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
              className="rounded-lg border border-neon-orange/30 bg-neon-orange/10 px-4 py-2 font-mono text-sm text-neon-orange transition-colors hover:bg-neon-orange/20 disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create schedule"}
            </button>
          </div>
          {formError && <div className="font-mono text-xs text-red-300">{formError}</div>}
        </form>
      )}

      {activeRunId && (
        <div className="mb-3 space-y-2">
          <div className="font-mono text-xs text-white/40">Triggered run</div>
          <RunProgress runId={activeRunId} />
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="py-6 text-center font-mono text-sm text-white/30">Loading schedules…</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-dark-900/20 px-4 py-6 text-center text-sm text-white/30">
          No recurring missions yet. Use a mission&apos;s <span className="text-white/50">Schedule</span> dispatch mode, or schedule an existing one above.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-dark-900/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white/80">{s.name || s.scheduleDisplay || s.schedule}</div>
                <div className="truncate font-mono text-[11px] text-white/30">
                  {s.schedule}
                  {" · "}
                  {s.enabled ? (s.nextRunAt ? <>next {timeUntil(s.nextRunAt)}</> : "no next run") : "paused"}
                  {s.lastStatus ? ` · last: ${s.lastStatus}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}
                className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/50 hover:bg-white/5"
              >
                {s.enabled ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={() => triggerRun(s.id)}
                className="flex items-center gap-1 rounded-lg border border-neon-cyan/30 px-2.5 py-1 font-mono text-[11px] text-neon-cyan hover:bg-neon-cyan/10"
              >
                <Play className="h-3 w-3" /> Run
              </button>
              <button
                type="button"
                onClick={() => remove.mutate(s.id)}
                className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 font-mono text-[11px] text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
