// ═══════════════════════════════════════════════════════════════
// MissionCreateForm — Inline create/edit mission form
// Extracted from missions/page.tsx for modularity.
// ═══════════════════════════════════════════════════════════════

"use client";

import { X, Send, Save } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AutoTextarea from "@/components/ui/AutoTextarea";
import SkillSelector from "@/components/ui/SkillSelector";
import IntervalSelector from "@/components/ui/IntervalSelector";
import LocalDirRow from "@/components/missions/LocalDirRow";
import AgentRuntimeDefaultsCard from "@/components/missions/AgentRuntimeDefaultsCard";
import type { LocalDirEntry } from "@/types/hermes";

export interface MissionFormState {
  newName: string;
  newInstruction: string;
  newContext: string;
  newGoals: string;
  newDispatch: "save" | "now" | "cron";
  newSchedule: string;
  scheduleType: "interval" | "cron-expr";
  newMissionTime: number;
  newTimeout: number;
  newProfile: string;
  newModel: string;
  newProvider: string;
  newLocalDirs: LocalDirEntry[];
  localDirDraft: LocalDirEntry;
  newReferences: string[];
  referenceInput: string;
  newSkills: string[];
}

export interface MissionCreateFormProps {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  missions: { id: string; name: string; status: string }[];
  formState: MissionFormState;
  setFormField: <K extends keyof MissionFormState>(
    field: K,
    value: MissionFormState[K],
  ) => void;
  onSubmit: () => void;
  onSaveAsTemplate: () => void;
  dispatching: boolean;
}

