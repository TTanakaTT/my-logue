import { writable } from 'svelte/store';
import type { GameState } from '../entities/battleState';
import type { Player, Actor } from '../entities/character';
import type { actionName } from '$lib/domain/entities/actionName';
import { calcMaxHP } from './statsService';
import { buildPlayerFromCsv, buildEnemyFromCsv } from '$lib/data/repositories/characterRepository';
import { getAction } from '$lib/data/repositories/actionRepository';
import { randomEvent } from '$lib/domain/services/eventService';
import { emitActionLog, pushLog, setLogState } from '$lib/presentation/utils/logUtil';
import { getRewardsForEnemy } from '$lib/data/repositories/rewardRepository';

const HIGH_KEY = 'mylogue_highest_floor';

// ログ処理は logUtil に集約済み

export function recalcPlayer(p: Player) {
  const max = calcMaxHP(p);
  if (p.hp > max) p.hp = max;
}

function basePlayer(): Player {
  const p = buildPlayerFromCsv();
  p.hp = calcMaxHP(p);
  return p;
}

export function createEnemy(kind: 'normal' | 'elite' | 'boss', floorIndex: number): Actor {
  const e = buildEnemyFromCsv(kind, floorIndex);
  e.hp = calcMaxHP(e);
  e.revealedActions = [];
  return e;
}

function initState(): GameState {
  const highest = Number(localStorage.getItem(HIGH_KEY) || '0');
  return {
    floorIndex: 0,
    stepIndex: 0,
    phase: 'progress',
    player: basePlayer(),
    log: [{ message: 'ゲーム開始', kind: 'system' }],
    highestFloor: highest,
    actionOffer: [],
    actionUseCount: 0,
    playerUsedActions: []
  };
}

export const gameState = writable<GameState>(initState());
// 初期状態を logUtil に登録
gameState.subscribe((s) => setLogState(s));

export function restart() {
  gameState.set(initState());
}

function commit() {
  gameState.update((s) => ({
    ...s,
    player: { ...s.player },
    enemy: s.enemy ? { ...s.enemy } : undefined,
    log: [...s.log]
  }));
}

export function rollActions(state: GameState) {
  // プレイヤーターン開始時にガード解除
  if (state.player.guard) state.player.guard = false;
  const pool = state.player.actions;
  const limit = state.player.maxActionChoices;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.actionOffer = shuffled.slice(0, Math.min(limit, shuffled.length));
  state.actionUseCount = 0;
  state.playerUsedActions = [];
}

function logProgress(state: GameState) {
  pushLog(`進行: 階層${state.floorIndex + 1}/10 ステップ${state.stepIndex + 1}/5`, 'system');
}

export function nextProgress(state: GameState) {
  if (state.stepIndex === 4) {
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog('全階層を踏破! 勝利!', 'system');
      if (state.highestFloor < 10) {
        state.highestFloor = 10;
        localStorage.setItem(HIGH_KEY, String(state.highestFloor));
      }
      commit();
      return;
    }
    state.stepIndex = 0;
    logProgress(state);
  }
  state.phase = 'progress';
  logProgress(state);
  commit();
}

export function chooseNode(state: GameState, kind: 'combat' | 'event' | 'rest' | 'boss') {
  if (kind === 'combat' || kind === 'boss') {
    // 4ステップ目(= index 3) の戦闘は elite とする (ボス除く)
    const enemyKind: 'normal' | 'elite' | 'boss' =
      kind === 'boss' ? 'boss' : state.stepIndex === 3 ? 'elite' : 'normal';
    state.enemy = createEnemy(enemyKind, state.floorIndex);
    state.phase = 'combat';
    rollActions(state);
    pushLog(
      kind === 'boss' ? 'ボス戦開始!' : enemyKind === 'elite' ? '精鋭戦開始!' : '戦闘開始',
      'combat'
    );
  } else if (kind === 'event') {
    state.phase = 'event';
    const ev = randomEvent();
    ev.apply(state);
    pushLog(`イベント: ${ev.name}`, 'event');
  } else if (kind === 'rest') {
    state.phase = 'rest';
  }
  commit();
}

export function combatAction(state: GameState, id: actionName) {
  if (state.phase !== 'combat') return;
  if (!state.actionOffer.includes(id)) return;
  if (state.playerUsedActions && state.playerUsedActions.includes(id)) return;
  const def = getAction(id);
  if (!def) return;
  emitActionLog(state.player, state.enemy, def);
  def.execute({ actor: state.player, target: state.enemy });
  state.player = { ...state.player };
  if (state.enemy) state.enemy = { ...state.enemy };
  state.actionUseCount += 1;
  state.playerUsedActions?.push(id);
  if (state.enemy && state.enemy.hp <= 0) {
    const defeated = state.enemy;
    const wasBoss = defeated.kind === 'boss';
    state.phase = 'progress';
    if (wasBoss) {
      prepareReward(state, 'boss');
    } else {
      const defeatedKind = defeated.kind as 'normal' | 'elite';
      state.stepIndex += 1;
      prepareReward(state, defeatedKind);
    }
    state.enemy = undefined;
    commit();
    return;
  }
  if (state.actionUseCount >= state.player.maxActionsPerTurn) {
    enemyTurn(state);
    endTurn(state);
  }
  commit();
}

