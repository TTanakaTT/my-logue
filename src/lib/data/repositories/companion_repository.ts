import { APP_VERSION } from '$lib/config/version';
import type { Character } from '$lib/domain/entities/character';

const STORAGE_VERSION_PREFIX = `version_${APP_VERSION}`;
const STORAGE_KEY = `${STORAGE_VERSION_PREFIX}:companions`;
const MAX_COMPANIONS = 3;

function safeParse(json: string | null): Character[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr as Character[];
  } catch {
    return [];
  }
}

export interface CompanionRepository {
  list(): Character[];
  add(s: Character): Character[]; // 追加後の一覧
  remove(id: string): Character[];
  clear(): void;
}

export function createCompanionRepository(): CompanionRepository {
  function read(): Character[] {
    if (typeof localStorage === 'undefined') return [];
    return safeParse(localStorage.getItem(STORAGE_KEY));
  }
  function write(arr: Character[]) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  return {
    list() {
      return read();
    },
    add(s: Character) {
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
