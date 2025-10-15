// https://www.gsj.jp/Muse/hyohon/mineral/list.html
import mineralCsvRaw from '$lib/data/consts/minerals.csv?raw';
import { parseCsv } from '$lib/data/repositories/utils/csv_util';

interface MineralRow {
  nameJa: string; // mineralName_ja
  nameKatakana: string; // mineralName_katakana
  nameEn: string; // mineralName_en
  category: string; // category
  disabled: boolean; // enabled
}

const rows: MineralRow[] = (() => {
  const parsed = parseCsv(mineralCsvRaw);
  const header = parsed[0];
  const body = parsed.slice(1);
  const idxJa = header.indexOf('mineralName_ja');
  const idxKana = header.indexOf('mineralName_katakana');
  const idxEn = header.indexOf('mineralName_en');
  const idxCat = header.indexOf('category');
  const idxDisabled = header.indexOf('disabled');
  return body
    .map((cols) => ({
      nameJa: cols[idxJa] || '',
      nameKatakana: cols[idxKana] || '',
      nameEn: cols[idxEn] || '',
      category: cols[idxCat] || '',
      disabled: cols[idxDisabled].toLowerCase() === 'true' || cols[idxDisabled] === '1'
    }))
    .filter((r) => !r.disabled)
    .filter((r) => r.nameKatakana); // カタカナ列が空でないもののみ
})();

export function getAllRandomName(): string[] {
  return rows.map((r) => r.nameKatakana);
}

export function randomName(): string {
  const all = getAllRandomName();
  if (all.length === 0) return 'プレイヤー';
  return all[Math.floor(Math.random() * all.length)];
}
