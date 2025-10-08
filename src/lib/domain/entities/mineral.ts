export type MineralRarity = 1 | 2 | 3 | 4 | 5;

export interface Mineral {
  id: string;
  nameJa: string;
  nameEn?: string;
  rarity: MineralRarity;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  maxActionsPerTurn: number;
  maxActionChoices: number;
}

export function isMineral(v: unknown): v is Mineral {
  if (!v || typeof v !== 'object') return false;
  const m = v as Mineral;
  return typeof m.id === 'string' && typeof m.nameJa === 'string' && typeof m.rarity === 'number';
}
