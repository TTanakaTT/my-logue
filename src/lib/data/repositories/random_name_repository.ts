// https://www.gsj.jp/Muse/hyohon/mineral/list.html
import mineralCsvRaw from '$lib/data/consts/mineral.csv?raw';

/** mineral.csv からカタカナ列(mineralName_katakana) を抽出し配列化する。 */
function parse(csvRaw: string): string[][] {
  return csvRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => line.split(',').map((s) => s.trim()));
}

interface MineralRow {
  nameJa: string; // mineralName_ja
  nameKatakana: string; // mineralName_katakana
  nameEn: string; // mineralName_en
  category: string; // category
}

const rows: MineralRow[] = (() => {
  const parsed = parse(mineralCsvRaw);
  const header = parsed[0];
  const body = parsed.slice(1);
  const idxJa = header.indexOf('mineralName_ja');
  const idxKana = header.indexOf('mineralName_katakana');
  const idxEn = header.indexOf('mineralName_en');
  const idxCat = header.indexOf('category');
  return body
    .map((cols) => ({
      nameJa: cols[idxJa] || '',
      nameKatakana: cols[idxKana] || '',
      nameEn: cols[idxEn] || '',
      category: cols[idxCat] || ''
    }))
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
