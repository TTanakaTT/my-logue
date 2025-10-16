<script context="module" lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  type XY = { x: number; y: number };
  // Persist node positions across component remounts per layout signature
  const positionCache = new SvelteMap<string, Record<string, XY>>();
  export function getCachedPositions(signature: string): Record<string, XY> | undefined {
    return positionCache.get(signature);
  }
  export function setCachedPositions(signature: string, positions: Record<string, XY>): void {
    positionCache.set(signature, positions);
  }
</script>

<script lang="ts">
  import Graph from 'graphology';
  import Sigma from 'sigma';
  import { onMount, onDestroy } from 'svelte';
  import type { FloorLayout } from '$lib/domain/entities/floor';
  import forceAtlas2 from 'graphology-layout-forceatlas2';

  export let layout: FloorLayout;
  export let currentNodeId: number;
  export let consumedNodeIds: number[] = [];
  export let startNodeId: number | undefined;
  export let onSelectNode: ((id: number) => void) | undefined;

  let container: HTMLDivElement;
  let renderer: Sigma | undefined;
  let fullGraph: Graph | undefined; // Graph containing ALL nodes/edges of the floor
  let lastLayoutSignature: string | undefined; // To detect layout changes
  let cameraState: { x: number; y: number; angle: number; ratio: number } | undefined; // preserve view

  function nodeColor(id: number): string {
    const visitedCol = 'gray';
    const currentCol = 'orange';
    const defaultCol = 'skyblue';
    if (id === currentNodeId) return currentCol;
    if (typeof startNodeId === 'number' && id === startNodeId) return visitedCol;
    if (consumedNodeIds && consumedNodeIds.includes(id)) return visitedCol;
    return defaultCol;
  }

  function layoutSignature(l: FloorLayout): string {
    // Create a stable signature of the floor to detect changes
    const nodeIds = l.nodes.map((n) => n.id).sort((a, b) => a - b);
    const edges = l.edges
      .map((e) => [Math.min(e.source, e.target), Math.max(e.source, e.target)].join('-'))
      .sort();
    return `${nodeIds.join(',')}|${edges.join(',')}`;
  }

  function buildFullGraph(l: FloorLayout, signature: string): Graph {
    const g = new Graph();
    const cached = getCachedPositions(signature);
    // Add ALL nodes first with random initial positions
    for (const n of l.nodes) {
      const cachedPos = cached?.[String(n.id)];
      g.addNode(String(n.id), {
        label: n.kind,
        size: 8,
        color: nodeColor(n.id),
        x: cachedPos ? cachedPos.x : Math.random(),
        y: cachedPos ? cachedPos.y : Math.random(),
        hidden: false
      });
    }
    // Add ALL edges
    const edgeColor = 'gray';
    for (const e of l.edges) {
      // graphology will generate edge keys automatically
      g.addEdge(String(e.source), String(e.target), { size: 1, color: edgeColor, hidden: false });
    }
    // Compute positions ONCE for the whole graph when not cached
    if (!cached) {
      try {
        forceAtlas2.assign(g, {
          iterations: 200,
          settings: { gravity: 0.1, scalingRatio: 10, slowDown: 2 }
        });
      } catch (e) {
        console.warn('ForceAtlas2 failed, using random positions', e);
      }
      // Save positions to cache for this layout signature
      const positions: Record<string, { x: number; y: number }> = {};
      g.forEachNode((node, attrs) => {
        positions[node] = { x: attrs.x as number, y: attrs.y as number };
      });
      setCachedPositions(signature, positions);
    }
    return g;
  }

  function computeVisibility(l: FloorLayout) {
    // visited lookup
    const visitedArr: number[] = [
      ...(consumedNodeIds || []),
      currentNodeId,
      ...(typeof startNodeId === 'number' ? [startNodeId] : [])
    ];
    const visitedLookup: Record<number, boolean> = {};
    for (const v of visitedArr) visitedLookup[v] = true;

    // adjacency as plain object
    const adj: Record<number, number[]> = {};
    for (const n of l.nodes) adj[n.id] = [];
    for (const e of l.edges) {
      adj[e.source]?.push(e.target);
      adj[e.target]?.push(e.source);
    }

    // frontier: neighbors of visited that are not visited
    const frontierLookup: Record<number, boolean> = {};
    for (const e of l.edges) {
      const a = e.source;
      const b = e.target;
      if (visitedLookup[a] && !visitedLookup[b]) frontierLookup[b] = true;
      if (visitedLookup[b] && !visitedLookup[a]) frontierLookup[a] = true;
    }

    // BFS tree edges inside visited region
    const pathEdge: Record<string, boolean> = {};
    if (visitedLookup[currentNodeId]) {
      const queue: number[] = [currentNodeId];
      const seen: Record<number, boolean> = { [currentNodeId]: true };
      while (queue.length) {
        const v = queue.shift()!;
        const neighbors = adj[v] || [];
        for (const nx of neighbors) {
          if (!visitedLookup[nx]) continue;
          if (seen[nx]) continue;
          seen[nx] = true;
          queue.push(nx);
          const a = Math.min(v, nx);
          const b = Math.max(v, nx);
          pathEdge[`${a}-${b}`] = true;
        }
      }
    }

    // border edges between visited and frontier
    const borderEdge: Record<string, boolean> = {};
    for (const e of l.edges) {
      const a = e.source;
      const b = e.target;
      const av = !!visitedLookup[a];
      const bv = !!visitedLookup[b];
      const af = !!frontierLookup[a];
      const bf = !!frontierLookup[b];
      if ((av && bf) || (bv && af)) {
        const s = Math.min(a, b);
        const t = Math.max(a, b);
        borderEdge[`${s}-${t}`] = true;
      }
    }

    const drawableLookup: Record<number, boolean> = { ...visitedLookup, ...frontierLookup };
    return { visitedLookup, frontierLookup, pathEdge, borderEdge, drawableLookup };
  }

  function applyVisibility(l: FloorLayout) {
    if (!fullGraph) return;
    const info = computeVisibility(l);
    // Update nodes
    fullGraph.forEachNode((node, attrs) => {
      const id = Number(node);
      const shouldShow = !!info.drawableLookup[id];
      const color = nodeColor(id);
      if (attrs.hidden !== !shouldShow) fullGraph!.setNodeAttribute(node, 'hidden', !shouldShow);
      if (attrs.color !== color) fullGraph!.setNodeAttribute(node, 'color', color);
    });
    // Update edges
    fullGraph.forEachEdge((edge, attrs, source, target) => {
      const a = Number(source);
      const b = Number(target);
      const s = Math.min(a, b);
      const t = Math.max(a, b);
      const key = `${s}-${t}`;
      const showByType = !!(info.pathEdge[key] || info.borderEdge[key]);
      const endpointsVisible = !!(info.drawableLookup[a] && info.drawableLookup[b]);
      const shouldShow = showByType && endpointsVisible;
      if (attrs.hidden !== !shouldShow) fullGraph!.setEdgeAttribute(edge, 'hidden', !shouldShow);
    });
    // Trigger a redraw
    renderer?.refresh();
  }

  function render(..._deps: unknown[]) {
    // mark deps as used to satisfy lint while leveraging Svelte change tracking via args
    void _deps;
    if (!container || !layout) return;

    const sig = layoutSignature(layout);
    const isLayoutChanged = sig !== lastLayoutSignature;

    if (isLayoutChanged) {
      // preserve camera state if renderer exists
      if (renderer) {
        const cam = renderer.getCamera();
        cameraState = {
          x: cam.x,
          y: cam.y,
          angle: cam.angle,
          ratio: cam.ratio
        };
        renderer.kill();
        renderer = undefined;
      }

      // rebuild full graph and positions ONCE (use cached positions if available)
      fullGraph = buildFullGraph(layout, sig);
      lastLayoutSignature = sig;

      // create renderer for the full graph
      renderer = new Sigma(fullGraph, container, {
        renderEdgeLabels: false,
        allowInvalidContainer: true,
        labelColor: { color: 'gray' }
      });

      // Disable camera interactions (zoom/pan) from user input while keeping click events
      try {
        const mouseCaptor = renderer.getMouseCaptor?.();
        mouseCaptor.on('wheel', (e) => e.preventSigmaDefault?.());
        mouseCaptor.on('mousedown', (e) => e.preventSigmaDefault?.());
        mouseCaptor.on('mousemove', (e) => e.preventSigmaDefault?.());

        const touchCaptor = renderer.getTouchCaptor?.();
        // Different Sigma versions expose different touch event names; guard with optional chaining
        touchCaptor.on('touchmove', (e) => e.preventSigmaDefault?.());
      } catch (err) {
        console.warn('Failed to disable sigma interactions', err);
      }

      // restore camera if we had one
      if (cameraState) {
        const cam = renderer.getCamera();
        cam.setState({ ...cameraState });
      }

      // Lock camera zoom level to disable pinch/scroll zoom regardless of input source
      {
        const cam = renderer.getCamera();
        const lockedRatio = cameraState?.ratio ?? cam.ratio;
        // Clamp zoom by setting min/max to the same value
        renderer.setSetting('minCameraRatio', lockedRatio);
        renderer.setSetting('maxCameraRatio', lockedRatio);
      }

      // Click to select node
      renderer.on('clickNode', (payload: { node: string }) => {
        const id = Number(payload.node);
        if (Number.isFinite(id)) onSelectNode?.(id);
      });
    }

    // Apply current visibility & colors without touching positions
    applyVisibility(layout);
  }

  onMount(() => {
    render();
  });

  $: render(layout, currentNodeId, consumedNodeIds, startNodeId);

  onDestroy(() => {
    renderer?.kill();
  });
</script>

<div bind:this={container} class="w-full h-64 rounded bg-gray-800"></div>