export default function MissionCreateForm({
  open,
  onClose,
  editingId,
  missions,
  formState,
  setFormField,
  onSubmit,
  onSaveAsTemplate,
  dispatching,
}: MissionCreateFormProps) {
  if (!open) return null;

  const existing = editingId
    ? missions.find((m) => m.id === editingId)
    : null;

  const isReDispatch =
    existing &&
    (existing.status === "successful" || existing.status === "failed");

  return (
    <Card className="mb-6 glow-cyan" padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono text-neon-cyan uppercase tracking-widest">
          {(() => {
            if (isReDispatch) {
              return `Re-Dispatch: ${existing!.name}`;
            }
            if (editingId) return "Edit Mission";
            return "New Mission";
          })()}
        </h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {editingId &&
          (() => {
            if (isReDispatch) {
              return (
                <div className="rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 p-3 text-xs text-neon-cyan/80 font-mono">
                  A new mission will be created and dispatched immediately
                  with your changes. The previous mission record will be
                  kept for history.
                </div>
              );
            }
            return null;
          })()}
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Mission Name
          </label>
          <input
            value={formState.newName}
            onChange={(e) => setFormField("newName", e.target.value)}
            placeholder="e.g., Research quantum computing trends"
            className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Instruction Prompt
          </label>
          <AutoTextarea
            value={formState.newInstruction}
            onChange={(v) => setFormField("newInstruction", v)}
            minRows={4}
            maxRows={16}
            placeholder="The agent's task instructions - what to do and how to do it..."
          />
          <p className="text-[10px] text-white/20 font-mono mt-0.5">
            Defines the agent&apos;s role, approach, and step-by-step
            process. Templates pre-fill this.
          </p>
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Context Prompt{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <AutoTextarea
            value={formState.newContext}
            onChange={(v) => setFormField("newContext", v)}
            minRows={2}
            maxRows={8}
            placeholder="Additional context, specifics, or direction for this particular run..."
          />
          <p className="text-[10px] text-white/20 font-mono mt-0.5">
            Added below the instructions as &quot;Additional
            Context&quot;. Use for topic, URL, code path, or specific
            requirements.
          </p>
        </div>

        {/* Local Directories */}
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Local Directories{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <div className="space-y-2">
            <LocalDirRow
              mode="draft"
              entry={formState.localDirDraft}
              onChange={(next) => setFormField("localDirDraft", next)}
              onAdd={() => {
                const p = formState.localDirDraft.path.trim();
                if (!p) return;
                if (formState.newLocalDirs.some((d) => d.path === p)) return;
                setFormField("newLocalDirs", [
                  ...formState.newLocalDirs,
                  {
                    path: p,
                    branch: formState.localDirDraft.branch || null,
                  },
                ]);
                setFormField("localDirDraft", {
                  path: "",
                  branch: null,
                } as LocalDirEntry);
              }}
            />
            {formState.newLocalDirs.length > 0 && (
              <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                Added directories
              </div>
            )}
            {formState.newLocalDirs.map((dir, i) => (
              <div
                key={`${dir.path}-${i}`}
                className="rounded-lg border border-neon-cyan/15 bg-dark-800/30 px-2 py-2"
              >
                <LocalDirRow
                  mode="saved"
                  entry={dir}
                  onChange={(next) =>
                    setFormField(
                      "newLocalDirs",
                      formState.newLocalDirs.map((x, j) =>
                        j === i ? next : x,
                      ),
                    )
                  }
                  onDelete={() =>
                    setFormField(
                      "newLocalDirs",
                      formState.newLocalDirs.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/20 font-mono mt-0.5">
            Directories the agent should focus work within. Injected as
            highest-priority section in the mission prompt. Use Browse to
            pick a path under allowed workspace roots.
          </p>
        </div>

        {/* Key References */}
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Key References{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <div className="space-y-1.5">
            {formState.newReferences.map((ref, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-dark-800/50 border border-neon-pink/20 rounded-lg px-3 py-1.5"
              >
                <span className="text-xs font-mono text-neon-pink truncate flex-1">
                  {ref}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFormField(
                      "newReferences",
                      formState.newReferences.filter((_, j) => j !== i),
                    )
                  }
                  className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={formState.referenceInput}
                onChange={(e) =>
                  setFormField("referenceInput", e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (formState.referenceInput.trim()) {
                      setFormField("newReferences", [
                        ...formState.newReferences,
                        formState.referenceInput.trim(),
                      ]);
                      setFormField("referenceInput", "");
                    }
                  }
                }}
                placeholder="www.example.com, docs/spec.md, README.md..."
                className="flex-1 bg-dark-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-pink/50 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (formState.referenceInput.trim()) {
                    setFormField("newReferences", [
                      ...formState.newReferences,
                      formState.referenceInput.trim(),
                    ]);
                    setFormField("referenceInput", "");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink hover:bg-neon-pink/20 font-mono transition-colors"
              >
                + Add
              </button>
            </div>
          </div>
          <p className="text-[10px] text-white/20 font-mono mt-0.5">
            File names, URLs, or resources the agent should prioritise.
            Added as &quot;Key References&quot; in the prompt.
          </p>
        </div>

        {/* Skills */}
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Attached Skills{" "}
            <span className="text-white/20">(optional, max 10)</span>
          </label>
          <SkillSelector
            value={formState.newSkills}
            onChange={(skills) => setFormField("newSkills", skills)}
            profileId={formState.newProfile}
            max={10}
          />
          <p className="text-[10px] text-white/20 font-mono mt-0.5">
            Showing only skills enabled for this profile. Added as
            &quot;Recommended Skills&quot; in the prompt.
          </p>
        </div>

        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Goals (one per line)
          </label>
          <AutoTextarea
            value={formState.newGoals}
            onChange={(v) => setFormField("newGoals", v)}
            minRows={2}
            maxRows={8}
            placeholder="Gather data&#10;Analyze findings&#10;Write report"
          />
        </div>
        {/* Mission Settings — agent & runtime card */}
        <AgentRuntimeDefaultsCard
          profileId={formState.newProfile}
          onProfileChange={(id) => setFormField("newProfile", id)}
          missionTimeMinutes={formState.newMissionTime}
          onMissionTimeChange={(v) => setFormField("newMissionTime", v)}
          timeoutMinutes={formState.newTimeout}
          onTimeoutChange={(v) => setFormField("newTimeout", v)}
          modelId={formState.newModel}
          provider={formState.newProvider}
          onModelChange={(mid, prov) => {
            setFormField("newModel", mid);
            setFormField("newProvider", prov);
          }}
          timeoutHeading="Timeout (Advanced)"
        />
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/40 font-mono">
            Dispatch:
          </label>
          {(["save", "now", "cron"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFormField("newDispatch", mode)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
                formState.newDispatch === mode
                  ? "border-neon-cyan/50 bg-cyan-500/10 text-neon-cyan"
                  : "border-white/10 text-white/40 hover:text-white/60"
              }`}
            >
              {mode === "save"
                ? "Save Draft"
                : mode === "now"
                  ? "Run Now"
                  : "Recurring"}
            </button>
          ))}
        </div>
        {formState.newDispatch === "now" && (
          <div className="text-[10px] text-white/30 font-mono bg-dark-800/50 rounded-lg px-3 py-2 border border-white/5">
            ⚡ Launches hermes chat immediately. One-shot execution.
            Results delivered to Discord.
          </div>
        )}
        {formState.newDispatch === "save" && (
          <div className="text-[10px] text-white/30 font-mono bg-dark-800/50 rounded-lg px-3 py-2 border border-white/5">
            💾 Saves the mission as a draft. Nothing is executed yet.
          </div>
        )}
        {formState.newDispatch === "cron" && (
          <div className="space-y-2">
            <label className="text-xs text-white/40 font-mono block">
              Schedule
            </label>
            <IntervalSelector
              value={formState.newSchedule}
              onChange={(s) => setFormField("newSchedule", s)}
            />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={onSubmit}
            disabled={
              !formState.newName.trim() ||
              !formState.newInstruction.trim() ||
              dispatching
            }
            loading={dispatching}
          >
            <Send className="w-3.5 h-3.5" />
            {(() => {
              if (isReDispatch) return "Re-Dispatch Now";
              if (formState.newDispatch === "save") return "Save Mission";
              if (formState.newDispatch === "now") return "Dispatch Now";
              return "Schedule Mission";
            })()}
          </Button>
          {formState.newInstruction.trim() && (
            <Button variant="secondary" onClick={onSaveAsTemplate}>
              <Save className="w-3.5 h-3.5" /> Save as Template
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
