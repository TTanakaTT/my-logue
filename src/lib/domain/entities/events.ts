import type { GameState } from './battleState';

export interface EventDef {
  name: string;
  description: string;
  apply(state: GameState): void;
}
