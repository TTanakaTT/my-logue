import floorStructureCsvRaw from '$lib/data/consts/floor_structure.csv?raw';
import {
  NODE_TYPES,
  type FloorLayout,
  type FloorNode,
  type FloorStep,
  type NodeType
} from '$lib/domain/entities/floor';
import floorNodeRulesCsvRaw from '$lib/data/consts/floor_node_rules.csv?raw';
import { shuffle } from '$lib/utils/array_util';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';

interface StructureRow {
  floorIndex: number;
  totalNodes: number; // この階層全体で生成するノード総数 (boss 含む)
  minSteps: number; // ステップ数下限
  maxSteps: number; // ステップ数上限
  progressMinStep: number; // progress ノードが現れ始める最小 step
}

interface NodeRuleRow {
  floorIndex: number;
  nodeType: NodeType;
  weight: number; // 抽選重み (0 なら weighted 抽選対象外)
  minCount: number; // 先行確保数
  maxCount?: number; // 上限 (undefined は制限なし)
}

const structureRows: StructureRow[] = parseCsv(floorStructureCsvRaw)
  .slice(1)
  .map((cols) => {
    const [floorIndexStr, totalNodesStr, minStepsStr, maxStepsStr, progressMinStepStr] = cols;
    const floorIndex = Number(floorIndexStr);
    const totalNodes = Number(totalNodesStr);
    const minSteps = Number(minStepsStr);
    const maxSteps = Number(maxStepsStr);
    const progressMinStep = Number(progressMinStepStr);
    if (
      [floorIndex, totalNodes, minSteps, maxSteps, progressMinStep].some((n) => Number.isNaN(n))
    ) {
      throw new Error(`floor_structure.csv invalid numeric value: ${cols.join(',')}`);
    }
    if (minSteps <= 0 || maxSteps < minSteps) {
      throw new Error(`floor_structure.csv invalid step bounds: ${cols.join(',')}`);
    }
    return { floorIndex, totalNodes, minSteps, maxSteps, progressMinStep };
  });

export function getFloorStructure(floorIndex: number): StructureRow | undefined {
  return structureRows.find((r) => r.floorIndex === floorIndex);
}

// ルール CSV 解析
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
  return nodeRuleRows.filter((r) => r.floorIndex === floorIndex);
}

// 新アルゴリズムによる FloorLayout 生成
// 1. stepsCount を [minSteps,maxSteps] の範囲でランダム決定
// 2. 候補集合から totalNodes になるまでノードをランダム抽出
// 3. boss がある場合は最終ステップに配置 (他ノードと同居可能)
// 4. progress ノードは progressMinStep 未満の step へは割り当てない
// 5. 残りノードをステップへラウンドロビン or ランダム分配
export function generateFloorLayout(floorIndex: number): FloorLayout {
  const structure = getFloorStructure(floorIndex);
  if (!structure) throw new Error(`floor_structure not found for floor ${floorIndex}`);

  const stepCount = randomInt(structure.minSteps, structure.maxSteps);

  const pickedKinds: NodeType[] = buildPickedKindsByRules(floorIndex, structure.totalNodes);

  // ノード一覧をシャッフル
  return {
    floorIndex,
    steps: shuffleNodes(pickedKinds, stepCount, structure.progressMinStep)
  };
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
    // ルール未定義フォールバック: 旧方式 (progress + boss + ランダム)
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

  // 1. minCount 先行確保
  const picked: NodeType[] = [];
  const counts: Record<NodeType, number> = {
    normal: 0,
    elite: 0,
    reward: 0,
    rest: 0,
    progress: 0,
    boss: 0,
    event: 0
  };
  for (const r of rules) {
    for (let i = 0; i < r.minCount && picked.length < totalNodes; i++) {
      picked.push(r.nodeType);
      counts[r.nodeType]++;
    }
  }
  if (picked.length >= totalNodes) return picked.slice(0, totalNodes);

  // 抽選ヘルパ
  function currentCandidates(): NodeRuleRow[] {
    return rules.filter((r) => {
      const c = counts[r.nodeType];
      if (r.maxCount !== undefined && c >= r.maxCount) return false;
      // weight 0 でも minCount で確保済みならもう抽選不要。抽選対象から除外。
      return r.weight > 0;
    });
  }

  // 2-5. 重み抽選ループ
  while (picked.length < totalNodes) {
    const cand = currentCandidates();
    if (cand.length === 0) break; // これ以上増やせない
    // 総重み
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
    // maxCount を越えたら候補再抽出 (5.) → while 継続
  }

  // totalNodes 超過防御
  if (picked.length > totalNodes) return picked.slice(0, totalNodes);
  return picked;
}

function randomInt(min: number, max: number): number {
  if (min === max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleNodes(
  nodes: NodeType[],
  stepCount: number,
  progressMinStepCount: number
): FloorStep[] {
  let _stepCount = stepCount;
  let progressStepCount = randomInt(progressMinStepCount, stepCount);
  const spliceIndicesTmp: number[] = [];
  const MAX_SPLICE_RETRIES = 10;
  for (let i = 0; i < _stepCount - 1; i++) {
    let spliceIndexTmp = randomInt(1, nodes.length - 1);
    let retryCnt = 0;
    while (spliceIndicesTmp.includes(spliceIndexTmp)) {
      if (retryCnt > MAX_SPLICE_RETRIES) {
        // スライス位置の重複が解消できない場合、ステップ数を減らす
        _stepCount--;
        progressStepCount--;
        break;
      }
      if (spliceIndexTmp < nodes.length / 2) {
        spliceIndexTmp = randomInt(spliceIndexTmp + 1, nodes.length - 1);
      } else {
        spliceIndexTmp = randomInt(1, spliceIndexTmp - 1);
      }
      retryCnt++;
    }
    spliceIndicesTmp.push(spliceIndexTmp);
  }
  const spliceIndices = spliceIndicesTmp.sort((a, b) => a - b);
  const shuffledNodes = shuffle(nodes);

  const steps: Array<Array<NodeType>> = [];
  let startIdx = 0;
  let floorNodes: NodeType[] = [];
  for (let i = 0; i < spliceIndices.length; i++) {
    floorNodes = [];
    const spliceIndex = spliceIndices[i];
    for (let j = startIdx; j < spliceIndex; j++) {
      floorNodes.push(shuffledNodes[j]);
    }
    steps.push(floorNodes);
    startIdx = spliceIndex;
  }
  // 残りノードを最後のstepへ追加
  floorNodes = [];
  for (let j = startIdx; j < shuffledNodes.length; j++) {
    floorNodes.push(shuffledNodes[j]);
  }
  steps.push(floorNodes);

  // progressノードが含まれるstepをprogressStepCount番目のstepと交換する
  const progressIndex = steps
    .map((step, i) => (step.includes('progress') ? i : -1))
    .filter((i) => i >= 0)[0];
  if (progressIndex !== progressStepCount - 1) {
    const indexFrom = progressIndex;
    const indexTo = progressStepCount - 1;
    const stepFrom = steps[indexFrom];
    const stepTo = steps[indexTo];
    steps.splice(indexTo, 1, stepFrom);
    steps.splice(indexFrom, 1, stepTo);
  }

  let nodeId = 1;
  const result: FloorStep[] = steps.map((nodes, i) => ({
    stepIndex: i + 1,
    nodes: nodes.map((k) => {
      const r = makeFloorNode(nodeId, k);
      nodeId++;
      return r;
    })
  }));
  return result;
}
