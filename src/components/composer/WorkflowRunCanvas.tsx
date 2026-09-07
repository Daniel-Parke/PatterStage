// ═══════════════════════════════════════════════════════════════
// WorkflowRunCanvas — the LIVE run view on the same react-flow canvas
//
// Read-only board that renders a Composer run's graph with per-node status, an
// electrified active pathway (the edges leaving the in-flight node), and the
// HIL gate prompt in-canvas. Unifies "build" and "watch" onto one surface
// (replaces the vertical WorkflowPipeline). Client-only (react-flow needs DOM).
// ═══════════════════════════════════════════════════════════════

"use client";

import { statusToneClasses } from "@/lib/theme";
import { useMemo, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { graphToCanvas } from "@/lib/composer/canvas-graph";
import type { ComposerNodeRun, ComposerWorkflowGraph } from "@/lib/composer/schema";

/**
 * A stage's outline. `pending` and `skipped` are deliberately NOT status
 * colours and stay on the edge ladder: a stage nobody has reached yet is not in
 * a state, it is merely outlined, and a skipped one is a subdivision of the
 * graph rather than an event (T-0120).
 *
 * The rest take the status rungs. `rejected` and `cancelled` are `blocked`
 * rather than `fail`, which is the decision the comment below has recorded
 * since T-0069 and which the ladder happens to paint the same orange.
 */
const STATUS_BORDER: Record<string, string> = {
  pending: "border-ps-edge-emphasis",
  running: statusToneClasses.running.border,
  completed: statusToneClasses.ok.border,
  failed: statusToneClasses.fail.border,
  // A decision, not a defect: orange separates the gate the operator turned
  // down from the stage that broke. Before T-0069 a rejected gate kept its
  // `completed` status and drew GREEN, contradicting the failed run header.
  rejected: statusToneClasses.blocked.border,
  // Same orange as rejected: both are the operator's decision, not a fault.
  cancelled: statusToneClasses.blocked.border,
  skipped: "border-ps-edge-hairline",
};
const STATUS_DOT: Record<string, string> = {
  pending: statusToneClasses.idle.dot,
  running: statusToneClasses.running.dot,
  completed: statusToneClasses.ok.dot,
  failed: statusToneClasses.fail.dot,
  rejected: statusToneClasses.blocked.dot,
  cancelled: statusToneClasses.blocked.dot,
  skipped: statusToneClasses.idle.dot,
};

interface LiveNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
  gate: string;
  isCurrent: boolean;
  status: string;
  verdictPass: boolean | null;
  attempt: number;
  hasRun: boolean;
}
type LiveNode = Node<LiveNodeData, "live">;

function LiveNodeView({ data }: NodeProps<LiveNode>) {
  return (
    <div
      title={data.hasRun ? "Click for stage details" : undefined}
      className={`min-w-[150px] rounded-ps-md border bg-ps-surface-panel px-3 py-2 shadow-lg backdrop-blur transition-colors ${STATUS_BORDER[data.status] ?? "border-ps-edge-emphasis"} ${data.isCurrent ? "ring-1 ring-neon-cyan/60 shadow-[0_0_12px_2px_rgb(var(--ps-rgb-neon-cyan)_/_0.4)]" : ""} ${data.hasRun ? "cursor-pointer hover:border-ps-edge-emphasis" : "cursor-default"}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/40" />
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[data.status] ?? "bg-white/25"} ${data.isCurrent ? "animate-pulse" : ""}`} />
        <span className="truncate text-body text-ps-text-primary">{data.label}</span>
        {data.gate === "hil" ? <span className="rounded-ps-sm bg-neon-yellow/15 px-1 text-micro font-mono text-neon-yellow">HIL</span> : null}
        {data.attempt > 1 ? <span className="ml-auto rounded-ps-sm bg-ps-surface-raised px-1 text-micro font-mono text-ps-text-muted">×{data.attempt}</span> : null}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-ps-text-muted">
        <span>{data.kind}</span>
        <span className={data.status === "failed" ? "text-neon-pink" : data.status === "completed" ? "text-neon-green" : "text-ps-text-muted"}>{data.status}</span>
        {data.verdictPass === false ? <span className="text-neon-pink">fail</span> : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-neon-cyan/70" />
    </div>
  );
}

const nodeTypes = { live: LiveNodeView };

function RunCanvasInner({
  graph,
  latestNodeRun,
  currentNodeId,
  gate,
  onSelectNode,
}: {
  graph: ComposerWorkflowGraph;
  latestNodeRun: (nodeId: string) => ComposerNodeRun | null;
  currentNodeId: string | null;
  gate?: ReactNode;
  onSelectNode?: (nodeKey: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const canvas = graphToCanvas(graph);
    const posByKey = new Map(canvas.nodes.map((n) => [n.id, n.position]));
    const idToKey = new Map(graph.nodes.map((n) => [n.id, n.key]));
    const currentKey = currentNodeId ? idToKey.get(currentNodeId) ?? null : null;

    const rfNodes: LiveNode[] = graph.nodes.map((n) => {
      const nr = latestNodeRun(n.id);
      return {
        id: n.key,
        type: "live" as const,
        position: posByKey.get(n.key) ?? { x: 0, y: 0 },
        draggable: false,
        connectable: false,
        data: {
          label: n.label,
          kind: n.kind,
          gate: n.gate,
          isCurrent: currentNodeId === n.id,
          status: nr?.status ?? "pending",
          verdictPass: nr?.verdict ? nr.verdict.pass : null,
          attempt: nr?.attempt ?? 1,
          hasRun: nr != null,
        },
      };
    });

    const rfEdges: Edge[] = canvas.edges.map((e) => {
      const active = currentKey != null && e.source === currentKey;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.data.condition === "always" ? undefined : e.data.condition,
        animated: active,
        className: active ? "ps-edge-glow" : undefined,
        // The live pathway flies the console accent, not a hand-picked cyan
        // one shade off it. The node this edge leads to already draws its
        // ring with ring-neon-cyan, so the two were never meant to differ.
        style: active
          ? { stroke: "var(--color-neon-cyan)", strokeWidth: 2 }
          : { stroke: "var(--color-ps-viz-inert)" },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, latestNodeRun, currentNodeId]);

  return (
    <div className="relative h-[68vh] min-h-[560px] w-full overflow-hidden rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-ground/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-dark-700)" gap={18} />
      </ReactFlow>
      {/* Wider and bounded since the gate carries the stage's output: the panel
          scrolls inside the board rather than growing past the bottom of it. */}
      {gate ? <div className="absolute right-3 top-3 z-10 w-[22rem] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-ps-md border border-ps-edge-hairline bg-ps-surface-panel p-3 backdrop-blur">{gate}</div> : null}
    </div>
  );
}

export default function WorkflowRunCanvas(props: {
  graph: ComposerWorkflowGraph;
  latestNodeRun: (nodeId: string) => ComposerNodeRun | null;
  currentNodeId: string | null;
  gate?: ReactNode;
  onSelectNode?: (nodeKey: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <RunCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
