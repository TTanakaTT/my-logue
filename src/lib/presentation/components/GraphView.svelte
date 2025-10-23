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
  import { SvelteSet } from 'svelte/reactivity';

  // Minimal attribute shape stored on graph nodes for our use
  type NodeAttrs = {
    hidden?: boolean;
    label?: string;
    x?: number;
    y?: number;
    size?: number;
    color?: string;
  };

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
  // Screen-space labels overlaid above Sigma canvas (always visible, no hover needed)
  let labels: { id: string; x: number; y: number; text: string }[] = [];
  // Nodes for which overlay labels are temporarily hidden (to avoid duplication with Sigma hover labels)
  const suppressOverlayForNodes = new SvelteSet<string>();

  // Select the nearest visible node under a viewport coordinate (px) and invoke callback
  function selectNodeAtViewportPoint(vpx: number, vpy: number) {
    if (!renderer || !fullGraph) return;
    const r: Sigma = renderer;
    const g: Graph = fullGraph;

    // Converter from graph -> viewport, reused from label computation logic
    const convert: (p: { x: number; y: number }) => { x: number; y: number } = (() => {
      const asGraphToViewport = (
        r as unknown as {
          graphToViewport?: (c: { x: number; y: number }) => { x: number; y: number };
        }
      ).graphToViewport;
      if (asGraphToViewport) return asGraphToViewport.bind(r);
      const asFramedToViewport = (
        r as unknown as {
          framedGraphToViewport?: (c: { x: number; y: number }) => { x: number; y: number };
        }
      ).framedGraphToViewport;
      if (asFramedToViewport) return asFramedToViewport.bind(r);
      // Fallback using camera
      return (c: { x: number; y: number }) => {
        const cam = r.getCamera();
        const rect = container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const vx = (c.x - cam.x) / cam.ratio + cx;
        const vy = (c.y - cam.y) / cam.ratio + cy;
        return { x: vx, y: vy };
      };
    })();

    let bestId: string | null = null;
    let bestD2 = Infinity;
    const hitRadiusPx = 12; // clickable radius in viewport px
    const hitR2 = hitRadiusPx * hitRadiusPx;
    g.forEachNode((node, attrs) => {
      if (attrs.hidden) return;
      const x = g.getNodeAttribute(node, 'x') as number | undefined;
      const y = g.getNodeAttribute(node, 'y') as number | undefined;
      if (x == null || y == null) return;
      const vp = convert({ x, y });
      const dx = vp.x - vpx;
      const dy = vp.y - vpy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= hitR2 && d2 < bestD2) {
        bestD2 = d2;
        bestId = node;
      }
    });

    if (bestId != null) {
      const id = Number(bestId);
      if (Number.isFinite(id)) onSelectNode?.(id);
    }
  }

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

  /** Update screen-space label positions and texts from current renderer state */
  function updateLabels() {
    const r = renderer;
    const g = fullGraph;
    if (!r || !g) return;
    const arr: { id: string; x: number; y: number; text: string }[] = [];
    // Prepare converter: graph coords -> viewport (CSS px)
    const convert: (p: { x: number; y: number }) => { x: number; y: number } = (() => {
      const asGraphToViewport = (
        r as unknown as {
          graphToViewport?: (c: { x: number; y: number }) => { x: number; y: number };
        }
      ).graphToViewport;
      if (asGraphToViewport) return asGraphToViewport.bind(r);
      const asFramedToViewport = (
        r as unknown as {
          framedGraphToViewport?: (c: { x: number; y: number }) => { x: number; y: number };
        }
      ).framedGraphToViewport;
      if (asFramedToViewport) return asFramedToViewport.bind(r);
      // Fallback using camera state
      return (c: { x: number; y: number }) => {
        const cam = r.getCamera();
        const rect = container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const vx = (c.x - cam.x) / cam.ratio + cx;
        const vy = (c.y - cam.y) / cam.ratio + cy;
        return { x: vx, y: vy };
      };
    })();

    g.forEachNode((node: string, attrs: NodeAttrs) => {
      // Skip hidden nodes based on graph attribute
      const hidden = Boolean(attrs.hidden as boolean | undefined);
      if (hidden) return;
      // Suppress overlay label while node is hovered/pressed (Sigma draws its own focus label)
      if (suppressOverlayForNodes.has(node)) return;
      const x = g.getNodeAttribute(node, 'x') as number | undefined;
      const y = g.getNodeAttribute(node, 'y') as number | undefined;
      if (x == null || y == null) return;
      const vp = convert({ x, y });
      const labelAttr = (g.getNodeAttribute(node, 'label') as string | undefined) ?? String(node);
      const text: string = labelAttr;
      arr.push({ id: String(node), x: vp.x, y: vp.y, text });
    });
    labels = arr;
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
      // Temporarily force passive listeners for wheel/touch during Sigma initialization
      const needsPassive = new Set<string>([
        'wheel',
        'mousewheel',
        'touchstart',
        'touchmove',
        'touchend',
        'touchcancel'
      ]);
      type AddEventListener = (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => void;
      const proto = EventTarget.prototype as unknown as { addEventListener: AddEventListener };
      const originalProtoAdd = proto.addEventListener;
      proto.addEventListener = function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) {
        let patchedOptions = options;
        if (needsPassive.has(type)) {
          if (patchedOptions == null) patchedOptions = { passive: true };
          else if (typeof patchedOptions === 'boolean')
            patchedOptions = { capture: patchedOptions, passive: true };
          else patchedOptions = { ...patchedOptions, passive: true };
        }
        return originalProtoAdd.call(this, type, listener, patchedOptions);
      } as AddEventListener;
      try {
        renderer = new Sigma(fullGraph, container, {
          renderEdgeLabels: false,
          renderLabels: false, // Disable Sigma labels; we draw our own HTML overlay labels
          allowInvalidContainer: true,
          labelColor: { color: 'gray' }
        });
      } finally {
        (
          EventTarget.prototype as unknown as { addEventListener: AddEventListener }
        ).addEventListener = originalProtoAdd;
      }

      // Note: We handle clicks/taps ourselves below with passive listeners.

      // restore camera if we had one
      if (renderer && cameraState) {
        const cam = renderer.getCamera();
        cam.setState({ ...cameraState });
      }

      // Lock camera zoom level to disable pinch/scroll zoom regardless of input source
      if (renderer) {
        const cam = renderer.getCamera();
        const lockedRatio = cameraState?.ratio ?? cam.ratio;
        // Clamp zoom by setting min/max to the same value
        renderer.setSetting('minCameraRatio', lockedRatio);
        renderer.setSetting('maxCameraRatio', lockedRatio);
      }
      // Keep overlay labels in sync with canvas drawing
      renderer?.on('afterRender', updateLabels);
    }

    // Apply current visibility & colors without touching positions
    applyVisibility(layout);
    // Update labels once after applying visibility
    updateLabels();
  }

  onMount(() => {
    render();
  });

  $: render(layout, currentNodeId, consumedNodeIds, startNodeId);

  onDestroy(() => {
    // Detach listeners and dispose
    renderer?.off('afterRender', updateLabels);
    renderer?.kill();
  });
