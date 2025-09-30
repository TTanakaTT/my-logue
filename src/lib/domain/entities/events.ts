import type { GameState } from '$lib/domain/entities/battle_state';

export interface EventDef {
  name: string;
  description: string;
  apply(state: GameState): void;
}
