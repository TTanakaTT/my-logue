import type { GameState } from './BattleState';
import type { Actor } from './Character';
import type { action } from '../../data/consts/actions';

export interface ActionDef {
  name: string;
  description: string;
  execute(ctx: { actor: Actor; target?: Actor }): void;
  allowInCombat?: boolean;
  cooldownTurns?: number;
  log?: (ctx: { actor: Actor; target?: Actor; state: GameState }) => string | undefined;
}

export type Action = keyof typeof action;
