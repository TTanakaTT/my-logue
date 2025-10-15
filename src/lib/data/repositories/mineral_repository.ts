import mineralsCsvRaw from '$lib/data/consts/minerals.csv?raw';
import mineralsDetailCsvRaw from '$lib/data/consts/mineral_detail.csv?raw';
import type { Mineral, MineralRarity } from '$lib/domain/entities/mineral';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';
import { isActionId } from '$lib/domain/entities/action';

interface RawRowMineral {
  nameEn: string;
  nameJa: string;
  nameKana?: string;
  category: string;
  rarity: number;
  disabled: boolean;
}

interface RawRowDetail {
  mineralNameEn: string; // minerals.csv の mineralName_en と対応
  attribute: string; // STR/CON/... or action
  value: string; // 数値 or Action名
}

const mineralRows: RawRowMineral[] = parseCsv(mineralsCsvRaw)
  .slice(1)
  .map((cols) => {
    const [nameEn, nameJa, nameKana, category, rarityStr, disabledStr] = cols;
    const rarity = Number(rarityStr);
    const disabled = disabledStr.toLowerCase() === 'true' || disabledStr === '1';
    return { nameEn, nameJa, nameKana, category, rarity, disabled } as RawRowMineral;
  })
  .filter((r) => !r.disabled);

const detailRows: RawRowDetail[] = (() => {
  const parsed = parseCsv(mineralsDetailCsvRaw);
  const header = parsed[0];
  const body = parsed.slice(1);
  const idxName = header.indexOf('mineralName');
  const idxAttr = header.indexOf('attribute');
  const idxVal = header.indexOf('value');
  return body
    .map((cols) => ({
      mineralNameEn: cols[idxName] || '',
      attribute: cols[idxAttr] || '',
      value: cols[idxVal] || ''
    }))
    .filter((r) => r.mineralNameEn);
})();

function clampRarity(value: number): MineralRarity {
  // Clamp to 1..5; treat non-finite values (NaN/Infinity) as 1
  return Math.max(1, Math.min(5, Number.isFinite(value) ? value : 1)) as MineralRarity;
}

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

// mineralName_en -> details の索引
const detailsByEnName: Record<string, RawRowDetail[]> = detailRows.reduce(
  (acc, row) => {
    const key = row.mineralNameEn.trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  },
  {} as Record<string, RawRowDetail[]>
);

const all: Mineral[] = mineralRows.map((r) => {
  const id = r.nameEn;
  const mineral: Mineral = {
    id,
    nameJa: r.nameJa,
    nameEn: r.nameEn,
    rarity: clampRarity(r.rarity),
    STR: 0,
    CON: 0,
    POW: 0,
    DEX: 0,
    APP: 0,
    INT: 0,
    maxActionsPerTurn: 0,
    maxActionChoices: 0,
    grantedActions: []
  };

  const details = detailsByEnName[r.nameEn || ''] || [];
  for (const d of details) {
    if (d.attribute === 'action') {
      const key = d.value?.trim();
      if (isActionId(key)) {
        mineral.grantedActions.push(key);
      }
    } else if (isMineralAttributeKey(d.attribute)) {
      const scalar = Number(d.value);
      if (Number.isFinite(scalar)) {
        mineral[d.attribute] = scalar;
      }
    }
  }
  return mineral;
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
