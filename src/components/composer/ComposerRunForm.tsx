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

import { Play } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Textarea, Select } from "@/components/ui/field";
import { useComposerWorkflowGraph } from "@/hooks/useComposer";
import { getInputSpec } from "@/lib/composer/schema";
import type { ComposerWorkflow } from "@/lib/composer/schema";

const DEFAULT_HINT =
  "Describe what you want this workflow to accomplish — be specific about the subject, scope, and what 'done' looks like.";

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

  return (
    <Card padding="md" glow="cyan">
      {/* Orientation: what this workflow is + the stages it runs */}
      {workflow ? (
        <div className="mb-3 rounded-lg border border-white/10 bg-dark-900/40 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-white/85">{workflow.name}</span>
            {stages.length > 0 ? (
              <span className="text-[10px] font-mono text-white/30">{stages.length} stages</span>
            ) : null}
          </div>
          {workflow.description ? (
            <p className="mt-0.5 text-xs text-white/45">{workflow.description}</p>
          ) : null}
          {stages.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {stages.map((n, i) => (
                <span key={n.id} className="flex items-center gap-1">
                  {i > 0 ? <span className="text-white/20">→</span> : null}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${n.gate === "hil" ? "bg-neon-yellow/10 text-neon-yellow/90" : "bg-white/5 text-white/50"}`}
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
          <span className="text-[10px] uppercase tracking-wider text-white/30">Examples</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onInputChange(ex)}
              className="max-w-full truncate rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55 transition hover:border-neon-cyan/40 hover:text-neon-cyan"
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
        <Button variant="primary" color="cyan" loading={submitting} onClick={onRun} disabled={input.trim().length < 3}>
          {!submitting ? <Play className="h-4 w-4" /> : null} Run workflow
        </Button>
      </div>
    </Card>
  );
}
