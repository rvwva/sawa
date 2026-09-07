"use client";
import { useEffect, useState } from "react";
import { SigmaContainer, useLoadGraph, useSigma } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

export interface OnaNode {
  id: string;
  label?: string;
  color?: string;
  size?: number;
}

export interface OnaEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface OnaGraphProps {
  nodes: OnaNode[];
  edges: OnaEdge[];
  onNodeClick?: (nodeId: string) => void;
}

function GraphLoader({ nodes, edges, onNodeClick }: OnaGraphProps) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const graph = new Graph();
    for (const node of nodes) {
      graph.addNode(node.id, {
        x: Math.random(),
        y: Math.random(),
        size: node.size ?? 6,
        color: node.color ?? "#6366f1",
        label: "",
        fullLabel: node.label ?? "",
      });
    }
    for (const edge of edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        const w = edge.weight ?? 1;
        graph.addEdge(edge.source, edge.target, {
          weight: w,
          size: Math.min(1 + w / 5, 8),
          color: "#94a3b8",
        });
      }
    }
    if (graph.order > 0) {
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: forceAtlas2.inferSettings(graph),
      });
    }
    loadGraph(graph);
    sigma.refresh();
  }, [nodes, edges, loadGraph, sigma]);

  useEffect(() => {
    sigma.on("enterNode", ({ node }) => setHoveredNode(node));
    sigma.on("leaveNode", () => setHoveredNode(null));
    if (onNodeClick) {
      sigma.on("clickNode", ({ node }) => onNodeClick(node));
    }
    return () => {
      sigma.removeAllListeners("enterNode");
      sigma.removeAllListeners("leaveNode");
      sigma.removeAllListeners("clickNode");
    };
  }, [sigma, onNodeClick]);

  useEffect(() => {
    sigma.setSetting("nodeReducer", (node, data) => {
      if (node === hoveredNode && data.fullLabel) {
        return { ...data, label: data.fullLabel, forceLabel: true, zIndex: 1 };
      }
      return { ...data, label: "" };
    });
    sigma.refresh();
  }, [hoveredNode, sigma]);

  return null;
}

export default function OnaGraph({ nodes, edges, onNodeClick }: OnaGraphProps) {
  return (
    <SigmaContainer
      style={{ height: "400px", width: "100%", cursor: onNodeClick ? "pointer" : "default" }}
      settings={{ labelRenderedSizeThreshold: 999, renderEdgeLabels: false }}
    >
      <GraphLoader nodes={nodes} edges={edges} onNodeClick={onNodeClick} />
    </SigmaContainer>
  );
}
