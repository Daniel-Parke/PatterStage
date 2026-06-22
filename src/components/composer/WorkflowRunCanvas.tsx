// ═══════════════════════════════════════════════════════════════
// WorkflowRunCanvas — the LIVE run view on the same react-flow canvas
//
// Read-only board that renders a Composer run's graph with per-node status, an
// electrified active pathway (the edges leaving the in-flight node), and the
// HIL gate prompt in-canvas. Unifies "build" and "watch" onto one surface
// (replaces the vertical WorkflowPipeline). Client-only (react-flow needs DOM).
// ═══════════════════════════════════════════════════════════════

"use client";

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

const STATUS_BORDER: Record<string, string> = {
  pending: "border-white/15",
  running: "border-neon-cyan",
  completed: "border-neon-green/70",
  failed: "border-neon-pink/70",
  skipped: "border-white/10",
};
const STATUS_DOT: Record<string, string> = {
  pending: "bg-white/25",
  running: "bg-neon-cyan",
  completed: "bg-neon-green",
  failed: "bg-neon-pink",
  skipped: "bg-white/15",
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
      className={`min-w-[150px] rounded-lg border bg-dark-900/90 px-3 py-2 shadow-lg backdrop-blur transition-colors ${STATUS_BORDER[data.status] ?? "border-white/15"} ${data.isCurrent ? "ring-1 ring-neon-cyan/60 shadow-[0_0_12px_2px_rgb(34_211_238/0.4)]" : ""} ${data.hasRun ? "cursor-pointer hover:border-white/40" : "cursor-default"}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/40" />
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[data.status] ?? "bg-white/25"} ${data.isCurrent ? "animate-pulse" : ""}`} />
        <span className="truncate text-sm text-white/90">{data.label}</span>
        {data.gate === "hil" ? <span className="rounded bg-neon-yellow/15 px-1 text-[8px] font-mono text-neon-yellow">HIL</span> : null}
        {data.attempt > 1 ? <span className="ml-auto rounded bg-white/10 px-1 text-[8px] font-mono text-white/50">×{data.attempt}</span> : null}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-white/30">
        <span>{data.kind}</span>
        <span className={data.status === "failed" ? "text-neon-pink" : data.status === "completed" ? "text-neon-green" : "text-white/40"}>{data.status}</span>
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
        style: active ? { stroke: "#22d3ee", strokeWidth: 2 } : { stroke: "rgba(255,255,255,0.15)" },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, latestNodeRun, currentNodeId]);

  return (
    <div className="relative h-[68vh] min-h-[560px] w-full overflow-hidden rounded-xl border border-white/10 bg-dark-950/60">
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
        <Background color="#1e293b" gap={18} />
      </ReactFlow>
      {gate ? <div className="absolute right-3 top-3 z-10 w-72 rounded-lg border border-white/10 bg-dark-900/90 p-3 backdrop-blur">{gate}</div> : null}
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
