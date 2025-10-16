export const NODE_TYPES = [
  'normal',
  'elite',
  'reward',
  'rest',
  'progress',
  'boss',
  'event',
  'start'
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface FloorNode {
  id: number;
  kind: NodeType;
  // normal / elite の戦闘区別 (kind===normal|elite の時のみ有効)
  encounterKind?: 'normal' | 'elite' | 'boss';
}

/** Undirected edge between two nodes (no self-loop, no multi-edge) */
export interface FloorEdge {
  source: number; // node id
  target: number; // node id
}

/**
 * Degree constraints for each node. Keep them here as constants for reuse in services.
 * Note: These are inclusive bounds.
 */
export const MIN_EDGES_PER_NODE = 1 as const;
export const MAX_EDGES_PER_NODE = 4 as const;

export interface FloorLayout {
  floorIndex: number; // 1-based
  /** All nodes existing in this floor */
  nodes: FloorNode[];
  /** Undirected edges among nodes */
  edges: FloorEdge[];
  /** Starting node id where player spawns on this floor */
  startNodeId: number;
}
