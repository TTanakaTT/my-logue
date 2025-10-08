import mineralsCsvRaw from '$lib/data/consts/minerals.csv?raw';
import mineralDict from '$lib/data/consts/mineral-dict.json';
import type { Mineral } from '$lib/domain/entities/mineral';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';

interface RawRow {
  nameJa: string;
  nameKana?: string;
  nameEn?: string;
  category?: string;
  rarity: number;
  attribute: string;
  value: number;
}

function toId(nameJa: string, nameEn?: string): string {
  const idFromDict = (mineralDict as Record<string, string>)[nameJa?.trim?.()] || nameEn;
  return (idFromDict || nameJa || 'mineral').replace(/\s+/g, '_');
}

const rows: RawRow[] = parseCsv(mineralsCsvRaw)
  .slice(1)
  .map((cols) => {
    const [nameJa, nameKana, nameEn, category, rarityStr, attribute, valueStr] = cols;
    const rarity = Number(rarityStr);
    const value = Number(valueStr);
    return { nameJa, nameKana, nameEn, category, rarity, attribute, value } as RawRow;
  });

const ATTRIBUTES_KEYS = [
  'STR',
  'CON',
  'POW',
  'DEX',
  'APP',
  'INT',
  'maxActionsPerTurn',
  'maxActionChoices'
] as const;

type MineralAttributeKey = (typeof ATTRIBUTES_KEYS)[number];
function isMineralAttributeKey(k: string): k is MineralAttributeKey {
  return (ATTRIBUTES_KEYS as readonly string[]).includes(k);
}

const all: Mineral[] = rows.map((r) => {
  const id = toId(r.nameJa, r.nameEn);
  const bonus: Mineral = {
    id,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    rarity: Math.max(1, Math.min(5, Number.isFinite(r.rarity) ? (r.rarity as number) : 1)) as
      | 1
      | 2
      | 3
      | 4
      | 5,
    STR: 0,
    CON: 0,
    POW: 0,
    DEX: 0,
    APP: 0,
    INT: 0,
    maxActionsPerTurn: 0,
    maxActionChoices: 0
  };

  const key = r.attribute || '';
  const scalar = Number.isFinite(r.value) ? r.value : 0;
  if (isMineralAttributeKey(key)) {
    bonus[key] = scalar;
  }
  return bonus;
});

export function listMinerals(): Mineral[] {
  return all.slice();
}

export function getMineral(id: string): Mineral | undefined {
  return all.find((m) => m.id === id);
}

export function listByRarity(rarity: number): Mineral[] {
  return all.filter((m) => m.rarity === rarity);
}
