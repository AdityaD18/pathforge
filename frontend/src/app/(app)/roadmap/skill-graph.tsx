"use client";

import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import { Lock } from "lucide-react";
import { memo, useMemo } from "react";

import { cn, pct, STATE_COLOR } from "@/lib/format";
import type { Roadmap, RoadmapNode } from "@/lib/types";

type TopicNodeData = RoadmapNode & { selected: boolean } & Record<string, unknown>;

const COL_W = 290;
const ROW_H = 100;
const MIN_READABLE_ZOOM = 0.8;

const TopicNode = memo(function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const locked = data.status === "locked";
  const mastered = data.status === "mastered";
  const ready = data.status === "ready" || data.status === "in_progress";
  return (
    <div className={cn("w-[236px] rounded-[10px] border px-3.5 py-3 text-left transition-shadow",
      mastered ? "border-mastered/50 bg-[#0f2a33]" : ready ? "border-electric/70 bg-panel-2" : "border-line bg-panel",
      data.selected && "ring-2 ring-violet ring-offset-2 ring-offset-midnight",
      ready && "shadow-[0_0_24px_-6px_rgb(76_141_255/0.6)]")}>
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line" />
      <div className="flex items-center gap-2">
        {locked ? <Lock className="size-3 shrink-0 text-haze" /> :
          <span className="size-2 shrink-0 rounded-full" style={{ background: mastered ? STATE_COLOR.mastered : STATE_COLOR[data.state] }} />}
        <span className={cn("truncate text-[14.5px] font-medium", locked ? "text-mist" : "text-ink")}>{data.name}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[12px] text-mist">
        <span>{mastered ? "Mastered" : data.order ? `Step ${data.order}` : ""}{data.is_goal ? (mastered || data.order ? ", career goal" : "Career goal") : ""}</span>
        <span className="tabular-nums">{data.mastery_score === null ? "not assessed" : pct(data.mastery_score)}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line" />
    </div>
  );
});

const nodeTypes = { topic: TopicNode };

export function SkillGraph({ roadmap, selected, onSelect }: { roadmap: Roadmap; selected: string | null; onSelect: (id: string) => void }) {
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
        data: { ...n, selected: n.topic_id === selected }, draggable: false,
      }));
    });

    const edges: Edge[] = roadmap.graph.edges.map((e) => {
      const satisfied = status[e.source] === "mastered";
      const touches = selected && (e.source === selected || e.target === selected);
      return {
        id: `${e.source}->${e.target}`, source: e.source, target: e.target, type: "default",
        style: { stroke: touches ? "#8b7bff" : satisfied ? "#5ed3a8" : "#2c3c70", strokeWidth: touches ? 2.2 : 1.5,
          strokeDasharray: satisfied ? undefined : "5 5", opacity: selected && !touches ? 0.35 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: touches ? "#8b7bff" : satisfied ? "#5ed3a8" : "#2c3c70" },
      };
    });
    return { nodes, edges };
  }, [roadmap, selected]);

  // Fit the whole graph when it stays readable; otherwise start at a readable zoom anchored to the
  // left edge (where the path begins) and let the learner pan.
  const onInit = async (flow: ReactFlowInstance<Node<TopicNodeData>, Edge>) => {
    await flow.fitView({ padding: 0.12 }); // resolves once nodes are measured
    const v = flow.getViewport();
    if (v.zoom < MIN_READABLE_ZOOM) {
      const ys = nodes.map((n) => n.position.y);
      const mid = (Math.min(...ys) + Math.max(...ys) + 60) / 2;
      flow.setViewport({ x: 32, y: 280 - mid * MIN_READABLE_ZOOM, zoom: MIN_READABLE_ZOOM });
    }
  };

  return (
    <div className="h-[560px] w-full" aria-label="Prerequisite graph. Use the schedule tab for a text version.">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={onInit}
        minZoom={0.3} maxZoom={1.6} nodesConnectable={false} nodesDraggable={false} elementsSelectable
        onNodeClick={(_, n) => onSelect(n.id)} proOptions={{ hideAttribution: false }}>
        <Background color="#1a2750" gap={22} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
