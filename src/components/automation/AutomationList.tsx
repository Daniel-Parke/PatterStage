// ═══════════════════════════════════════════════════════════════
// AutomationList — everything on a clock, in one place and once.
//
// Decision 9. Two surfaces used to answer "what runs tonight" and neither
// answered it fully:
//
//   `ScheduledMissions`, a section at the foot of the Missions page, listed
//   PatterStage's own schedule table. That table holds both kinds already — a
//   recurring mission, and a script on a machine with no scheduler of its own —
//   so it looked complete, and was not.
//
//   The Scripts page listed host scripts with their schedules inline. A script
//   scheduled into the HOST crontab lives only there: PatterStage's table knows
//   nothing about it, so it appeared on Scripts and was missing from the
//   schedules section entirely.
//
// The union has to be a REAL union. A script scheduled through PatterStage is
// in both reads, and listing it twice would be a worse answer than the two
// screens this replaces — so the host read is filtered to the rows PatterStage
// does not own, and each row says which scheduler holds it, because
// unscheduling goes to a different place for each.
//
// Missions keeps dispatch. Scripts keeps its file list and its per-row schedule
// action, which is a property of a file rather than a section about clocks.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { CalendarClock, Plus, Play, Trash2, ChevronDown } from "lucide-react";

import { sectionHeadingClasses } from "@/lib/theme";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import ConfirmButton from "@/components/ui/ConfirmButton";
import RunProgress from "@/components/schedule/RunProgress";
import ConceptHint from "@/components/help/ConceptHint";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/field";
import { useSchedules, useMissionOptions } from "@/hooks/useSchedules";
import { useScripts } from "@/hooks/useScripts";
import { describeScheduleTarget } from "@/lib/schedule/schedule-target";
import { timeUntil } from "@/lib/utils";

const PRESETS = ["every 30m", "every 1h", "0 9 * * *", "0 9 * * 1-5"];

/** One row of the merged list, whichever scheduler it came from. */
interface AutomationRow {
  key: string;
  /** "Mission" or "Script". */
  kindLabel: string;
  /** What it fires. */
  target: string;
  /** True when the row names nothing that could be found, so it cannot fire. */
  missing: boolean;
  /** The row's own name, or its clock when it has none. */
  title: string;
  clock: string;
  /** Which scheduler owns it: PatterStage's table, or the host's crontab. */
  owner: "PatterStage" | "Host";
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastRunId: string | null;
  /** Present only for rows PatterStage can act on. */
  scheduleId: string | null;
}

