import { writable } from 'svelte/store';
import type { GameState, Player, Enemy, ActionId, LogEntry, Actor } from './types';
import { scaling } from './scaling';
import { getAction } from './actions';
import { randomEvent } from './events';
import { calcMaxHP, calcAttack, addAttackBuff } from './stats';

const HIGH_KEY = 'mylogue_highest_floor';

export function pushLog(state: GameState, message: string, kind: LogEntry['kind'] = 'system') {
  state.log.unshift({ message, kind });
  if (state.log.length > 20) state.log.pop();
}
// combat主体付き
export function pushCombatLog(
  state: GameState,
  message: string,
  actorTag: 'player' | 'enemy' | 'boss'
) {
  state.log.unshift({ message, kind: 'combat', actorTag });
  if (state.log.length > 20) state.log.pop();
}

// プレイヤー再計算 (CON/STR変化時にHP上限超過を調整)
export function recalcPlayer(p: Player) {
  const max = calcMaxHP(p);
  if (p.hp > max) p.hp = max;
}

function basePlayer(): Player {
  const base: Player = {
    STR: 10,
    CON: 10,
    POW: 8,
    DEX: 10,
    APP: 8,
    INT: 10,
    hp: 0,
    guard: false,
    dots: [],
    actions: ['strike', 'heavy', 'guard', 'recover', 'poison'],
    revealed: { hp: true, STR: true, CON: true, POW: true, DEX: true, APP: true, INT: true },
    maxActionsPerTurn: 2,
    maxActionChoices: 3,
    score: 0
  };
  base.hp = calcMaxHP(base);
  return base;
}

