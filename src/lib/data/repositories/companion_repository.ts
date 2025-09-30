import type { CompanionSnapshot } from '$lib/domain/entities/companion';

const STORAGE_KEY = 'mylogue:companions';
const MAX_COMPANIONS = 3;

function safeParse(json: string | null): CompanionSnapshot[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr as CompanionSnapshot[];
  } catch {
    return [];
  }
}

export interface CompanionRepository {
  list(): CompanionSnapshot[];
  add(s: CompanionSnapshot): CompanionSnapshot[]; // 追加後の一覧
  remove(id: string): CompanionSnapshot[];
  clear(): void;
}

export function createCompanionRepository(): CompanionRepository {
  function read(): CompanionSnapshot[] {
    if (typeof localStorage === 'undefined') return [];
    return safeParse(localStorage.getItem(STORAGE_KEY));
  }
  function write(arr: CompanionSnapshot[]) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  return {
    list() {
      return read();
    },
    add(s: CompanionSnapshot) {
      const arr = read();
      arr.push(s);
      // 古い順 (id=timestamp) でソートしつつ末尾保持
      arr.sort((a, b) => a.id.localeCompare(b.id));
      while (arr.length > MAX_COMPANIONS) arr.shift();
      write(arr);
      return arr;
    },
    remove(id: string) {
      const arr = read().filter((a) => a.id !== id);
      write(arr);
      return arr;
    },
    clear() {
      write([]);
    }
  };
}
