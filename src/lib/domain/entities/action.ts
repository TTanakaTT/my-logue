import type { GameState } from './battleState';
import type { Actor } from './character';

export interface ActionDef {
  name: string;
  description: string;
  execute(state: GameState, ctx: { actor: Actor; target?: Actor }): void;
  allowInCombat?: boolean;
  cooldownTurns?: number;
  log?: (ctx: { actor: Actor; target?: Actor; state: GameState }) => string | undefined;
}
