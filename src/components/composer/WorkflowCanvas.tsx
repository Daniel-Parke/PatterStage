// ═══════════════════════════════════════════════════════════════
// WorkflowCanvas — drag-and-drop node editor for Composer workflows
//
// A react-flow canvas: drag stage types from the palette onto the board, drag
// handle→handle to connect them, click a node/edge to edit just its details in
// the inspector (progressive disclosure — no wall of inline forms). The whole
// graph saves atomically (POST new / PUT existing) via the same API the form
// builder used; positions persist in each node's config._ui. Loaded only on the
// client (react-flow needs the DOM) — see the dynamic import on the page.
//
// `mode="build"` is the editor; `mode="live"` (Phase B3c) overlays run status.
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/ui/theme";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Copy, Save, Trash2, Wand2 } from "lucide-react";

import { Panel } from "@/components/dashboard/Panel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import type { ToastType } from "@/components/ui/Toast";
import { runWrite } from "@/lib/api/api-write";
import { useComposerWorkflowGraph } from "@/hooks/useComposer";
import {
  autoLayout,
  canvasToWorkflowDef,
  graphToCanvas,
  validateCanvas,
  type CanvasState,
} from "@/lib/composer/canvas-graph";
import type { ComposerWorkflow, NodeGate } from "@/lib/composer/schema";

const KIND_OPTIONS = [
  "review", "validate", "research", "plan", "hypothesise", "implement", "build_tests",
  "test", "unit_test", "integration_test", "acceptance_test", "documentation", "pr",
  "final_assessment", "group", "custom",
].map((k) => ({ value: k, label: k }));

const PALETTE = [
  { kind: "custom", label: "Task", color: "border-ps-edge-emphasis text-ps-text-secondary" },
  { kind: "research", label: "Research", color: "border-neon-cyan/40 text-neon-cyan" },
  { kind: "validate", label: "Validate", color: "border-neon-yellow/40 text-neon-yellow" },
  { kind: "test", label: "Test", color: "border-neon-green/40 text-neon-green" },
  { kind: "group", label: "Group", color: "border-neon-purple/40 text-neon-purple" },
];

const NODE_KIND_DRAG = "application/ps-node-kind";
const NEW = "__new__";

interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
  gate: NodeGate;
  isStart: boolean;
  isTerminal: boolean;
  config: Record<string, unknown> | null;
}
type WfNode = Node<WorkflowNodeData, "workflow">;
type WfEdge = Edge<{ condition: string; label: string | null }>;

