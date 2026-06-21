// ═══════════════════════════════════════════════════════════════
// WorkflowBuilder — author Composer workflows (the node editor)
//
// A structured vertical builder: add / reorder / delete stage nodes (kind,
// label, HIL gate, start/terminal) and wire their routing via from→to edges
// with a condition (always / on_pass / on_fail / on_<outcome> for branch
// pathways). The whole graph is held in state and saved atomically (POST new /
// PUT existing). A live preview reuses WorkflowPipeline so you see the graph —
// loops, branches, HIL breaks — as you build.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import WorkflowPipeline from "@/components/composer/WorkflowPipeline";
import { safeApiCall } from "@/lib/api-fetch";
import { useComposerWorkflowGraph } from "@/hooks/useComposer";
import type { ComposerWorkflow, ComposerWorkflowGraph, NodeGate } from "@/lib/composer/schema";

interface DraftNode {
  key: string;
  label: string;
  kind: string;
  gate: NodeGate;
  isStart: boolean;
  isTerminal: boolean;
}
interface DraftEdge {
  from: string;
  to: string;
  condition: string;
  label: string;
}

const KIND_OPTIONS = [
  "review", "validate", "research", "plan", "hypothesise", "implement", "build_tests",
  "test", "unit_test", "integration_test", "acceptance_test", "documentation", "pr",
  "final_assessment", "custom",
].map((k) => ({ value: k, label: k }));

const NEW = "__new__";

function freshKey(): string {
  return `n_${Math.random().toString(36).slice(2, 8)}`;
}

function startDraft(): { name: string; nodes: DraftNode[]; edges: DraftEdge[] } {
  return {
    name: "New workflow",
    nodes: [
      { key: freshKey(), label: "Start", kind: "review", gate: "auto", isStart: true, isTerminal: false },
      { key: freshKey(), label: "Done", kind: "custom", gate: "auto", isStart: false, isTerminal: true },
    ],
    edges: [],
  };
}

