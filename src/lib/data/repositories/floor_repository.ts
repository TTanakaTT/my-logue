import floorStructureCsvRaw from '$lib/data/consts/floor_structure.csv?raw';
import {
  NODE_TYPES,
  type FloorLayout,
  type FloorNode,
  type NodeType,
  MIN_EDGES_PER_NODE,
  MAX_EDGES_PER_NODE
} from '$lib/domain/entities/floor';
import floorNodeRulesCsvRaw from '$lib/data/consts/floor_node_rules.csv?raw';
import { shuffle } from '$lib/utils/array_util';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';

interface StructureRow {
  floorIndex: number;
  totalNodes: number;
  progressMinPath: number; // minimum shortest-path edges from start to any progress node
}

interface NodeRuleRow {
  floorIndex: number;
  nodeType: NodeType;
  weight: number;
  minCount: number;
  maxCount?: number;
}

const structureRows: StructureRow[] = parseCsv(floorStructureCsvRaw)
  .slice(1)
  .map((cols) => {
    const [floorIndexStr, totalNodesStr, progressMinPathStr] = cols;
    const floorIndex = Number(floorIndexStr);
    const totalNodes = Number(totalNodesStr);
    const progressMinPath = Number(progressMinPathStr);
    if ([floorIndex, totalNodes, progressMinPath].some((n) => Number.isNaN(n))) {
      throw new Error(`floor_structure.csv invalid numeric value: ${cols.join(',')}`);
    }
    if (progressMinPath < 0) {
      throw new Error(`floor_structure.csv invalid progressMinPath: ${cols.join(',')}`);
    }
    return { floorIndex, totalNodes, progressMinPath };
  });

export function getFloorStructure(floorIndex: number): StructureRow | undefined {
  return structureRows.find((r) => r.floorIndex === floorIndex);
}

const nodeRuleRows: NodeRuleRow[] = parseCsv(floorNodeRulesCsvRaw)
  .slice(1)
  .map((cols) => {
    const [floorIndexStr, nodeTypeStr, weightStr, minCountStr, maxCountStr] = cols;
    const floorIndex = Number(floorIndexStr);
    const nodeType = nodeTypeStr as NodeType;
    const weight = Number(weightStr || '0');
    const minCount = Number(minCountStr || '0');
    const maxCount = maxCountStr ? Number(maxCountStr) : undefined;
    if (Number.isNaN(floorIndex) || !NODE_TYPES.includes(nodeType)) {
      throw new Error(`floor_node_rules.csv invalid row: ${cols.join(',')}`);
    }
    if ([weight, minCount].some((n) => Number.isNaN(n))) {
      throw new Error(`floor_node_rules.csv invalid numeric: ${cols.join(',')}`);
    }
    if (maxCountStr && Number.isNaN(maxCount)) {
      throw new Error(`floor_node_rules.csv invalid maxCount: ${cols.join(',')}`);
    }
    return { floorIndex, nodeType, weight, minCount, maxCount } as NodeRuleRow;
  });

function getNodeRules(floorIndex: number): NodeRuleRow[] {
  return nodeRuleRows.filter((r) => r.floorIndex === floorIndex && r.nodeType !== 'start');
}

export function generateFloorLayout(floorIndex: number): FloorLayout {
  const structure = getFloorStructure(floorIndex);
  if (!structure) throw new Error(`floor_structure not found for floor ${floorIndex}`);

  const pickedKinds: NodeType[] = buildPickedKindsByRules(floorIndex, structure.totalNodes);

  const nodes: FloorNode[] = pickedKinds.map((k, i) => makeFloorNode(i + 1, k));

  const startNodeId = nodes.length + 1;
  nodes.push(makeFloorNode(startNodeId, 'start'));

  const startId = startNodeId;
  let edges = generateEdges(nodes.length, floorIndex);
  let safety = 0;
  const maxRetry = 50;
  while (safety++ < maxRetry) {
    const ok = satisfiesMinDistance(nodes, edges, startId, structure.progressMinPath);
    if (ok) break;
    edges = generateEdges(nodes.length, floorIndex);
  }

  return { floorIndex, nodes, edges, startNodeId: startId };
}

