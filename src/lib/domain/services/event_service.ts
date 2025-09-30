import type { EventDef } from '$lib/domain/entities/events';
import { events } from '$lib/data/consts/events';

export function randomEvent(): EventDef {
  const list = Object.values(events);
  return list[Math.floor(Math.random() * list.length)];
}
