// ═══════════════════════════════════════════════════════════════
// FirstRunPanel — the dashboard's answer to "what do I do first?"
// ═══════════════════════════════════════════════════════════════
//
// Shown at the top of the dashboard while an install is still empty, or for as
// long as there is no agent installed to dispatch to. Before this, a fresh
// install landed on zeroed widgets and a green ONLINE badge with no next step
// anywhere on the screen.
//
// The step derivation is in src/lib/dashboard/first-run-steps.ts; this file is
// only the rendering.

"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Circle, Rocket } from "lucide-react";

import {
  firstRunSteps,
  shouldShowFirstRun,
  type FirstRunFacts,
  type FirstRunStep,
} from "@/lib/dashboard/first-run-steps";

function StepRow({ step }: { step: FirstRunStep }) {
  const body = (
    <>
      <span className="mt-0.5 shrink-0">
        {step.done ? (
          <Check className="h-4 w-4 text-neon-green" />
        ) : (
          <Circle className="h-4 w-4 text-ps-text-muted" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            step.done ? "text-ps-text-muted" : "text-ps-text-primary"
          }`}
        >
          {step.title}
        </span>
        <span className="mt-0.5 block text-xs text-ps-text-secondary">{step.detail}</span>
      </span>
      {step.external ? (
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-ps-text-muted" />
      ) : (
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ps-text-muted" />
      )}
    </>
  );

  const rowClasses =
    "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]";

  return step.external ? (
    <a href={step.href} target="_blank" rel="noreferrer noopener" className={rowClasses}>
      {body}
    </a>
  ) : (
    <Link href={step.href} className={rowClasses}>
      {body}
    </Link>
  );
}

export default function FirstRunPanel({ facts }: { facts: FirstRunFacts }) {
  if (!shouldShowFirstRun(facts)) return null;

  const steps = firstRunSteps(facts);
  const agent = facts.frameworkName || "your agent";
  const headline = facts.frameworkAvailable
    ? "Your install is ready and has not run anything yet."
    : facts.gatewayReachable
      ? `${agent} isn't installed on this machine, but a gateway at ${facts.gatewayUrl ?? "the configured address"} is configured and reachable; missions will run there.`
      : `PatterStage is running, but ${agent} is not installed on this machine yet.`;

  return (
    <section className="rounded-xl border border-neon-cyan/25 bg-dark-900/50 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 bg-dark-800/50 px-4 py-2">
        <Rocket className="h-3.5 w-3.5 text-neon-cyan" />
        <span className="text-xs font-mono uppercase tracking-wider text-ps-text-secondary">
          Start here
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="px-3 pb-2 text-sm text-ps-text-secondary">{headline}</p>
        <div className="space-y-1">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}