export function createEnemy(kind: 'normal' | 'boss', floorIndex: number): Enemy {
  // 既存スケーリングから CON/STR を逆算 (丸め誤差は許容)
  const targetHP = scaling.enemyHP(kind === 'normal' ? 20 : 60, floorIndex);
  const CON = Math.max(1, Math.round((targetHP - 40) / 2));
  const targetAtk = scaling.enemyAttack(kind === 'normal' ? 5 : 10, floorIndex);
  const STR = Math.max(1, Math.round((targetAtk - 4) * 2));
  return {
    kind,
    STR,
    CON,
    POW: kind === 'boss' ? 12 : 6,
    DEX: kind === 'boss' ? 12 : 8,
    APP: 5,
    INT: kind === 'boss' ? 12 : 8,
    hp: targetHP,
    guard: false,
    dots: [],
    actions: kind === 'boss' ? ['strike', 'heavy', 'guard', 'recover'] : ['strike'], // 敵行動セット
    revealed: { hp: true, STR: true }, // 現状HP/STRのみ判明
    maxActionsPerTurn: kind === 'boss' ? 2 : 1,
    maxActionChoices: kind === 'boss' ? 3 : 2
  };
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

export function restart() {
  gameState.set(initState());
}

// 直接オブジェクトをミューテートしているため、Svelteに変更を通知するためのcommitヘルパ
function commit() {
  // 浅いコピー + ネスト( player / enemy )も新参照にして再描画を確実化
  gameState.update((s) => ({
    ...s,
    player: { ...s.player },
    enemy: s.enemy ? { ...s.enemy } : undefined,
    log: [...s.log]
  }));
}

export function rollActions(state: GameState) {
  const pool = state.player.actions;
  const limit = state.player.maxActionChoices;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.actionOffer = shuffled.slice(0, Math.min(limit, shuffled.length));
  state.actionUseCount = 0;
  state.playerUsedActions = [];
}

function logProgress(state: GameState) {
  pushLog(state, `進行: 階層${state.floorIndex + 1}/10 ステップ${state.stepIndex + 1}/5`, 'system');
}

export function nextProgress(state: GameState) {
  // ステップ構造: 0:戦闘,1:戦闘|イベント,2:イベント|休憩,3:戦闘|戦闘,4:ボス
  if (state.stepIndex === 4) {
    // クリア済み floor → 次階層
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog(state, '全階層を踏破! 勝利!', 'system');
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
    state.enemy = createEnemy(kind === 'boss' ? 'boss' : 'normal', state.floorIndex);
    state.phase = 'combat';
    rollActions(state);
    pushLog(state, kind === 'boss' ? 'ボス戦開始!' : '戦闘開始', 'combat');
  } else if (kind === 'event') {
    state.phase = 'event';
    const ev = randomEvent();
    ev.apply(state);
    pushLog(state, `イベント: ${ev.name}`, 'event');
  } else if (kind === 'rest') {
    state.phase = 'rest';
  }
  commit();
}

export function combatAction(state: GameState, id: ActionId) {
  if (state.phase !== 'combat') return;
  if (!state.actionOffer.includes(id)) return;
  if (state.playerUsedActions && state.playerUsedActions.includes(id)) return; // 既に使用済み
  const def = getAction(id);
  if (!def) return;
  def.execute(state, { actor: state.player, target: state.enemy });
  // 変更を確実に反映させるため即座に参照を再生成
  state.player = { ...state.player } as any;
  if (state.enemy) state.enemy = { ...state.enemy } as any;
  state.actionUseCount += 1;
  state.playerUsedActions?.push(id);
  // 敵を倒したら報酬処理へ
  if (state.enemy && state.enemy.hp <= 0) {
    const defeated = state.enemy;
    const wasBoss = defeated.kind === 'boss';
    state.phase = 'progress';
    if (wasBoss) {
      // ボス撃破はフロア完了扱い。stepIndexを不正に+1せずフロアを進める。
      prepareReward(state, true, state.floorIndex === 9);
    } else {
      // 通常敵
      state.stepIndex += 1;
      prepareReward(state, false, false);
    }
    // 表示から消す
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
  id: ActionId
) {
  const def = getAction(id);
  if (!def) return;
  def.execute(state, { actor, target });
}

function enemyTurn(state: GameState) {
  const enemy = state.enemy;
  if (!enemy) return;
  const acted: ActionId[] = [];
  const maxActs = enemy.maxActionsPerTurn;
  for (let i = 0; i < maxActs; i++) {
    const candidates = enemy.actions.filter((a) => !acted.includes(a));
    if (candidates.length === 0) break;
    // ボス固有バフ判定（最初の行動前のみ発動チャンス）
    if (i === 0 && enemy.kind === 'boss' && Math.random() < 0.3) {
      addAttackBuff(enemy, 2);
      pushLog(state, 'ボスが力を高めた (+2攻撃相当)', 'combat');
      continue; // バフは行動スロットを消費
    }
    const actionId = candidates[Math.floor(Math.random() * candidates.length)];
    acted.push(actionId);
    performActorAction(state, enemy, state.player, actionId);
    // 戦闘終了条件（プレイヤー死亡）
    if (state.player.hp <= 0) break;
  }
  // 参照再生成
  state.enemy = { ...enemy } as any;
  state.player = { ...state.player } as any;
  // プレイヤーが倒れたチェック
  if (state.player.hp <= 0) {
    state.phase = 'gameover';
    pushLog(state, '倒れた...', 'system');
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
          state,
          `毒で${dot.damage}ダメージ (${actor === state.player ? 'プレイヤー' : '敵'}HP:${actor.hp}/${calcMaxHP(actor)})`,
          'combat'
        );
        dot.turns -= 1;
        if (dot.turns <= 0) {
          actor.dots = actor.dots.filter((d: any) => d !== dot);
          pushLog(state, '毒が消えた', 'combat');
        }
        if (actor.hp <= 0) {
          if (actor === state.player) {
            state.phase = 'gameover';
            pushLog(state, '毒で倒れた...', 'system');
          } else {
            pushLog(state, '敵を毒で倒した!', 'combat');
            state.player.score += 1;
            state.phase = 'progress';
            state.stepIndex += 1;
            prepareReward(state, false, false);
            state.enemy = undefined;
          }
          commit();
          return;
        }
      }
    }
  }
  if (enemy) rollActions(state);
  state.player.guard = false;
  if (enemy) enemy.guard = false;
  state.actionUseCount = 0;
  state.playerUsedActions = [];
  // 参照再生成
  state.player = { ...state.player } as any;
  if (state.enemy) state.enemy = { ...state.enemy } as any;
  commit();
}
function prepareReward(state: GameState, boss: boolean, finalBoss: boolean) {
  const opts = boss ? buildBossRewards(state, finalBoss) : buildNormalRewards();
  state.rewardOptions = opts;
  state.rewardIsBoss = boss;
  state.rewardIsFinalBoss = finalBoss;
  state.phase = 'reward';
  pushLog(state, boss ? 'ボス報酬を選択' : '成長報酬を選択', 'system');
}

