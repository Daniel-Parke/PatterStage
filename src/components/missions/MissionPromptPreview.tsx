"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";
import {
  buildMissionPrompt,
  buildMissionPromptHuman,
} from "@/lib/missions/build-mission-prompt";
import type { LocalDirEntry } from "@/types/console";

export type PromptPreviewMode = "human" | "ai";

export interface MissionPromptPreviewProps {
  instruction: string;
  context: string;
  goals: string;
  outputFormat: string;
  constraints: string;
  localDirs: LocalDirEntry[];
  references: string[];
  skills: string[];
  toolsets: string[];
  missionTimeMinutes: number;
  timeoutMinutes: number;
}

function buildOptions(props: MissionPromptPreviewProps) {
  return {
    instruction: props.instruction.trim(),
    context: props.context.trim() || undefined,
    outputFormat: props.outputFormat.trim() || undefined,
    constraints: props.constraints.trim() || undefined,
    goals: props.goals
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean),
    localDirs: props.localDirs,
    references: props.references,
    skills: props.skills,
    toolsets: props.toolsets,
    missionTimeMinutes: props.missionTimeMinutes,
    timeoutMinutes: props.timeoutMinutes,
  };
}

const MODES: ReadonlyArray<{ value: PromptPreviewMode; label: string }> = [
  { value: "human", label: "Human" },
  { value: "ai", label: "AI" },
];

export default function MissionPromptPreview(props: MissionPromptPreviewProps) {
  const [mode, setMode] = useState<PromptPreviewMode>("human");
  const [copied, setCopied] = useState(false);

  const humanPreview = useMemo(
    () => buildMissionPromptHuman(buildOptions(props)),
    [props],
  );

  const aiPreview = useMemo(
    () => buildMissionPrompt(buildOptions(props)),
    [props],
  );

  const activePreview = mode === "human" ? humanPreview : aiPreview;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePreview);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<PromptPreviewMode>
          label="Preview mode"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 text-micro font-mono text-neon-cyan hover:text-neon-cyan/80"
        >
          <Copy className="w-3 h-3" />
          {copied
            ? "Copied"
            : mode === "human"
              ? "Copy human preview"
              : "Copy agent prompt"}
        </button>
      </div>
      <p className="text-micro font-mono text-ps-text-faint leading-relaxed">
        Profile personality (SOUL/AGENTS) comes from Hermes at ~/.hermes.{" "}
        {mode === "human"
          ? "Human view mirrors your form fields."
          : "AI view is the XML prompt stored and sent to the agent."}
      </p>
      <Card variant="raised" padding="none" className="max-h-72 overflow-y-auto">
        <pre className="px-3 py-3 text-micro font-mono text-ps-text-secondary whitespace-pre-wrap">
          {activePreview || "(empty)"}
        </pre>
      </Card>
    </div>
  );
}