function freshKey(): string {
  return `n_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Custom node renderer ─────────────────────────────────────────
function WorkflowNode({ data, selected }: NodeProps<WfNode>) {
  const isGroup = data.kind === "group";
  const outline = selected ? "border-neon-cyan ring-1 ring-neon-cyan/50" : isGroup ? "border-neon-purple/50" : "border-ps-edge-emphasis";
  return (
    // design-lint-disable-next-line no-inline-card-chrome -- a react-flow node, not a card: its border IS its state (selected, a sub-workflow, or the edge-emphasis rung the ladder above chose for contrast against the canvas ground), and Card paints the hairline rung it cannot override; Panel clips its overflow, which would take the connection handles with it.
    <div className={`min-w-[150px] rounded-ps-md border bg-ps-surface-panel px-3 py-2 text-left shadow-lg backdrop-blur ${outline}`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-ps-edge-emphasis" />
      <div className="flex items-center gap-1.5">
        <span className="truncate text-body text-ps-text-primary">{data.label || "(unnamed)"}</span>
        {data.gate === "hil" ? <span className="rounded-ps-sm bg-neon-yellow/15 px-1 text-micro font-mono text-neon-yellow">HIL</span> : null}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ps-text-muted">
        <span>{data.kind}</span>
        {data.isStart ? <span className="text-neon-cyan">start</span> : null}
        {data.isTerminal ? <span className="text-ps-text-muted">end</span> : null}
        {isGroup ? <span className="text-neon-purple">▣ sub-workflow</span> : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-neon-cyan/70" />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode };

/** A message the operator reads, and whether it is good news. */
type Msg = { text: string; tone: "ok" | "error" };

/** One comparable string for a board, so "unsaved" is a fact rather than a flag. */
function snapshotOf(name: string, description: string, canvas: CanvasState): string {
  return JSON.stringify({ name, description, canvas });
}

const CONDITION_HINT = "always · on_pass · on_fail · on_approve · on_reject · on_<outcome>";

/**
 * What a 409 carries: the count of completed runs the write would delete, and
 * for a delete the workflow's name. Null when the throw is anything else.
 * `apiFetch` throws its ApiError with `status` and the parsed `body`, which is
 * how a 409 a user can resolve is told apart from a 500 (T-0096, D51).
 */
function discardConflict(err: unknown): { runCount: number; workflowName?: string } | null {
  const e = err as { status?: number; body?: { runCount?: number; workflowName?: string } } | null;
  if (!e || e.status !== 409) return null;
  return { runCount: e.body?.runCount ?? 0, workflowName: e.body?.workflowName };
}

/**
 * The inline question under the toolbar: a sentence, and its answers beside
 * it. Three of these ask three different things (switch away from an unsaved
 * board, T-0106 D7; save over run history, T-0096 D51; delete run history with
 * the workflow, T-0106 D1) and they are one shape, announced as an alert.
 */
function Question({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <Panel
      role="alert"
      accent="orange"
      tint="orange"
      className="flex flex-wrap items-center gap-3 px-4 py-3 text-body text-ps-text-primary"
    >
      <span>{children}</span>
      <div className="ml-auto flex gap-2">{actions}</div>
    </Panel>
  );
}

// ── Inner canvas (inside ReactFlowProvider) ──────────────────────
function CanvasInner({ workflows, onSaved }: { workflows: ComposerWorkflow[]; onSaved: () => void }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(NEW);
  const [name, setName] = useState("New workflow");
  const [nodes, setNodes, onNodesChange] = useNodesState<WfNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WfEdge>([]);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A message with a tone. Seven call sites shared one grey sentence, so a
  // save that failed and a save that worked looked the same (T-0106, D6).
  const [message, setMessage] = useState<Msg | null>(null);
  // runWrite's words, said where this board says things: beside the toolbar,
  // with a tone, rather than in a toast. The type is the tone.
  const say = useCallback((text: string, type: ToastType = "success") => {
    setMessage({ text, tone: type === "error" ? "error" : "ok" });
  }, []);
  const [description, setDescription] = useState("");
  const loadedRef = useRef<string>("");
  /** The board as it was at the last load or successful write. */
  const baselineRef = useRef<string>("");
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  const { data: graph } = useComposerWorkflowGraph(selectedWorkflowId === NEW ? null : selectedWorkflowId);
  const { screenToFlowPosition } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  const applyCanvas = useCallback(
    (state: CanvasState) => {
      setNodes(state.nodes.map((n) => ({ id: n.id, type: "workflow" as const, position: n.position, data: n.data })));
      setEdges(state.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.data.condition, data: e.data })));
    },
    [setNodes, setEdges],
  );

  // Load the selected workflow (or seed a blank one) once per selection.
  useEffect(() => {
    if (selectedWorkflowId === NEW) {
      if (loadedRef.current === NEW) return;
      loadedRef.current = NEW;
      setName("New workflow");
      setDescription("");
      const startKey = freshKey();
      const seeded: CanvasState = {
        nodes: [{ id: startKey, position: { x: 80, y: 40 }, data: { label: "Start", kind: "review", gate: "auto", isStart: true, isTerminal: false, config: null } }],
        edges: [],
      };
      applyCanvas(seeded);
      // From the state being applied, not from React state: reading `nodes`
      // here would read the PREVIOUS board, and every fresh canvas would be
      // born dirty.
      baselineRef.current = snapshotOf("New workflow", "", seeded);
      setSelNode(null);
      setSelEdge(null);
      return;
    }
    if (!graph || graph.id !== selectedWorkflowId || loadedRef.current === selectedWorkflowId) return;
    loadedRef.current = selectedWorkflowId;
    setName(graph.name);
    setDescription(graph.description ?? "");
    const loaded = graphToCanvas(graph);
    applyCanvas(loaded);
    setSelNode(null);
    setSelEdge(null);
    baselineRef.current = snapshotOf(graph.name, graph.description ?? "", loaded);
  }, [selectedWorkflowId, graph, applyCanvas]);



  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, label: "always", data: { condition: "always", label: null } }, eds)),
    [setEdges],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(NODE_KIND_DRAG);
      if (!kind) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = freshKey();
      setNodes((nds) =>
        nds.concat({
          id,
          type: "workflow",
          position,
          data: { label: kind === "custom" ? "New stage" : kind[0].toUpperCase() + kind.slice(1), kind, gate: "auto", isStart: false, isTerminal: kind === "custom" ? false : false, config: null },
        }),
      );
      setSelNode(id);
      setSelEdge(null);
    },
    [screenToFlowPosition, setNodes],
  );

  function patchNode(id: string, patch: Partial<WorkflowNodeData>) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return patch.isStart ? { ...n, data: { ...n.data, isStart: false } } : n; // single start
        return { ...n, data: { ...n.data, ...patch } };
      }),
    );
  }
  function patchNodeConfig(id: string, key: string, value: unknown) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const cfg = { ...(n.data.config ?? {}) };
        if (value === "" || value == null) delete cfg[key];
        else cfg[key] = value;
        return { ...n, data: { ...n.data, config: Object.keys(cfg).length ? cfg : null } };
      }),
    );
  }
  function patchEdge(id: string, patch: { condition?: string; label?: string | null }) {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== id) return e;
        const data = { condition: patch.condition ?? e.data?.condition ?? "always", label: patch.label ?? e.data?.label ?? null };
        return { ...e, data, label: data.condition };
      }),
    );
  }
  function deleteSelected() {
    if (selNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selNode));
      setEdges((eds) => eds.filter((e) => e.source !== selNode && e.target !== selNode));
      setSelNode(null);
    } else if (selEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selEdge));
      setSelEdge(null);
    }
  }

  function relayout() {
    const pos = autoLayout(nodes.map((n) => ({ id: n.id })), edges.map((e) => ({ source: e.source, target: e.target })));
    setNodes((nds) => nds.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })));
  }

  function currentCanvas(): CanvasState {
    return {
      nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data ?? { condition: "always", label: null } })),
    };
  }

  // The count of completed runs a save would delete, once the server has said
  // so with a 409; null while no such question is open. The question is asked
  // inline, under the toolbar, and answered by a second click (T-0096, D51).
  const [pendingDiscard, setPendingDiscard] = useState<
    | { kind: "save"; runCount: number }
    | { kind: "delete"; runCount: number; workflowName: string }
    | null
  >(null);

  /** The snapshot the dirty check compares against. */
  function snapshot(): string {
    return snapshotOf(name, description, currentCanvas());
  }
  function isDirty(): boolean {
    return baselineRef.current !== "" && baselineRef.current !== snapshot();
  }

  async function save(discardRunHistory = false) {
    if (saving) return;
    const state = currentCanvas();
    const errors = validateCanvas(state);
    if (errors.length) {
      setMessage({ text: errors[0], tone: "error" });
      return;
    }
    setMessage(null);
    const isNew = selectedWorkflowId === NEW;
    await runWrite<{ data?: { workflow?: { id: string } } }>({
      showToast: say,
      setBusy: setSaving,
      url: isNew
        ? "/api/composer/workflows"
        : `/api/composer/workflows/${selectedWorkflowId}${discardRunHistory ? "?discardRunHistory=1" : ""}`,
      method: isNew ? "POST" : "PUT",
      body: canvasToWorkflowDef(name, state, description),
      successMessage: "Saved.",
      errorMessage: "Save failed",
      onSuccess: (data) => {
        setPendingDiscard(null);
        baselineRef.current = snapshot();
        onSaved();
        const newId = data.data?.workflow?.id;
        if (isNew && newId) {
          loadedRef.current = newId;
          setSelectedWorkflowId(newId);
        }
      },
      onError: (err) => {
        // 409: saving would delete this workflow's completed run history. That
        // used to happen silently on every structural edit, including a
        // rename. Ask, inline: the answer is `save(true)` from the question
        // below, and the refusal's sentence gives way to it.
        const conflict = discardConflict(err);
        if (!conflict) {
          setPendingDiscard(null);
          return;
        }
        setMessage(null);
        setPendingDiscard({ kind: "save", runCount: conflict.runCount });
      },
    });
  }

  async function removeWorkflow(discardRunHistory = false) {
    if (selectedWorkflowId === NEW || saving) return;
    await runWrite({
      showToast: say,
      setBusy: setSaving,
      url: `/api/composer/workflows/${selectedWorkflowId}${discardRunHistory ? "?discardRunHistory=1" : ""}`,
      method: "DELETE",
      successMessage: "Deleted.",
      errorMessage: "Delete failed",
      onSuccess: () => {
        onSaved();
        loadedRef.current = "";
        setSelectedWorkflowId(NEW);
        setPendingDiscard(null);
      },
      onError: (err) => {
        // 409: the delete would take this workflow's runs with it. The
        // two-click confirm asks whether the click was meant; this asks
        // whether THAT was (T-0106, D1).
        const conflict = discardConflict(err);
        if (!conflict) return;
        setMessage(null);
        setPendingDiscard({
          kind: "delete",
          runCount: conflict.runCount,
          workflowName: conflict.workflowName ?? name,
        });
      },
    });
  }

  async function duplicateWorkflow() {
    if (selectedWorkflowId === NEW || saving) return;
    const state = currentCanvas();
    const errors = validateCanvas(state);
    if (errors.length) {
      setMessage({ text: errors[0], tone: "error" });
      return;
    }
    setMessage(null);
    // No `key` in the body: createWorkflowFromDef treats a repeated key as a
    // replace, so a keyed duplicate would overwrite the thing it copied.
    await runWrite<{ data?: { workflow?: { id: string } } }>({
      showToast: say,
      setBusy: setSaving,
      url: "/api/composer/workflows",
      method: "POST",
      body: canvasToWorkflowDef(`${name} (copy)`, state, description),
      successMessage: "Duplicated.",
      errorMessage: "Duplicate failed",
      onSuccess: (data) => {
        onSaved();
        const newId = data.data?.workflow?.id;
        if (newId) {
          loadedRef.current = newId;
          setSelectedWorkflowId(newId);
        }
        setName(`${name} (copy)`);
        baselineRef.current = "";
      },
    });
  }

  const node = useMemo(() => nodes.find((n) => n.id === selNode) ?? null, [nodes, selNode]);
  const edge = useMemo(() => edges.find((e) => e.id === selEdge) ?? null, [edges, selEdge]);
  const workflowOptions = workflows.filter((w) => w.id !== selectedWorkflowId).map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <Card padding="sm" className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Field label="Edit workflow">
            <Select
              value={selectedWorkflowId}
              onChange={(v) => {
                // Switching used to throw an unsaved board away without a word
                // (T-0106, D7). The Select keeps showing the current workflow
                // until the question below is answered, so nothing moves.
                if (isDirty()) {
                  setPendingSwitch(v);
                  return;
                }
                loadedRef.current = "";
                setSelectedWorkflowId(v);
              }}
              options={[{ value: NEW, label: "+ New workflow" }, ...workflows.map((w) => ({ value: w.id, label: w.name }))]}
            />
          </Field>
        </div>
        <div className="min-w-[180px] flex-1">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name" /></Field>
        </div>
        <div className="min-w-[200px] flex-1">
          {/* Saving from this tab used to blank the stored description, and
              there was nowhere to type one (T-0106, D2). */}
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this workflow is for"
            />
          </Field>
        </div>
        <Button variant="secondary" color="cyan" onClick={relayout}><Wand2 className="h-4 w-4" /> Auto-layout</Button>
        <Button variant="primary" color="cyan" loading={saving} onClick={() => void save()}><Save className="h-4 w-4" /> {selectedWorkflowId === NEW ? "Create" : "Save"}</Button>
        {selectedWorkflowId !== NEW ? (
          <Button variant="secondary" color="cyan" loading={saving} onClick={() => void duplicateWorkflow()}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
        ) : null}
        {selectedWorkflowId !== NEW ? (
          <ConfirmButton
            variant="secondary"
            color="pink"
            onConfirm={() => void removeWorkflow()}
            disabled={saving}
            confirmLabel={<><Trash2 className="h-4 w-4" /> Delete workflow?</>}
            armedClassName="ring-1 ring-neon-pink/60"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </ConfirmButton>
        ) : null}
        {message ? (
          <span
            data-tone={message.tone}
            role={message.tone === "error" ? "alert" : undefined}
            className={`text-body ${message.tone === "error" ? "text-neon-pink" : "text-neon-green"}`}
          >
            {message.text}
          </span>
        ) : null}
      </Card>

      {pendingSwitch !== null ? (
        <Question
          actions={
            <>
              <Button
                variant="secondary"
                color="pink"
                size="sm"
                onClick={() => {
                  loadedRef.current = "";
                  setSelectedWorkflowId(pendingSwitch);
                  setPendingSwitch(null);
                }}
              >
                Discard changes and switch
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPendingSwitch(null)}>
                Keep editing
              </Button>
            </>
          }
        >
          You have unsaved changes to &quot;{name}&quot;. Switching workflows will discard them.
        </Question>
      ) : null}

      {pendingDiscard?.kind === "save" ? (
        <Question
          actions={
            <>
              <Button variant="secondary" color="pink" size="sm" loading={saving} onClick={() => void save(true)}>
                Delete {pendingDiscard.runCount} run{pendingDiscard.runCount === 1 ? "" : "s"} and save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingDiscard(null);
                  setMessage({ text: "Not saved. Run history kept.", tone: "ok" });
                }}
              >
                Keep history
              </Button>
            </>
          }
        >
          Saving this workflow will permanently delete {pendingDiscard.runCount} completed run
          {pendingDiscard.runCount === 1 ? "" : "s"}, including their stage outputs and approvals.
        </Question>
      ) : null}

      {pendingDiscard?.kind === "delete" ? (
        <Question
          actions={
            <>
              <Button
                variant="secondary"
                color="pink"
                size="sm"
                loading={saving}
                onClick={() => void removeWorkflow(true)}
              >
                Delete {pendingDiscard.runCount} run{pendingDiscard.runCount === 1 ? "" : "s"} and the workflow
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingDiscard(null);
                  setMessage({ text: "Not deleted. Run history kept.", tone: "ok" });
                }}
              >
                Keep it
              </Button>
            </>
          }
        >
          Deleting &quot;{pendingDiscard.workflowName}&quot; will permanently delete{" "}
          {pendingDiscard.runCount} run{pendingDiscard.runCount === 1 ? "" : "s"} of it, including
          their stage outputs and approvals.
        </Question>
      ) : null}

      {/* Full-width canvas with floating palette + inspector overlays (so
          react-flow always gets a sized parent — a grid `1fr` cell collapses).
          The card is the frame; the board inside it is the ground, which is
          what the nodes sit on. */}
      <Card padding="none" className="overflow-hidden">
      <div
        ref={wrapRef}
        className="relative h-[600px] w-full bg-ps-surface-ground/60"
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => { setSelNode(n.id); setSelEdge(null); }}
          onEdgeClick={(_, e) => { setSelEdge(e.id); setSelNode(null); }}
          onPaneClick={() => { setSelNode(null); setSelEdge(null); }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          {/* The canvas furniture is xyflow's, so its colours arrive as props
              rather than classes. They were slate-800 and slate-700, which are
              Tailwind defaults nobody chose for this app: the surfaces here are
              blue-tinted. These are the two un-roled rungs of the dark ladder,
              which is what those rungs are FOR, and the shift is a couple of
              values per channel (T-0034). */}
          <Background color="var(--color-dark-700)" gap={18} />
          <Controls className="!bg-ps-surface-panel !border-ps-edge-hairline" />
          <MiniMap
            pannable
            zoomable
            className="!bg-ps-surface-panel"
            maskColor="var(--color-ps-viz-scrim)"
            nodeColor="var(--color-dark-600)"
          />
        </ReactFlow>

        {/* Palette (top-left overlay) */}
        <Card padding="none" className="absolute left-3 top-3 z-sticky w-36 space-y-1.5 p-2 backdrop-blur">
          <h3 className={sectionHeadingClasses}>Drag to add</h3>
          {PALETTE.map((p) => (
            // An outlined chip on the palette's own fill: the chip used to
            // paint the panel rung over the panel rung, which painted nothing.
            <div
              key={p.kind}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData(NODE_KIND_DRAG, p.kind); e.dataTransfer.effectAllowed = "move"; }}
              className={`cursor-grab rounded-ps-md border px-2.5 py-1.5 text-body ${p.color} active:cursor-grabbing`}
            >
              {p.label}
            </div>
          ))}
          <p className="pt-0.5 text-body leading-relaxed text-ps-text-faint">Drag onto the board, then handle → handle to connect.</p>
        </Card>

        {/* Inspector (right overlay; only when something is selected) */}
        {node ? (
          <Card padding="sm" className="absolute right-3 top-3 z-sticky w-72 space-y-3 backdrop-blur">
            <h3 className={sectionHeadingClasses}>Stage</h3>
            <Field label="Label"><Input value={node.data.label} onChange={(e) => patchNode(node.id, { label: e.target.value })} /></Field>
            <Field label="Kind"><Select value={node.data.kind} onChange={(v) => patchNode(node.id, { kind: v })} options={KIND_OPTIONS} /></Field>
            <Field label="Instruction (optional override)">
              <Textarea rows={2} value={String(node.data.config?.instruction ?? "")} onChange={(e) => patchNodeConfig(node.id, "instruction", e.target.value)} placeholder="overrides the default prompt for this stage kind" />
            </Field>
            {node.data.kind === "research" ? (
              <Field label="Research query (optional)"><Input value={String(node.data.config?.query ?? "")} onChange={(e) => patchNodeConfig(node.id, "query", e.target.value)} placeholder="defaults to the run input" /></Field>
            ) : null}
            {node.data.kind === "group" ? (
              <Field label="Sub-workflow">
                <Select value={String(node.data.config?.workflowRef ?? "")} onChange={(v) => patchNodeConfig(node.id, "workflowRef", v)} options={workflowOptions} placeholder="pick a workflow…" />
              </Field>
            ) : null}
            {node.data.isStart ? (
              (() => {
                const spec = (node.data.config?.inputSpec ?? {}) as { objectiveLabel?: string; objectiveHint?: string; examples?: string[] };
                const setSpec = (patch: Partial<typeof spec>) => patchNodeConfig(node.id, "inputSpec", { ...spec, ...patch });
                return (
                  <Card variant="raised" padding="none" className="space-y-2 p-2">
                    <h4 className="text-micro font-mono uppercase tracking-widest text-neon-cyan/80">Workflow input (Run form)</h4>
                    <Field label="Objective label"><Input value={spec.objectiveLabel ?? ""} onChange={(e) => setSpec({ objectiveLabel: e.target.value })} placeholder="e.g. Research question" /></Field>
                    <Field label="Hint / placeholder"><Input value={spec.objectiveHint ?? ""} onChange={(e) => setSpec({ objectiveHint: e.target.value })} placeholder="shown inside the input box" /></Field>
                    <Field label="Examples (one per line)">
                      <Textarea rows={3} value={(spec.examples ?? []).join("\n")} onChange={(e) => setSpec({ examples: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} placeholder="click-to-fill example objectives" />
                    </Field>
                    <Field label="Domain framing (optional)"><Input value={String(node.data.config?.framing ?? "")} onChange={(e) => patchNodeConfig(node.id, "framing", e.target.value)} placeholder="e.g. software / research / data" /></Field>
                  </Card>
                );
              })()
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Toggle label="HIL gate" checked={node.data.gate === "hil"} onChange={(c) => patchNode(node.id, { gate: c ? "hil" : "auto" })} />
              <Toggle label="Start" checked={node.data.isStart} onChange={(c) => patchNode(node.id, { isStart: c })} />
              <Toggle label="End" checked={node.data.isTerminal} onChange={(c) => patchNode(node.id, { isTerminal: c })} />
            </div>
            <Button variant="secondary" color="pink" size="sm" onClick={deleteSelected}><Trash2 className="h-3.5 w-3.5" /> Delete stage</Button>
          </Card>
        ) : edge ? (
          <Card padding="sm" className="absolute right-3 top-3 z-sticky w-72 space-y-3 backdrop-blur">
            <h3 className={sectionHeadingClasses}>Route</h3>
            <Field label="Condition"><Input value={edge.data?.condition ?? "always"} onChange={(e) => patchEdge(edge.id, { condition: e.target.value })} placeholder="always / on_pass…" /></Field>
            <p className="text-body text-ps-text-muted">{CONDITION_HINT}</p>
            <Field label="Label (optional)"><Input value={edge.data?.label ?? ""} onChange={(e) => patchEdge(edge.id, { label: e.target.value })} /></Field>
            <Button variant="secondary" color="pink" size="sm" onClick={deleteSelected}><Trash2 className="h-3.5 w-3.5" /> Delete route</Button>
          </Card>
        ) : null}
      </div>
      </Card>
    </div>
  );
}

export default function WorkflowCanvas({ workflows, onSaved }: { workflows: ComposerWorkflow[]; onSaved: () => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner workflows={workflows} onSaved={onSaved} />
    </ReactFlowProvider>
  );
}
