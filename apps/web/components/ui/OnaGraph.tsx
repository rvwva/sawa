"use client";

import { useEffect } from "react";
import { SigmaContainer, useLoadGraph, useSigma } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

export interface OnaNode {
  id: string;
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
}

function GraphLoader({ nodes, edges }: OnaGraphProps) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();

  useEffect(() => {
    const graph = new Graph();

    for (const node of nodes) {
      graph.addNode(node.id, {
        x: Math.random(),
        y: Math.random(),
        size: node.size ?? 6,
        color: node.color ?? "#6366f1",
        label: "",
      });
    }

    for (const edge of edges) {
      if (
        graph.hasNode(edge.source) &&
        graph.hasNode(edge.target) &&
        !graph.hasEdge(edge.source, edge.target)
      ) {
        graph.addEdge(edge.source, edge.target, {
          weight: edge.weight ?? 1,
          size: 1,
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

  return null;
}

export default function OnaGraph({ nodes, edges }: OnaGraphProps) {
  return (
    <SigmaContainer
      style={{ height: "400px", width: "100%" }}
      settings={{ labelRenderedSizeThreshold: 999, renderEdgeLabels: false }}
    >
      <GraphLoader nodes={nodes} edges={edges} />
    </SigmaContainer>
  );
}
