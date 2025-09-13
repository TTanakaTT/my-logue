// CSV ロード & パース。Vite の ?raw import を利用する想定。
// シンプルな手書きパーサ (依存追加を避ける)。

import type { ActionId, Enemy, Player } from './types';
import charactersCsvRaw from '../data/characters.csv?raw';

interface RowCommon {
  id: string;
  kind: string;
  name: string;
  floorMin: number;
  floorMax: number;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  actions: ActionId[];
  maxActionsPerTurn: number;
  maxActionChoices: number;
  revealed: string[];
}

function parse(csvRaw: string): string[][] {
  return csvRaw
    .split(/\r?\n/) // 行
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      // CSV内にカンマを含むフィールドは今回想定しない
      return line.split(',').map((s) => s.trim());
    });
}

const allRows: RowCommon[] = parse(charactersCsvRaw)
  .slice(1) // 先頭ヘッダ行除外
  .map((cols) => {
    const [
      id,
      kind,
      name,
      floorMin,
      floorMax,
      STR,
      CON,
      POW,
      DEX,
      APP,
      INT,
      actions,
      maxActionsPerTurn,
      maxActionChoices,
      revealed
    ] = cols;
    return {
      id,
      kind,
      name,
      floorMin: Number(floorMin),
      floorMax: Number(floorMax),
      STR: Number(STR),
      CON: Number(CON),
      POW: Number(POW),
      DEX: Number(DEX),
      APP: Number(APP),
      INT: Number(INT),
      actions: actions.split('|') as ActionId[],
      maxActionsPerTurn: Number(maxActionsPerTurn),
      maxActionChoices: Number(maxActionChoices),
      revealed: revealed.split('|')
    };
  });

const playerRow = allRows.find((r) => r.kind === 'player');
const enemyRows = allRows.filter((r) => r.kind === 'normal' || r.kind === 'boss');

export function buildPlayerFromCsv(): Player {
  if (!playerRow) throw new Error('player row not found in characters.csv');
  const row = playerRow;
  const base: Player = {
    name: row.name,
    STR: row.STR,
    CON: row.CON,
    POW: row.POW,
    DEX: row.DEX,
    APP: row.APP,
    INT: row.INT,
    hp: 0, // 後で計算
    guard: false,
    dots: [],
    actions: row.actions,
    revealed: Object.fromEntries(row.revealed.map((k) => [k as string, true])) as Record<
      string,
      boolean
    >,
    maxActionsPerTurn: row.maxActionsPerTurn,
    maxActionChoices: row.maxActionChoices,
    score: 0
  };
  return base;
}

export function pickEnemyRow(kind: 'normal' | 'boss', floorIndex: number) {
  return enemyRows.find(
    (r) => r.kind === kind && floorIndex >= r.floorMin && floorIndex <= r.floorMax
  );
}

export function buildEnemyFromCsv(kind: 'normal' | 'boss', floorIndex: number): Enemy {
  const row = pickEnemyRow(kind, floorIndex) || enemyRows.find((r) => r.kind === kind)!; // フォールバック
  const enemy: Enemy = {
    kind,
    name: row.name,
    STR: row.STR,
    CON: row.CON,
    POW: row.POW,
    DEX: row.DEX,
    APP: row.APP,
    INT: row.INT,
    hp: 0,
    guard: false,
    dots: [],
    actions: row.actions,
    revealed: Object.fromEntries(row.revealed.map((k) => [k as string, true])) as Record<
      string,
      boolean
    >,
    maxActionsPerTurn: row.maxActionsPerTurn,
    maxActionChoices: row.maxActionChoices
  };
  return enemy;
}
