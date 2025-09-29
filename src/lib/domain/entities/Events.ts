import type { GameState } from '$lib/domain/entities/BattleState';

export interface EventDef {
  name: string;
  description: string;
  apply(state: GameState): void;
}