function makeFloorNode(id: number, node: NodeType): FloorNode {
  return {
    id,
    kind: node,
    encounterKind:
      node === 'elite'
        ? 'elite'
        : node === 'normal'
          ? 'normal'
          : node === 'boss'
            ? 'boss'
            : undefined
  };
}

function buildPickedKindsByRules(floorIndex: number, totalNodes: number): NodeType[] {
  const rules = getNodeRules(floorIndex);
  if (rules.length === 0) {
    const fallbackBase = NODE_TYPES.slice();
    const out: NodeType[] = ['progress', 'boss'];
    while (out.length < totalNodes) {
      const k = fallbackBase[Math.floor(Math.random() * fallbackBase.length)] as NodeType;
      if ((k === 'progress' && out.includes('progress')) || (k === 'boss' && out.includes('boss')))
        continue;
      out.push(k);
    }
    return out;
  }

  const picked: NodeType[] = [];
  const counts: Record<NodeType, number> = {
    normal: 0,
    elite: 0,
    reward: 0,
    rest: 0,
    progress: 0,
    boss: 0,
    event: 0,
    start: 0
  };
  for (const r of rules) {
    for (let i = 0; i < r.minCount && picked.length < totalNodes; i++) {
      picked.push(r.nodeType);
      counts[r.nodeType]++;
    }
  }
  if (picked.length >= totalNodes) return picked.slice(0, totalNodes);

  function currentCandidates(): NodeRuleRow[] {
    return rules.filter((r) => {
      const c = counts[r.nodeType];
      if (r.maxCount !== undefined && c >= r.maxCount) return false;

      return r.weight > 0;
    });
  }

  while (picked.length < totalNodes) {
    const cand = currentCandidates();
    if (cand.length === 0) break;

    const totalWeight = cand.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight <= 0) break;
    let roll = Math.random() * totalWeight;
    let chosen: NodeRuleRow | undefined;
    for (const r of cand) {
      if (roll < r.weight) {
        chosen = r;
        break;
      }
      roll -= r.weight;
    }
    if (!chosen) chosen = cand[cand.length - 1];
    picked.push(chosen.nodeType);
    counts[chosen.nodeType]++;
  }

  if (picked.length > totalNodes) return picked.slice(0, totalNodes);
  return picked;
}

/**
 * Compute the target average degree (number of edges per node) for a given floor.
 *
 * This produces a steadily increasing target average degree for higher floors,
 * with explicit lower/upper bounds provided by MIN_EDGES_PER_NODE and
 * MAX_EDGES_PER_NODE * 0.8 respectively.
 *
 * @param floorIndex - Index of the floor for which to compute the target average degree.
 *                     Values <= 1 will receive no incremental increase above the base.
 * @returns The target average degree for nodes on the specified floor, constrained
 *          to the configured minimum and capped at 80% of the configured maximum.
 */
function targetAvgDegreeForFloor(floorIndex: number): number {
  const base = 1.8;
  const inc = 0.2 * Math.max(0, floorIndex - 1);
  const cap = Math.min(MAX_EDGES_PER_NODE * 0.8, base + inc);
  return Math.max(MIN_EDGES_PER_NODE, cap);
}

/**
 * Number of edge-addition attempts performed per node when densifying the graph.
 */
const EDGE_ADDITION_ATTEMPTS_PER_NODE = 8;

