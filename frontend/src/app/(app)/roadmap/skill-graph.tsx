"use client";

import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import { Check, Flag, Lock } from "lucide-react";
import { memo, useMemo } from "react";

import { C, cn, pct, STATE_COLOR } from "@/lib/format";
import type { Roadmap, RoadmapNode } from "@/lib/types";

type TopicNodeData = RoadmapNode & { selected: boolean; next: boolean } & Record<string, unknown>;

const COL_W = 300;
const ROW_H = 112;
const MIN_READABLE_ZOOM = 0.7;

const TopicNode = memo(function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const locked = data.status === "locked";
  const mastered = data.status === "mastered";
  const ready = data.status === "ready" || data.status === "in_progress";
  const color = mastered ? STATE_COLOR.mastered : STATE_COLOR[data.state];
  return (
    <div className={cn("w-[244px] rounded-xl border-2 px-4 py-3 text-left transition-shadow",
      mastered ? "border-mastered/60 bg-mastered/[0.10]" : ready ? "border-electric/80 bg-panel-2" : "border-line bg-panel",
      data.selected && "ring-2 ring-violet ring-offset-2 ring-offset-midnight",
      data.next && "animate-pulse-ring")}>
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-line" />
      <div className="flex items-center gap-2">
        {locked ? <Lock className="size-4 shrink-0 text-haze" /> : mastered ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-mastered text-midnight"><Check className="size-3.5" /></span>
        ) : <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        <span className={cn("truncate text-[15px] font-medium", locked ? "text-mist" : "text-ink")}>{data.name}</span>
        {data.is_goal && <Flag className="ml-auto size-4 shrink-0 text-violet-soft" aria-label="Career goal" />}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
        {data.mastery_score !== null && <div className="h-full rounded-full" style={{ width: `${Math.max(4, data.mastery_score * 100)}%`, background: color }} />}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-mist">
        <span>{mastered ? "Mastered" : data.next ? "Up next" : data.order ? `Step ${data.order}` : ""}</span>
        <span className="tabular-nums">{data.mastery_score === null ? "not tested" : pct(data.mastery_score)}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-line" />
    </div>
  );
});

const nodeTypes = { topic: TopicNode };

export function SkillGraph({ roadmap, selected, onSelect }: { roadmap: Roadmap; selected: string | null; onSelect: (id: string) => void }) {
  const nextId = roadmap.steps.find((s) => s.status !== "locked")?.topic_id ?? null;
  const { nodes, edges } = useMemo(() => {
    const columns = new Map<number, RoadmapNode[]>();
    roadmap.graph.nodes.forEach((n) => columns.set(n.depth, [...(columns.get(n.depth) ?? []), n]));
    const tallest = Math.max(...[...columns.values()].map((c) => c.length));
    const status = Object.fromEntries(roadmap.graph.nodes.map((n) => [n.topic_id, n.status]));

    const nodes: Node<TopicNodeData>[] = [];
    [...columns.entries()].sort(([a], [b]) => a - b).forEach(([, col], ci) => {
      const sorted = [...col].sort((a, b) => (a.order ?? -1) - (b.order ?? -1) || a.name.localeCompare(b.name));
      const offset = ((tallest - sorted.length) * ROW_H) / 2;
      sorted.forEach((n, i) => nodes.push({
        id: n.topic_id, type: "topic", position: { x: ci * COL_W, y: offset + i * ROW_H },
        data: { ...n, selected: n.topic_id === selected, next: n.topic_id === nextId }, draggable: false,
      }));
    });

    const edges: Edge[] = roadmap.graph.edges.map((e) => {
      const satisfied = status[e.source] === "mastered";
      const touches = selected && (e.source === selected || e.target === selected);
      const stroke = touches ? C.accent2 : satisfied ? C.mastered : C.line;
      return {
        id: `${e.source}->${e.target}`, source: e.source, target: e.target, type: "default", animated: !satisfied && !!touches,
        style: { stroke, strokeWidth: touches ? 2.6 : 1.8, strokeDasharray: satisfied ? undefined : "6 6", opacity: selected && !touches ? 0.35 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      };
    });
    return { nodes, edges };
  }, [roadmap, selected, nextId]);

  // Fit the whole graph when it stays readable; otherwise start at a readable zoom anchored to the
  // left edge (where the path begins) and let the learner pan.
  const onInit = async (flow: ReactFlowInstance<Node<TopicNodeData>, Edge>) => {
    await flow.fitView({ padding: 0.12 }); // resolves once nodes are measured
    const v = flow.getViewport();
    if (v.zoom < MIN_READABLE_ZOOM) {
      const ys = nodes.map((n) => n.position.y);
      const mid = (Math.min(...ys) + Math.max(...ys) + 70) / 2;
      flow.setViewport({ x: 32, y: 300 - mid * MIN_READABLE_ZOOM, zoom: MIN_READABLE_ZOOM });
    }
  };

  return (
    <div className="h-[600px] w-full" aria-label="Prerequisite graph. Use the timeline tab for a text version.">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={onInit}
        minZoom={0.3} maxZoom={1.6} nodesConnectable={false} nodesDraggable={false} elementsSelectable
        onNodeClick={(_, n) => onSelect(n.id)} proOptions={{ hideAttribution: false }}>
        <Background color={C.lineSoft} gap={24} size={1.5} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