function buildNormalRewards() {
  return [
    {
      id: 'hp5',
      label: 'CON+1 (最大HP再計算&割合維持)',
      kind: 'normal' as const,
      apply: (s: GameState) => {
        s.player.CON += 1;
        const prevMax = calcMaxHP(s.player);
        const ratio = prevMax > 0 ? s.player.hp / prevMax : 1;
        recalcPlayer(s.player);
        const newMax = calcMaxHP(s.player);
        s.player.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
        pushLog(s, 'CON+1 (最大HP上昇)', 'system');
      }
    },
    {
      id: 'atk1',
      label: 'STR+1',
      kind: 'normal' as const,
      apply: (s: GameState) => {
        s.player.STR += 1;
        recalcPlayer(s.player);
        pushLog(s, 'STR+1', 'system');
      }
    },
    {
      id: 'powerup',
      label: '新アクション: パワーアップ (なければ)',
      kind: 'normal' as const,
      apply: (s: GameState) => {
        if (!s.player.actions.includes('powerup')) {
          s.player.actions.push('powerup');
          pushLog(s, '新アクション取得: パワーアップ', 'system');
        } else {
          s.player.STR += 1;
          recalcPlayer(s.player);
          pushLog(s, '代替: STR+1', 'system');
        }
      }
    }
  ];
}

function buildBossRewards(state: GameState, finalBoss: boolean) {
  if (finalBoss) {
    return [
      {
        id: 'final-score',
        label: '最終勝利: 追加スコア+5',
        kind: 'boss' as const,
        apply: (s: GameState) => {
          s.player.score += 5;
          pushLog(s, '最終ボーナス +5スコア', 'system');
        }
      }
    ];
  }
  return [
    {
      id: 'boss-maxhp',
      label: 'CON+2 (最大HP再計算&割合維持)',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.CON += 2;
        const prevMax = calcMaxHP(s.player);
        const ratio = prevMax > 0 ? s.player.hp / prevMax : 1;
        recalcPlayer(s.player);
        const newMax = calcMaxHP(s.player);
        s.player.hp = Math.min(newMax, Math.max(1, Math.round(newMax * ratio)));
        pushLog(s, 'CON+2', 'system');
      }
    },
    {
      id: 'boss-atk2',
      label: 'STR+2',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.STR += 2;
        recalcPlayer(s.player);
        pushLog(s, 'STR+2', 'system');
      }
    },
    {
      id: 'boss-cleanse',
      label: 'HP全回復 & 状態異常解除',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.hp = calcMaxHP(s.player);
        s.player.dots = [];
        pushLog(s, '全回復', 'system');
      }
    }
  ];
}

export function pickReward(state: GameState, id: string) {
  if (state.phase !== 'reward' || !state.rewardOptions) return;
  const opt = state.rewardOptions.find((o) => o.id === id);
  if (!opt) return;
  opt.apply(state);
  // 進行更新
  if (state.rewardIsBoss) {
    // ボス撃破後のフロア進行処理
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog(state, '全階層を踏破! 勝利!', 'system');
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
  state.rewardIsFinalBoss = false;
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
    pushLog(state, `休憩で${state.player.hp - before}回復`, 'rest');
  } else {
    // CON+1 相当のミニ成長
    state.player.CON += 1;
    const prevMax = calcMaxHP(state.player) - 2; // 追加前逆算できないので簡易処理(増加量2想定)
    const ratio = prevMax > 0 ? state.player.hp / prevMax : 1;
    recalcPlayer(state.player);
    const newMax = calcMaxHP(state.player);
    state.player.hp = Math.min(newMax, Math.round(newMax * ratio));
    pushLog(state, '休憩でCON+1', 'rest');
  }
  state.stepIndex += 1;
  state.phase = 'progress';
  commit();
}