function formatWhen(iso: string): string {
  // Fixed locale and zone: a schedule list read on two machines must say the
  // same thing, and the e2e clock is pinned to UTC.
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export default function AutomationList() {
  const { schedules, isLoading, error, refetch, create, remove, toggle, runNow } = useSchedules();
  const { scripts } = useScripts();
  const missions = useMissionOptions();

  const [showForm, setShowForm] = useState(false);
  const [missionId, setMissionId] = useState("");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("every 30m");
  const [catchUpPolicy, setCatchUpPolicy] = useState<"fire_once" | "skip">("fire_once");
  const [formError, setFormError] = useState<string | null>(null);
  // Delete, pause and Run now used to fail in silence. This view has no toast
  // provider of its own, so the house read-failure banner is also its
  // write-failure banner (T-0104, D73).
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const owned: AutomationRow[] = schedules.map((s) => {
    const target = describeScheduleTarget(s);
    return {
      key: s.id,
      kindLabel: target.kindLabel,
      target: target.name,
      missing: target.missing,
      title: s.name || s.scheduleDisplay || s.schedule,
      clock: s.schedule,
      owner: "PatterStage",
      enabled: s.enabled,
      nextRunAt: s.nextRunAt,
      lastRunAt: s.lastRunAt,
      lastStatus: s.lastStatus,
      lastRunId: s.lastRunId,
      scheduleId: s.id,
    };
  });

  // The host crontab's rows, minus the ones PatterStage already owns: a script
  // scheduled THROUGH PatterStage appears in both reads.
  const hosted: AutomationRow[] = scripts
    .filter((s) => s.schedule && s.scheduleSource === "host")
    .map((s) => ({
      key: `host:${s.name}`,
      kindLabel: "Script",
      target: s.name,
      missing: false,
      title: s.name,
      clock: s.schedule as string,
      owner: "Host",
      // A crontab entry is on or it is not there; the host has no pause.
      enabled: true,
      nextRunAt: null,
      lastRunAt: s.lastRun,
      lastStatus: s.lastOutcome,
      lastRunId: null,
      scheduleId: null,
    }));

  const rows = [...owned, ...hosted];
  const enabledCount = rows.filter((r) => r.enabled).length;
  const pausedCount = rows.length - enabledCount;

  const failWith = (fallback: string) => (err: unknown) =>
    setActionError(err instanceof Error && err.message ? err.message : fallback);

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
        onSuccess: () => {
          setName("");
          setMissionId("");
          setShowForm(false);
        },
        onError: (err) =>
          setFormError(err instanceof Error && err.message ? err.message : "Failed to create schedule"),
      },
    );
  };

  const triggerRun = (id: string) => {
    setActionError(null);
    runNow.mutate(id, {
      onSuccess: (res) => {
        const rid = res.data?.data?.runId;
        if (rid) setActiveRunId(rid);
      },
      onError: failWith("Failed to start the run"),
    });
  };


  return (
    /* The mission panel's "Edit schedule" link targets this anchor. */
    <section id="scheduled-missions">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-neon-orange" />
          <h2 className={sectionHeadingClasses}>
            <ConceptHint id="schedule">Schedules</ConceptHint>
          </h2>
          {rows.length > 0 && (
            <span className="font-mono text-micro text-ps-text-muted">
              {enabledCount} active{pausedCount > 0 ? ` · ${pausedCount} paused` : ""}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          color="orange"
          size="sm"
          icon={showForm ? ChevronDown : Plus}
          onClick={() => setShowForm((v) => !v)}
        >
          Schedule a mission
        </Button>
      </div>

      {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}
      {actionError && <LoadErrorBanner error={actionError} onRetry={() => setActionError(null)} />}

      {showForm && (
        <Card as="section" className="mb-3">
        <form onSubmit={submit} className="space-y-3">
          <p className="font-mono text-micro text-ps-text-muted">
            Put an existing saved mission on a timer. (A new mission can be scheduled from the composer&apos;s
            &quot;Schedule&quot; dispatch mode, and a script from its row on Scripts.)
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Mission">
              {missions.data && missions.data.length > 0 ? (
                <Select
                  ariaLabel="Mission"
                  value={missionId}
                  onChange={setMissionId}
                  placeholder="Select a mission…"
                  options={missions.data.map((m) => ({ value: m.id, label: m.name || m.id }))}
                />
              ) : (
                <Input
                  placeholder="mission id"
                  aria-label="Mission to schedule, by id"
                  value={missionId}
                  onChange={(e) => setMissionId(e.target.value)}
                />
              )}
            </Field>
            <Field label="Name" hint="Optional. What you will recognise it by in the list.">
              <Input
                placeholder="daily digest"
                aria-label="Schedule name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Schedule" hint={'A cron expression, or "every 30m" / "every 2h" / "every 1d".'}>
            <Input
              aria-label="Schedule (cron, or every Nm/Nh/Nd)"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p} size="sm" onClick={() => setSchedule(p)}>
                {p}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="Catch-up"
              hint="What to do about a firing missed while PatterStage was not running."
              className="max-w-[220px] flex-1"
            >
              <Select
                ariaLabel="Catch-up policy"
                value={catchUpPolicy}
                onChange={(v) => setCatchUpPolicy(v as "fire_once" | "skip")}
                options={[
                  { value: "fire_once", label: "Fire once" },
                  { value: "skip", label: "Skip" },
                ]}
              />
            </Field>
            <Button type="submit" variant="primary" color="orange" loading={create.isPending}>
              {create.isPending ? "Creating…" : "Create schedule"}
            </Button>
          </div>
          {formError && <div className="font-mono text-micro text-status-fail">{formError}</div>}
        </form>
        </Card>
      )}

      {activeRunId && (
        <div className="mb-3 space-y-2">
          <div className="font-mono text-micro text-ps-text-muted">Triggered run</div>
          <RunProgress runId={activeRunId} />
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center font-mono text-body text-ps-text-muted">Loading schedules…</div>
      ) : rows.length === 0 ? (
        // design-lint-disable-next-line no-inline-card-chrome -- a dashed edge is the empty state saying "nothing yet", which is a different idea from a surface; Card draws a solid one and this is the one place the difference is the message
        <div className="rounded-ps-lg border border-dashed border-ps-edge-hairline bg-ps-surface-panel px-4 py-6 text-center text-body text-ps-text-muted">
          Nothing is on a clock yet. Put a saved mission on a timer above, use a mission&apos;s{" "}
          <span className="text-ps-text-secondary">Schedule</span> dispatch mode, or schedule a script from its row on
          Scripts.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card
              key={row.key}
              data-testid={`automation-row-${row.key}`}
              padding="sm"
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-ps-sm border border-ps-edge px-1.5 py-0.5 font-mono text-micro uppercase tracking-wider text-ps-text-muted">
                    {row.kindLabel}
                  </span>
                  <span className="truncate text-body text-ps-text-primary">{row.title}</span>
                  {/* Which scheduler holds it. Not decoration: unscheduling a
                      host row edits the crontab and a PatterStage row edits the
                      table, and only one of them can be paused. */}
                  <span
                    data-testid="owner"
                    className="shrink-0 font-mono text-micro text-ps-text-faint"
                  >
                    {row.owner}
                  </span>
                </div>
                <div className="truncate font-mono text-micro text-ps-text-muted">
                  {/* What it fires, then its clock - but only when the target
                      says something the title does not. A PatterStage row's
                      title is a nickname an operator chose and is often the
                      same on two rows over two different missions, so naming
                      the mission is the whole point; a host row's title IS the
                      script, and repeating it is noise. */}
                  {row.target !== row.title && (
                    <>
                      <span className={row.missing ? "text-neon-orange" : "text-ps-text-secondary"}>
                        {row.target}
                      </span>
                      {" · "}
                    </>
                  )}
                  {row.clock}
                </div>
              </div>

              <div data-testid="next-run" className="font-mono text-micro text-ps-text-muted">
                {row.enabled
                  ? row.nextRunAt
                    ? `next ${timeUntil(row.nextRunAt)}`
                    : row.owner === "Host"
                      ? "next: ask the host"
                      : "no next run"
                  : "paused"}
              </div>

              {/* A status with no time and no log is a claim you cannot check,
                  which is what the old row printed. */}
              <div data-testid="last-run" className="font-mono text-micro text-ps-text-muted">
                {row.lastRunAt ? (
                  <>
                    last {formatWhen(row.lastRunAt)}
                    {row.lastStatus ? ` · ${row.lastStatus}` : ""}
                  </>
                ) : (
                  "never run"
                )}
                {row.lastRunId && (
                  <>
                    {" · "}
                    <a
                      href={`/results/logs?run=${encodeURIComponent(row.lastRunId)}`}
                      className="text-neon-cyan hover:underline"
                    >
                      Log
                    </a>
                  </>
                )}
              </div>

              {row.scheduleId && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      toggle.mutate(
                        { id: row.scheduleId as string, enabled: !row.enabled },
                        { onError: failWith("Failed to update the schedule") },
                      );
                    }}
                  >
                    {row.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Play}
                    onClick={() => triggerRun(row.scheduleId as string)}
                  >
                    Run
                  </Button>
                  {/* Its own instance per row, so an arm on one row cannot fire
                      on another, and the armed button is never disabled (D66). */}
                  <ConfirmButton
                    variant="danger"
                    size="sm"
                    aria-label={`Delete the schedule "${row.title}"`}
                    confirmLabel="Confirm?"
                    onConfirm={() => {
                      setActionError(null);
                      remove.mutate(row.scheduleId as string, {
                        onError: failWith("Failed to delete the schedule"),
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </ConfirmButton>
                </>
              )}
              {/* A host row is the crontab's, and PatterStage will not edit
                  someone else's crontab from a list. Scripts owns that action,
                  where the file it belongs to is. */}
              {!row.scheduleId && (
                <span className="font-mono text-micro text-ps-text-faint">manage on Scripts</span>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
