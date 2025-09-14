import type { GameState } from './battleState';

export interface EventDef {
  id: string;
  name: string;
  description: string;
  apply(state: GameState): void;
}
