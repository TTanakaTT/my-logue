import type { GameState } from './BattleState';

export interface EventDef {
  name: string;
  description: string;
  apply(state: GameState): void;
}