</script>

<div class="relative w-full h-64 rounded bg-gray-800 touch-manipulation">
  <!-- Sigma mounts canvases in this container (pointer events disabled to prevent drag/pan) -->
  <div bind:this={container} class="absolute inset-0 pointer-events-none"></div>
  <!-- Interaction layer above canvas: handles click/tap/keyboard with passive listeners -->
  <div
    class="absolute inset-0"
    role="button"
    tabindex="0"
    on:click|passive={(e) => {
      const rect = container.getBoundingClientRect();
      selectNodeAtViewportPoint(e.clientX - rect.left, e.clientY - rect.top);
    }}
    on:touchstart|passive={(e) => {
      if (e.touches && e.touches.length > 0) {
        const t = e.touches[0];
        const rect = container.getBoundingClientRect();
        selectNodeAtViewportPoint(t.clientX - rect.left, t.clientY - rect.top);
      }
    }}
    on:keydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const rect = container.getBoundingClientRect();
        // select nearest node around the center when using keyboard
        selectNodeAtViewportPoint(rect.width / 2, rect.height / 2);
      }
    }}
  ></div>
  <!-- HTML overlay labels (always visible, pointer-events disabled so clicks go to canvas) -->
  <div class="pointer-events-none absolute inset-0">
    {#each labels as l (l.id)}
      <div
        class="absolute -translate-x-1/2"
        style={`left:${l.x}px;top:${l.y}px;transform: translate(50%, -50%);`}
      >
        <span
          class="px-1 py-0.5 rounded bg-gray-900/60 text-gray-100 text-[10px] leading-none whitespace-nowrap shadow"
        >
          {l.text}
        </span>
      </div>
    {/each}
  </div>
</div>
