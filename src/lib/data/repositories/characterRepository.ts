import charactersCsvRaw from '$lib/data/consts/characters.csv?raw';
import { ACTOR_KINDS } from '$lib/domain/entities/Character';
import type { ActorKind, Actor, Player } from '$lib/domain/entities/Character';
import type { Action } from '$lib/domain/entities/Action';

interface RowCommon {
  id: string;
  kind: ActorKind;
  name: string;
  floorMin?: number;
  floorMax?: number;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  actions: Action[];
  maxActionsPerTurn: number;
  maxActionChoices: number;
  revealed: string[];
}

function parse(csvRaw: string): string[][] {
  return csvRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => line.split(',').map((s) => s.trim()));
}

const allRows: RowCommon[] = parse(charactersCsvRaw)
  .slice(1)
  .map((cols) => {
    const [
      id,
      rawKind,
      name,
      floorMin,
      floorMax,
      STR,
      CON,
      POW,
      DEX,
      APP,
      INT,
      acts,
      maxActionsPerTurn,
      maxActionChoices,
      revealed
    ] = cols;
    if (!ACTOR_KINDS.includes(rawKind as ActorKind)) {
      throw new Error(`Invalid kind value in characters.csv: ${rawKind}`);
    }
    const kind = rawKind as ActorKind;
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
      actions: acts.split('|') as Action[],
      maxActionsPerTurn: Number(maxActionsPerTurn),
      maxActionChoices: Number(maxActionChoices),
      revealed: revealed.split('|')
    };
  });

const playerRow = allRows.find((r) => r.kind === 'player');
const enemyRows = allRows.filter(
  (r) => r.kind === 'normal' || r.kind === 'elite' || r.kind === 'boss'
);

export function buildPlayerFromCsv(): Player {
  if (!playerRow) throw new Error('player row not found in characters.csv');
  const row = playerRow;
  const base: Player = {
    side: 'player',
    kind: row.kind,
    name: row.name,
    STR: row.STR,
    CON: row.CON,
    POW: row.POW,
    DEX: row.DEX,
    APP: row.APP,
    INT: row.INT,
    hp: 0,
    statuses: [],
    physDamageCutRate: 0,
    psyDamageCutRate: 0,
    physDamageUpRate: 0,
    psyDamageUpRate: 0,
    // row.actions は再起動間で共有されるためコピーして破壊的変更の伝播を防ぐ
    actions: [...row.actions],
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

export function pickEnemyRow(kind: 'normal' | 'elite' | 'boss', floorIndex: number) {
  /**
   * 指定階層に出現可能かを判定する。CSV で floorMin / floorMax が空の場合は無制限扱い。
   *
   * floorMin, floorMax は CSV 上で未入力の場合 undefined 扱いとなるため、
   * TypeScript の strictNullChecks 下で比較可能なようにフォールバックする。
   */
  const inFloor = (r: RowCommon) => {
    const min = r.floorMin ?? Number.NEGATIVE_INFINITY;
    const max = r.floorMax ?? Number.POSITIVE_INFINITY;
    return floorIndex >= min && floorIndex <= max;
  };
  return enemyRows.find((r) => r.kind === kind && inFloor(r));
}

export function buildEnemyFromCsv(kind: 'normal' | 'elite' | 'boss', floorIndex: number): Actor {
  const row = pickEnemyRow(kind, floorIndex) || enemyRows.find((r) => r.kind === kind)!;
  const enemy: Actor = {
    side: 'enemy',
    kind: row.kind,
    name: row.name,
    STR: row.STR,
    CON: row.CON,
    POW: row.POW,
    DEX: row.DEX,
    APP: row.APP,
    INT: row.INT,
    hp: 0,
    statuses: [],
    physDamageCutRate: 0,
    psyDamageCutRate: 0,
    physDamageUpRate: 0,
    psyDamageUpRate: 0,
    actions: [...row.actions],
    revealed: Object.fromEntries(row.revealed.map((k) => [k as string, true])) as Record<
      string,
      boolean
    >,
    maxActionsPerTurn: row.maxActionsPerTurn,
    maxActionChoices: row.maxActionChoices
  };
  return enemy;
}