export default function WorkflowBuilder({
  workflows,
  onSaved,
}: {
  workflows: ComposerWorkflow[];
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(NEW);
  const [name, setName] = useState("New workflow");
  const [nodes, setNodes] = useState<DraftNode[]>(() => startDraft().nodes);
  const [edges, setEdges] = useState<DraftEdge[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const { data: graph } = useComposerWorkflowGraph(selectedId === NEW ? null : selectedId);

  // Load the selected workflow's graph into the editable draft (once per load).
  useEffect(() => {
    if (selectedId === NEW) {
      const d = startDraft();
      setName(d.name);
      setNodes(d.nodes);
      setEdges([]);
      return;
    }
    if (!graph || graph.id !== selectedId) return;
    const sorted = [...graph.nodes].sort((a, b) => a.pos - b.pos);
    setName(graph.name);
    setNodes(sorted.map((n) => ({ key: n.key, label: n.label, kind: n.kind, gate: n.gate, isStart: n.isStart, isTerminal: n.isTerminal })));
    setEdges(
      graph.edges.map((e) => ({
        from: sorted.find((n) => n.id === e.fromNodeId)?.key ?? "",
        to: sorted.find((n) => n.id === e.toNodeId)?.key ?? "",
        condition: e.condition,
        label: e.label ?? "",
      })),
    );
  }, [selectedId, graph]);

  const nodeOptions = nodes.map((n) => ({ value: n.key, label: n.label || n.key }));

  function patchNode(i: number, patch: Partial<DraftNode>) {
    setNodes((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }
  function moveNode(i: number, dir: -1 | 1) {
    setNodes((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addNode() {
    setNodes((prev) => [...prev, { key: freshKey(), label: "New stage", kind: "custom", gate: "auto", isStart: false, isTerminal: false }]);
  }
  function removeNode(i: number) {
    setNodes((prev) => {
      const key = prev[i]?.key;
      setEdges((es) => es.filter((e) => e.from !== key && e.to !== key));
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function patchEdge(i: number, patch: Partial<DraftEdge>) {
    setEdges((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEdge() {
    setEdges((prev) => [...prev, { from: nodes[0]?.key ?? "", to: nodes[1]?.key ?? nodes[0]?.key ?? "", condition: "always", label: "" }]);
  }
  function removeEdge(i: number) {
    setEdges((prev) => prev.filter((_, idx) => idx !== i));
  }

  const previewGraph: ComposerWorkflowGraph = {
    id: "preview", key: null, name, description: "", version: 0, createdAt: "", updatedAt: "",
    nodes: nodes.map((n, i) => ({ id: n.key, workflowId: "preview", key: n.key, label: n.label, kind: n.kind, gate: n.gate, isStart: n.isStart, isTerminal: n.isTerminal, config: null, pos: i })),
    edges: edges
      .filter((e) => e.from && e.to)
      .map((e, i) => ({ id: `e${i}`, workflowId: "preview", fromNodeId: e.from, toNodeId: e.to, condition: e.condition || "always", label: e.label || null })),
  };

  const valid = name.trim().length > 0 && nodes.length > 0 && nodes.every((n) => n.label.trim());

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setMessage("");
    const body = {
      name: name.trim(),
      nodes: nodes.map((n) => ({ key: n.key, label: n.label.trim(), kind: n.kind, gate: n.gate, isStart: n.isStart, isTerminal: n.isTerminal })),
      edges: edges.filter((e) => e.from && e.to).map((e) => ({ from: e.from, to: e.to, condition: e.condition.trim() || "always", label: e.label.trim() || undefined })),
    };
    try {
      const isNew = selectedId === NEW;
      const res = await safeApiCall<{ data?: { workflow?: { id: string } } }>(
        isNew ? "/api/composer/workflows" : `/api/composer/workflows/${selectedId}`,
        { method: isNew ? "POST" : "PUT", body },
      );
      if (res.ok) {
        const newId = res.data?.data?.workflow?.id;
        setMessage("Saved.");
        onSaved();
        if (isNew && newId) setSelectedId(newId);
      } else {
        setMessage(res.error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (selectedId === NEW || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await safeApiCall(`/api/composer/workflows/${selectedId}`, { method: "DELETE" });
      if (res.ok) {
        onSaved();
        setSelectedId(NEW);
        setMessage("Deleted.");
      } else {
        setMessage(res.error ?? "Delete failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Editor */}
      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
          <Field label="Edit workflow">
            <Select
              value={selectedId}
              onChange={setSelectedId}
              options={[{ value: NEW, label: "+ New workflow" }, ...workflows.map((w) => ({ value: w.id, label: w.name }))]}
            />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name" />
          </Field>
        </div>

        {/* Nodes */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-white/40">Stages</h3>
            <Button variant="secondary" color="cyan" size="sm" className="ml-auto" onClick={addNode}>
              <Plus className="h-3.5 w-3.5" /> Add stage
            </Button>
          </div>
          <ul className="space-y-2">
            {nodes.map((n, i) => (
              <li key={n.key} className="rounded-lg border border-white/10 bg-dark-900/40 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveNode(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white/70 disabled:opacity-20" aria-label="Move up"><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveNode(i, 1)} disabled={i === nodes.length - 1} className="text-white/30 hover:text-white/70 disabled:opacity-20" aria-label="Move down"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <Input value={n.label} onChange={(e) => patchNode(i, { label: e.target.value })} placeholder="Stage label" />
                  </div>
                  <div className="w-40">
                    <Select value={n.kind} onChange={(v) => patchNode(i, { kind: v })} options={KIND_OPTIONS} />
                  </div>
                  <Toggle label="HIL" checked={n.gate === "hil"} onChange={(c) => patchNode(i, { gate: c ? "hil" : "auto" })} />
                  <Toggle label="Start" checked={n.isStart} onChange={(c) => patchNode(i, { isStart: c })} />
                  <Toggle label="End" checked={n.isTerminal} onChange={(c) => patchNode(i, { isTerminal: c })} />
                  <button type="button" onClick={() => removeNode(i)} className="text-white/30 hover:text-neon-pink" aria-label="Delete stage"><Trash2 className="h-4 w-4" /></button>
                </div>
                {n.kind === "research" ? (
                  <p className="mt-1 pl-9 text-[10px] text-neon-cyan/60">Runs Deep Research (web search → cited report) instead of an agent.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Edges */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-white/40">Routing</h3>
            <Button variant="secondary" color="purple" size="sm" className="ml-auto" onClick={addEdge} disabled={nodes.length < 1}>
              <Plus className="h-3.5 w-3.5" /> Add route
            </Button>
          </div>
          {edges.length === 0 ? (
            <p className="text-[11px] text-white/30">No routes yet — add edges to connect stages (always, on_pass, on_fail, or a branch on_&lt;outcome&gt;).</p>
          ) : (
            <ul className="space-y-2">
              {edges.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-dark-900/40 p-2">
                  <div className="w-32"><Select value={e.from} onChange={(v) => patchEdge(i, { from: v })} options={nodeOptions} placeholder="from" /></div>
                  <span className="text-white/30">→</span>
                  <div className="w-32"><Select value={e.to} onChange={(v) => patchEdge(i, { to: v })} options={nodeOptions} placeholder="to" /></div>
                  <div className="w-36"><Input value={e.condition} onChange={(ev) => patchEdge(i, { condition: ev.target.value })} placeholder="always / on_pass…" /></div>
                  <div className="min-w-[100px] flex-1"><Input value={e.label} onChange={(ev) => patchEdge(i, { label: ev.target.value })} placeholder="label (optional)" /></div>
                  <button type="button" onClick={() => removeEdge(i)} className="text-white/30 hover:text-neon-pink" aria-label="Delete route"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button variant="primary" color="cyan" loading={saving} onClick={() => void save()} disabled={!valid}>
            <Save className="h-4 w-4" /> {selectedId === NEW ? "Create workflow" : "Save changes"}
          </Button>
          {selectedId !== NEW ? (
            <Button variant="secondary" color="pink" onClick={() => void remove()} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : null}
          {message ? <span className="text-xs text-white/50">{message}</span> : null}
        </div>
      </Card>

      {/* Live preview */}
      <Card padding="md">
        <h3 className="mb-3 text-xs font-mono uppercase tracking-widest text-white/40">Preview</h3>
        {nodes.length ? (
          <WorkflowPipeline graph={previewGraph} latestNodeRun={() => null} currentNodeId={null} />
        ) : (
          <p className="text-xs text-white/30">Add a stage to preview the graph.</p>
        )}
      </Card>
    </div>
  );
}
