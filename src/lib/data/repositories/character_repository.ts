import charactersCsvRaw from '$lib/data/consts/characters.csv?raw';
import { ACTOR_KINDS } from '$lib/domain/entities/character';
import type { ActorKind, Attribute, Player, Enemy } from '$lib/domain/entities/character';
import type { Action } from '$lib/domain/entities/action';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';

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

const allRows: RowCommon[] = parseCsv(charactersCsvRaw)
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
    id: row.id,
    side: 'player',
    kind: row.kind,
    name: row.name,
    characterAttributes: {
      STR: row.STR,
      CON: row.CON,
      POW: row.POW,
      DEX: row.DEX,
      APP: row.APP,
      INT: row.INT,
      maxActionsPerTurn: row.maxActionsPerTurn
    },
    hp: 0,
    statuses: [],
    baseAttributes: {
      id: row.id,
      name: row.name,
      characterAttributes: {
        STR: row.STR,
        CON: row.CON,
        POW: row.POW,
        DEX: row.DEX,
        APP: row.APP,
        INT: row.INT,
        maxActionsPerTurn: row.maxActionsPerTurn
      },
      actions: [...row.actions]
    },
    heldMineralIds: [],
    physDamageCutRate: 0,
    psyDamageCutRate: 0,
    physDamageUpRate: 0,
    psyDamageUpRate: 0,
    // row.actions は再起動間で共有されるためコピーして破壊的変更の伝播を防ぐ
    actions: [...row.actions],
    maxActionChoices: row.maxActionChoices
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
    return min <= floorIndex && floorIndex <= max;
  };
  return enemyRows.find((r) => r.kind === kind && inFloor(r));
}

export function buildEnemyFromCsv(kind: 'normal' | 'elite' | 'boss', floorIndex: number): Enemy {
  const row = pickEnemyRow(kind, floorIndex) || enemyRows.find((r) => r.kind === kind)!;
  const enemy: Enemy = {
    id: row.id,
    side: 'enemy',
    kind: row.kind,
    name: row.name,
    characterAttributes: {
      STR: row.STR,
      CON: row.CON,
      POW: row.POW,
      DEX: row.DEX,
      APP: row.APP,
      INT: row.INT,
      maxActionsPerTurn: row.maxActionsPerTurn
    },
    hp: 0,
    statuses: [],
    baseAttributes: {
      id: row.id,
      name: row.name,
      characterAttributes: {
        STR: row.STR,
        CON: row.CON,
        POW: row.POW,
        DEX: row.DEX,
        APP: row.APP,
        INT: row.INT,
        maxActionsPerTurn: row.maxActionsPerTurn
      },
      actions: [...row.actions]
    },
    heldMineralIds: [],
    physDamageCutRate: 0,
    psyDamageCutRate: 0,
    physDamageUpRate: 0,
    psyDamageUpRate: 0,
    actions: [...row.actions],
    revealedAttributes: row.revealed.map((k) => k as Attribute) as Attribute[],
    isExposed: false
  };
  return enemy;
}