function performActorAction(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  id: actionName
) {
  const def = getAction(id);
  if (!def) return;
  emitActionLog(actor, target, def);
  def.execute({ actor, target });
  if (actor.side === 'enemy') {
    if (!actor.revealedActions) actor.revealedActions = [];
    if (!actor.revealedActions.includes(id)) actor.revealedActions.push(id);
  }
}

function enemyTurn(state: GameState) {
  const enemy = state.enemy;
  if (!enemy) return;
  if (enemy.guard) enemy.guard = false;
  const acted: actionName[] = [];
  const maxActs = enemy.maxActionsPerTurn;
  for (let i = 0; i < maxActs; i++) {
    const candidates = enemy.actions.filter((a) => !acted.includes(a));
    if (candidates.length === 0) break;
    const actionName = candidates[Math.floor(Math.random() * candidates.length)];
    acted.push(actionName);
    performActorAction(state, enemy, state.player, actionName);
    if (state.player.hp <= 0) break;
  }
  state.enemy = { ...enemy };
  state.player = { ...state.player };
  if (state.player.hp <= 0) {
    state.phase = 'gameover';
    pushLog('倒れた...', 'system');
    if (state.highestFloor < state.floorIndex + 1) {
      state.highestFloor = state.floorIndex + 1;
      localStorage.setItem(HIGH_KEY, String(state.highestFloor));
    }
  }
}

function endTurn(state: GameState) {
  const enemy = state.enemy;
  const victims: Actor[] = [state.player];
  if (enemy) victims.push(enemy);
  for (const actor of victims) {
    for (const dot of [...actor.dots]) {
      if (dot.id === 'poison') {
        actor.hp -= dot.damage;
        pushLog(
          `毒で${dot.damage}ダメージ (${actor === state.player ? 'プレイヤー' : '敵'}HP:${actor.hp}/${calcMaxHP(actor)})`,
          'combat'
        );
        dot.turns -= 1;
        if (dot.turns <= 0) {
          actor.dots = actor.dots.filter((d) => d !== dot);
          pushLog('毒が消えた', 'combat');
        }
        if (actor.hp <= 0) {
          if (actor === state.player) {
            state.phase = 'gameover';
            pushLog('毒で倒れた...', 'system');
          } else {
            pushLog('敵を毒で倒した!', 'combat');
            state.player.score += 1;
            state.phase = 'progress';
            const kind = actor.kind as 'normal' | 'elite';
            state.stepIndex += 1;
            prepareReward(state, kind);
            state.enemy = undefined;
          }
          commit();
          return;
        }
      }
    }
  }
  if (enemy) rollActions(state);
  state.actionUseCount = 0;
  state.playerUsedActions = [];
  state.player = { ...state.player };
  if (state.enemy) state.enemy = { ...state.enemy };
  commit();
}

function prepareReward(state: GameState, defeatedKind: 'normal' | 'elite' | 'boss') {
  const opts = getRewardsForEnemy(state, defeatedKind);
  state.rewardOptions = opts;
  state.rewardIsBoss = defeatedKind === 'boss';
  state.phase = 'reward';
  pushLog('報酬を選択', 'system');
}

export function pickReward(state: GameState, id: string) {
  if (state.phase !== 'reward' || !state.rewardOptions) return;
  const opt = state.rewardOptions.find((o) => o.id === id);
  if (!opt) return;
  opt.apply(state);
  if (state.rewardIsBoss) {
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog('全階層を踏破! 勝利!', 'system');
      if (state.highestFloor < 10) {
        state.highestFloor = 10;
        localStorage.setItem(HIGH_KEY, String(state.highestFloor));
      }
      commit();
      return;
    }
    state.stepIndex = 0;
    logProgress(state);
    state.phase = 'progress';
  } else {
    state.phase = 'progress';
  }
  state.rewardOptions = undefined;
  state.rewardIsBoss = false;
  logProgress(state);
  commit();
}

export function restChoice(state: GameState, choice: 'heal' | 'maxhp') {
  if (state.phase !== 'rest') return;
  if (choice === 'heal') {
    const max = calcMaxHP(state.player);
    const amount = Math.max(1, Math.floor(max * 0.3));
    const before = state.player.hp;
    state.player.hp = Math.min(max, state.player.hp + amount);
    pushLog(`休憩で${state.player.hp - before}回復`, 'rest');
  } else {
    state.player.CON += 1;
    const prevMax = calcMaxHP(state.player) - 2;
    const ratio = prevMax > 0 ? state.player.hp / prevMax : 1;
    recalcPlayer(state.player);
    const newMax = calcMaxHP(state.player);
    state.player.hp = Math.min(newMax, Math.round(newMax * ratio));
    pushLog('休憩でCON+1', 'rest');
  }
  state.stepIndex += 1;
  state.phase = 'progress';
  commit();
}
