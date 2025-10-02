// Floor / Node layout domain entities
// NodeType は進行に利用する種類 (combat系, reward, rest, progress, boss, event)
// combat は normal / elite を encounterKind で区別

export const NODE_TYPES = [
  'normal',
  'elite',
  'reward',
  'rest',
  'progress',
  'boss',
  'event'
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface FloorNode {
  id: number;
  kind: NodeType;
  // normal / elite の戦闘区別 (kind===normal|elite の時のみ有効)
  encounterKind?: 'normal' | 'elite' | 'boss';
}

export interface FloorStep {
  stepIndex: number; // 1-based
  nodes: FloorNode[]; // ユーザーが選択可能なノード群
}

export interface FloorLayout {
  floorIndex: number; // 1-based
  steps: FloorStep[]; // 配列長 = floor_structure.csv の steps
}