function generateEdges(nodeCount: number, floorIndex: number) {
  const adj: Map<number, Set<number>> = new Map();
  for (let i = 1; i <= nodeCount; i++) adj.set(i, new Set());

  const canAdd = (a: number, b: number) => {
    if (a === b) return false;
    const A = adj.get(a)!;
    const B = adj.get(b)!;
    if (A.has(b)) return false;
    if (A.size >= MAX_EDGES_PER_NODE || B.size >= MAX_EDGES_PER_NODE) return false;
    return true;
  };

  const connect = (a: number, b: number) => {
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  const order = Array.from({ length: nodeCount }, (_, i) => i + 1);
  shuffle(order);
  const connected: number[] = [];
  for (const id of order) {
    if (connected.length === 0) {
      connected.push(id);
      continue;
    }

    const candidates = connected.filter((c) => (adj.get(c)?.size || 0) < MAX_EDGES_PER_NODE);

    if (candidates.length === 0) {
      const sorted = connected.slice().sort((a, b) => adj.get(a)!.size - adj.get(b)!.size);
      for (const c of sorted) {
        if (canAdd(id, c)) {
          connect(id, c);
          break;
        }
      }
    } else {
      const shuffled = shuffle(candidates);
      let linked = false;
      for (const c of shuffled) {
        if (canAdd(id, c)) {
          connect(id, c);
          linked = true;
          break;
        }
      }
      if (!linked) {
        const sorted = connected.slice().sort((a, b) => adj.get(a)!.size - adj.get(b)!.size);
        for (const c of sorted) {
          if (canAdd(id, c)) {
            connect(id, c);
            break;
          }
        }
      }
    }
    connected.push(id);
  }

  if (MIN_EDGES_PER_NODE > 1) {
    for (let id = 1; id <= nodeCount; id++) {
      while (adj.get(id)!.size < MIN_EDGES_PER_NODE) {
        const pool = shuffle(
          Array.from({ length: nodeCount }, (_, i) => i + 1).filter((x) => x !== id)
        );
        let done = false;
        for (const p of pool) {
          if (canAdd(id, p)) {
            connect(id, p);
            done = true;
            break;
          }
        }
        if (!done) break;
      }
    }
  }

  const targetAvg = targetAvgDegreeForFloor(floorIndex);
  const currentEdges = () => Array.from(adj.values()).reduce((sum, s) => sum + s.size, 0) / 2;
  let attempts = 0;
  const maxAttempts = nodeCount * EDGE_ADDITION_ATTEMPTS_PER_NODE;
  while (attempts < maxAttempts) {
    attempts++;
    const a = 1 + Math.floor(Math.random() * nodeCount);
    const b = 1 + Math.floor(Math.random() * nodeCount);
    if (canAdd(a, b)) connect(a, b);
    const avgDeg = (currentEdges() * 2) / nodeCount;
    if (avgDeg >= targetAvg) break;
  }

  const edges: { source: number; target: number }[] = [];
  for (let i = 1; i <= nodeCount; i++) {
    for (const j of adj.get(i)!) {
      if (i < j) edges.push({ source: i, target: j });
    }
  }
  return edges;
}

function satisfiesMinDistance(
  nodes: FloorNode[],
  edges: { source: number; target: number }[],
  startId: number,
  minRequiredEdges: number
): boolean {
  const progressIds = nodes.filter((n) => n.kind === 'progress').map((n) => n.id);
  if (progressIds.length === 0) return true;
  const minReq = minRequiredEdges;
  const adj: Map<number, number[]> = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  const dist = shortestPathBFS(adj, startId);
  let best = Infinity;
  for (const pid of progressIds) best = Math.min(best, dist.get(pid) ?? Infinity);
  return best >= minReq;
}

/**
 * Compute shortest-path distances (in number of edges) from a start node to every reachable node
 * in a graph using breadth-first search (BFS).
 *
 * The graph is represented as an adjacency map where each key is a node id (number) and the value
 * is an array of neighbor node ids. The function treats edges as directed according to the
 * adjacency map; for undirected graphs, adjacent entries should be present in both directions.
 *
 * @param adj - A Map<number, number[]> representing the adjacency list of the graph.
 *              Each key is a node id and the corresponding value is an array of neighbor ids.
 * @param start - The id of the start node from which distances are measured.
 *
 * @returns A Map<number, number> that maps each reachable node id to its distance from `start`
 *          (the number of edges in the shortest path). The `start` node maps to 0. Nodes that
 *          are not reachable from `start` will not appear in the returned map.
 */
function shortestPathBFS(adj: Map<number, number[]>, start: number): Map<number, number> {
  const dist = new Map<number, number>();
  const q: number[] = [start];
  dist.set(start, 0);
  for (let qi = 0; qi < q.length; qi++) {
    const v = q[qi];
    const dv = dist.get(v)!;
    for (const nx of adj.get(v) || []) {
      if (!dist.has(nx)) {
        dist.set(nx, dv + 1);
        q.push(nx);
      }
    }
  }
  return dist;
}
