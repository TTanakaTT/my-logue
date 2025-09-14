import { ActionId } from '$lib/data/consts/actionIds';

export type ActorKind = 'normal' | 'boss' | 'player';
export const ACTOR_KINDS: ActorKind[] = ['normal', 'boss', 'player'];
export type ActorSide = 'player' | 'enemy';

export interface BuffState {
  attackBonus?: number;
}

export interface DotEffect {
  id: string;
  damage: number;
  turns: number;
}

export interface Actor {
  kind: ActorKind;
  side: ActorSide;
  name: string;
  STR: number;
  CON: number;
  POW: number;
  DEX: number;
  APP: number;
  INT: number;
  hp: number;
  guard: boolean;
  dots: DotEffect[];
  buffs?: BuffState;
  actions: ActionId[];
  revealed?: Partial<Record<StatKey, boolean>>;
  maxActionsPerTurn: number;
  maxActionChoices: number;
}

export interface Player extends Actor {
  score: number;
}

export type StatKey = 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT';
