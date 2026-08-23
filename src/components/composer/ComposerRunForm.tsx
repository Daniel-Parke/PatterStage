// ═══════════════════════════════════════════════════════════════
// ComposerRunForm — the self-describing launch form for a workflow run
//
// Instead of one hardcoded "Feature request / bug report" box, the form reads
// the SELECTED workflow's input contract (the start node's `config.inputSpec`)
// and renders that workflow's own objective label, hint, and click-to-fill
// examples — plus a short orientation preview (description + the stages it will
// run) so the user knows what they're launching. Mirrors Dify/n8n start-node
// inputs.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Play, AlertTriangle, Rocket } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Textarea, Select } from "@/components/ui/field";
import { useComposerWorkflowGraph } from "@/hooks/useComposer";
import { getInputSpec } from "@/lib/composer/schema";
import type { ComposerWorkflow } from "@/lib/composer/schema";

const DEFAULT_HINT =
  "Describe what you want this workflow to accomplish — be specific about the subject, scope, and what 'done' looks like.";

/** Stage kinds that can WRITE to / modify the repo — flagged in the review. */
const WRITE_KINDS = new Set(["implement", "build_tests", "pr"]);

export default function ComposerRunForm({
  workflows,
  activeWorkflowId,
  onWorkflowChange,
  profileOptions,
  profileName,
  onProfileChange,
  input,
  onInputChange,
  submitting,
  onRun,
}: {
  workflows: ComposerWorkflow[];
  activeWorkflowId: string;
  onWorkflowChange: (id: string) => void;
  profileOptions: { value: string; label: string }[];
  profileName: string;
  onProfileChange: (v: string) => void;
  input: string;
  onInputChange: (v: string) => void;
  submitting: boolean;
  onRun: () => void;
}) {
  const { data: graph } = useComposerWorkflowGraph(activeWorkflowId || null);
  const spec = graph ? getInputSpec(graph) : null;
  const objectiveLabel = spec?.objectiveLabel ?? "Objective";
  const objectiveHint = spec?.objectiveHint || DEFAULT_HINT;
  const examples = spec?.examples ?? [];

  const workflow = workflows.find((w) => w.id === activeWorkflowId) ?? null;
  const stages = graph ? [...graph.nodes].sort((a, b) => a.pos - b.pos) : [];
  const workflowOptions = workflows.map((w) => ({ value: w.id, label: w.name }));

  // Stages that can write to / modify the repo — surfaced in the review so a
  // launch that rewrites code is a deliberate, confirmed choice.
  const writeStages = stages.filter((n) => WRITE_KINDS.has(n.kind));
  const tooShort = input.trim().length < 3;

  const [confirming, setConfirming] = useState(false);
  function confirmAndRun() {
    setConfirming(false);
    onRun();
  }

  return (
    <>
    <Card padding="md" glow="cyan">
      {/* Orientation: what this workflow is + the stages it runs */}
      {workflow ? (
        <div className="mb-3 rounded-lg border border-white/10 bg-dark-900/40 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-ps-text-primary">{workflow.name}</span>
            {stages.length > 0 ? (
              <span className="text-xs font-mono text-ps-text-muted">{stages.length} stages</span>
            ) : null}
          </div>
          {workflow.description ? (
            <p className="mt-0.5 text-xs text-ps-text-muted">{workflow.description}</p>
          ) : null}
          {stages.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {stages.map((n, i) => (
                <span key={n.id} className="flex items-center gap-1">
                  {i > 0 ? <span className="text-ps-text-faint">→</span> : null}
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-mono ${n.gate === "hil" ? "bg-neon-yellow/10 text-neon-yellow/90" : "bg-white/5 text-ps-text-muted"}`}
                    title={n.gate === "hil" ? "human-in-the-loop gate" : n.kind}
                  >
                    {n.label}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label={objectiveLabel} htmlFor="composer-input">
        <Textarea
          id="composer-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          rows={3}
          placeholder={objectiveHint}
        />
      </Field>

      {examples.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs uppercase tracking-wider text-ps-text-muted">Examples — click to fill</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onInputChange(ex)}
              className="max-w-full truncate rounded-full border border-white/10 px-2 py-0.5 text-xs text-ps-text-muted transition hover:border-neon-cyan/40 hover:text-neon-cyan"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Workflow">
          <Select value={activeWorkflowId} onChange={onWorkflowChange} options={workflowOptions} placeholder="Workflow…" />
        </Field>
        <Field label="Agent profile">
          <Select value={profileName} onChange={onProfileChange} options={profileOptions} />
        </Field>
        <Button
          variant="primary"
          color="cyan"
          loading={submitting}
          onClick={() => setConfirming(true)}
          disabled={tooShort || !workflow}
        >
          {!submitting ? <Play className="h-4 w-4" /> : null} Review &amp; run
        </Button>
      </div>
      {tooShort ? (
        <p className="mt-1.5 text-right text-xs text-ps-text-muted">Describe your objective (≥ 3 characters) to enable the run.</p>
      ) : null}
    </Card>

    {/* Pre-launch review: confirm the workflow + its stages before anything runs,
        with a loud warning when stages can modify your repository. */}
    <Modal
      open={confirming}
      onClose={() => setConfirming(false)}
      title="Review before launch"
      icon={Rocket}
      iconColor="text-neon-cyan"
      size="lg"
      footer={
        <>
          <Button variant="ghost" color="cyan" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="primary"
            color={writeStages.length > 0 ? "orange" : "cyan"}
            loading={submitting}
            onClick={confirmAndRun}
          >
            <Play className="h-4 w-4" />
            {writeStages.length > 0 ? "Confirm — includes write stages" : "Confirm & launch"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">Workflow</p>
          <p className="text-sm text-ps-text-primary">{workflow?.name ?? "—"}</p>
          {workflow?.description ? <p className="mt-0.5 text-xs text-ps-text-muted">{workflow.description}</p> : null}
        </div>

        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">{objectiveLabel}</p>
          <p className="mt-0.5 whitespace-pre-wrap rounded-lg border border-white/10 bg-dark-900/50 px-3 py-2 text-xs text-ps-text-secondary">{input.trim()}</p>
        </div>

        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">{stages.length} stage{stages.length === 1 ? "" : "s"} · profile {profileName || "default"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {stages.map((n) => {
              const writes = WRITE_KINDS.has(n.kind);
              return (
                <span
                  key={n.id}
                  className={`rounded-full border px-2 py-0.5 text-xs ${writes ? "border-neon-orange/40 bg-neon-orange/10 text-neon-orange" : "border-white/10 text-ps-text-muted"}`}
                  title={writes ? "This stage can modify your repository" : n.kind}
                >
                  {n.label}
                </span>
              );
            })}
          </div>
        </div>

        {writeStages.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-neon-orange/40 bg-neon-orange/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
            <div className="text-xs text-neon-orange/90">
              <p className="font-semibold">This workflow can modify your repository.</p>
              <p className="mt-0.5 text-neon-orange/90">
                {writeStages.map((n) => n.label).join(", ")} may write code, tests, or open a pull request. Make sure your objective and scope are what you intend before confirming.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
    </>
  );
}
