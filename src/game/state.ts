import { writable } from 'svelte/store';
import type { GameState, Player, Enemy, ActionId, LogEntry } from './types';
import { scaling } from './scaling';
import { getAction } from './actions';
import { randomEvent } from './events';

const HIGH_KEY = 'mylogue_highest_floor';

export function pushLog(state: GameState, message: string, kind: LogEntry['kind'] = 'system') {
  state.log.unshift({ message, kind });
  if (state.log.length > 20) state.log.pop();
}

function basePlayer(): Player {
  return {
    maxHP: 50,
    hp: 50,
    attack: 6,
    actions: ['strike', 'heavy', 'guard', 'recover', 'poison'],
    guard: false,
    dots: [],
    score: 0
  };
}

export function createEnemy(kind: 'normal' | 'boss', floorIndex: number): Enemy {
  if (kind === 'normal') {
    const baseHP = scaling.enemyHP(20, floorIndex);
    return { kind, baseHP, hp: baseHP, attack: scaling.enemyAttack(5, floorIndex) };
  } else {
    const baseHP = scaling.enemyHP(60, floorIndex);
    return { kind, baseHP, hp: baseHP, attack: scaling.enemyAttack(10, floorIndex), buffAttack: 0 };
  }
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
    actionUseCount: 0
  };
}

export const gameState = writable<GameState>(initState());

export function restart() {
  gameState.set(initState());
}

// 直接オブジェクトをミューテートしているため、Svelteに変更を通知するためのcommitヘルパ
function commit() {
  gameState.update((s) => s); // 参照は同じでもsubscriberに通知
}

export function rollActions(state: GameState) {
  const pool = state.player.actions;
  // ランダムに3つ(重複なし)表示 -> プレイヤーは2回選べる
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.actionOffer = shuffled.slice(0, Math.min(3, shuffled.length));
  state.actionUseCount = 0;
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
  const def = getAction(id);
  if (!def) return;
  def.execute(state, { player: state.player, enemy: state.enemy });
  state.actionUseCount += 1;
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
    commit();
    return;
  }
  if (state.actionUseCount >= 2) {
    // プレイヤーターン終了 -> 敵行動
    enemyTurn(state);
    endTurn(state);
  }
  commit();
}

function enemyTurn(state: GameState) {
  const enemy = state.enemy;
  if (!enemy) return;
  if (enemy.kind === 'boss') {
    // ランダム: 0 攻撃 / 1 バフ
    if (Math.random() < 0.6) {
      enemyAttack(state, enemy);
    } else {
      enemy.buffAttack = (enemy.buffAttack || 0) + 2;
      pushLog(state, 'ボスが力を高めた (+2攻撃)', 'combat');
    }
  } else {
    enemyAttack(state, enemy);
  }
}

function enemyAttack(state: GameState, enemy: Enemy) {
  let dmg = enemy.attack + (enemy.buffAttack || 0);
  if (state.player.guard) {
    dmg = Math.ceil(dmg / 2);
    state.player.guard = false;
    pushLog(state, 'ガードで被ダメ半減', 'combat');
  }
  state.player.hp -= dmg;
  pushLog(state, `敵の攻撃 ${dmg}ダメージ (HP:${state.player.hp}/${state.player.maxHP})`, 'combat');
  if (state.player.hp <= 0) {
    state.phase = 'gameover';
    pushLog(state, '倒れた...', 'system');
    if (state.highestFloor < state.floorIndex + 1) {
      state.highestFloor = state.floorIndex + 1;
      localStorage.setItem(HIGH_KEY, String(state.highestFloor));
    }
    commit();
  }
}

function endTurn(state: GameState) {
  // DoT処理
  const enemy = state.enemy;
  if (enemy) {
    const poison = state.player.dots.find((d) => d.id === 'poison');
    if (poison) {
      enemy.hp -= poison.damage;
      pushLog(state, `毒で${poison.damage}ダメージ (敵HP:${enemy.hp})`, 'combat');
      poison.turns -= 1;
      if (poison.turns <= 0) {
        state.player.dots = state.player.dots.filter((d) => d !== poison);
        pushLog(state, '毒が消えた', 'combat');
      }
      if (enemy.hp <= 0) {
        pushLog(state, '敵を毒で倒した!', 'combat');
        state.player.score += 1;
        state.phase = 'progress';
        state.stepIndex += 1;
        prepareReward(state, false, false);
        commit();
        return;
      }
    }
    rollActions(state);
  }
  state.player.guard = false;
  state.actionUseCount = 0;
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
      label: '最大HP+5 (即回復+5)',
      kind: 'normal' as const,
      apply: (s: GameState) => {
        s.player.maxHP += 5;
        s.player.hp += 5;
        pushLog(s, '最大HP+5', 'system');
      }
    },
    {
      id: 'atk1',
      label: '攻撃力+1',
      kind: 'normal' as const,
      apply: (s: GameState) => {
        s.player.attack += 1;
        pushLog(s, '攻撃力+1', 'system');
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
          s.player.attack += 1;
          pushLog(s, '代替: 攻撃力+1', 'system');
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
      label: '最大HP+10 (即+10回復)',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.maxHP += 10;
        s.player.hp += 10;
        pushLog(s, '最大HP+10', 'system');
      }
    },
    {
      id: 'boss-atk2',
      label: '攻撃力+2',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.attack += 2;
        pushLog(s, '攻撃力+2', 'system');
      }
    },
    {
      id: 'boss-cleanse',
      label: 'HP全回復 & 状態異常解除',
      kind: 'boss' as const,
      apply: (s: GameState) => {
        s.player.hp = s.player.maxHP;
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
    const amount = Math.max(1, Math.floor(state.player.maxHP * 0.3));
    const before = state.player.hp;
    state.player.hp = Math.min(state.player.maxHP, state.player.hp + amount);
    pushLog(state, `休憩で${state.player.hp - before}回復`, 'rest');
  } else {
    state.player.maxHP += 3;
    pushLog(state, '最大HP+3', 'rest');
  }
  state.stepIndex += 1;
  state.phase = 'progress';
  commit();
}
