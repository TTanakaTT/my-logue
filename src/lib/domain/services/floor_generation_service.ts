import type { FloorLayout } from '$lib/domain/entities/floor';
import { generateFloorLayout } from '$lib/data/repositories/floor_repository';

// 乱数シード対応は将来拡張 (GameState.rngSeed を利用する設計余地)。
// 現状は Math.random ベースで毎回生成。

const cache = new Map<number, FloorLayout>();

export function getOrCreateFloorLayout(floorIndex: number): FloorLayout {
  if (cache.has(floorIndex)) return cache.get(floorIndex)!;
  const layout = generateFloorLayout(floorIndex);
  cache.set(floorIndex, layout);
  return layout;
}

export function invalidateFloorLayout(floorIndex: number) {
  cache.delete(floorIndex);
}

export function clearFloorLayoutCache() {
  cache.clear();
}
