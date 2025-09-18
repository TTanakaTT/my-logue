import type { EventDef } from '$lib/domain/entities/Events';
import { events } from '$lib/data/consts/events';

// イベント関連のサービスロジック
export function randomEvent(): EventDef {
  const list = Object.values(events);
  return list[Math.floor(Math.random() * list.length)];
}
