import { writable, get } from 'svelte/store';
import type { GameState } from '../entities/BattleState';
import type { Player, Actor, StatKey } from '../entities/Character';
import { tickStatusesTurnStart } from '$lib/data/consts/statuses';
import type { Action } from '$lib/domain/entities/Action';
import { calcMaxHP } from './attributeService';
import { buildPlayerFromCsv, buildEnemyFromCsv } from '$lib/data/repositories/characterRepository';
import { performAction } from './actionExecutor';
import { waitForAnimationsComplete } from '$lib/presentation/utils/effectBus';
import { randomEvent } from '$lib/domain/services/eventService';
import { pushLog, setLogState, resetDisplayLogs } from '$lib/presentation/utils/logUtil';
import { getRewardsForEnemy } from '$lib/data/repositories/rewardRepository';
import type { RewardOption } from '$lib/domain/entities/BattleState';

const HIGH_KEY = 'mylogue_highest_floor';
const ENEMY_REVEAL_KEY_PREFIX = 'mylogue_enemy_revealed_'; // 旧: actions のみ
const ENEMY_REVEALINFO_KEY_PREFIX = 'mylogue_enemy_revealinfo_'; // 新: attributes + actions

interface RevealInfoPersisted {
  actions: Action[];
  revealedAttributes?: Record<string, boolean>; // hp, STR など true
}

function loadRevealedActions(kind: string, floor: number): Action[] | undefined {
  // 互換: 旧キー (actionsのみ)
  const key = `${ENEMY_REVEAL_KEY_PREFIX}${kind}_${floor}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Action[];
  } catch (e) {
    console.warn('Failed to parse legacy revealedActions from localStorage', e);
  }
  return undefined;
}

function loadRevealInfo(kind: string, floor: number): RevealInfoPersisted | undefined {
  const key = `${ENEMY_REVEALINFO_KEY_PREFIX}${kind}_${floor}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.actions)) {
      return parsed as RevealInfoPersisted;
    }
  } catch (e) {
    console.warn('Failed to parse revealInfo from localStorage', e);
  }
  return undefined;
}

export function persistRevealedActions(kind: string, floor: number, actions: Action[]) {
  const key = `${ENEMY_REVEAL_KEY_PREFIX}${kind}_${floor}`;
  try {
    localStorage.setItem(key, JSON.stringify(actions.slice().sort()));
  } catch (e) {
    // 失敗してもゲーム継続可能なので握りつぶす
    console.warn('Failed to persist revealedActions', e);
  }
}

export function persistRevealInfo(kind: string, floor: number, enemy: Actor) {
  try {
    const key = `${ENEMY_REVEALINFO_KEY_PREFIX}${kind}_${floor}`;
    const data: RevealInfoPersisted = {
      actions: (enemy.revealedActions || []).slice().sort(),
      revealedAttributes: enemy.revealed ? { ...enemy.revealed } : undefined
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to persist revealInfo', e);
  }
}

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
  // 新フォーマット優先、無ければ旧フォーマット(actionsのみ) を読む
  const info = loadRevealInfo(kind, floorIndex);
  if (info) {
    e.revealedActions = info.actions.slice();
    if (info.revealedAttributes) {
      const allowed: StatKey[] = ['hp', 'CON', 'STR', 'POW', 'DEX', 'APP', 'INT'];
      const obj: Partial<Record<StatKey, boolean>> = {};
      for (const k of allowed) {
        if (info.revealedAttributes[k]) obj[k] = true;
      }
      e.revealed = obj;
    }
  } else {
    const legacy = loadRevealedActions(kind, floorIndex);
    e.revealedActions = legacy ? legacy.slice() : [];
  }
  return e;
}

function initState(): GameState {
  const highest = Number(localStorage.getItem(HIGH_KEY) || '0');
  return {
    floorIndex: 0,
    stepIndex: 0,
    phase: 'progress',
    player: basePlayer(),
    allies: [],
    enemies: [],
    selectedEnemyIndex: undefined,
    log: [{ message: 'ゲーム開始', kind: 'system' }],
    highestFloor: highest,
    actionOffer: [],
    actionUseCount: 0,
    playerUsedActions: [],
    insightRewardActions: []
  };
}

export const gameState = writable<GameState>(initState());
// 初期状態を logUtil に登録
gameState.subscribe((s) => setLogState(s));

export function restart() {
  const s = initState();
  // 表示ログのリセットと初期1行のシード
  resetDisplayLogs();
  gameState.set(s);
}

function commit() {
  gameState.update((s) => ({
    ...s,
    player: { ...s.player },
    allies: s.allies.map((a) => ({ ...a })),
    enemies: s.enemies.map((e) => ({ ...e })),
    log: [...s.log]
  }));
}

// ローカルの state 内容をそのまま store へ反映する強制コミット
function commitState(state: GameState) {
  gameState.set({
    ...state,
    player: { ...state.player },
    allies: state.allies.map((a) => ({ ...a })),
    enemies: state.enemies.map((e) => ({ ...e })),
    log: [...state.log]
  });
}

// commit により store 内の参照が差し替わるため、呼び出し側引数 state を最新の store 値で再同期する
function resyncFromStore(state: GameState) {
  const cur = get(gameState);
  // top-level プロパティを丸ごと差し替え、同一参照(state)を維持
  Object.assign(state, cur);
}

export function rollActions(state: GameState) {
  // ガードはターン終了処理で自然消滅するためここでの手動解除は不要
  const pool = state.player.actions;
  const limit = state.player.maxActionChoices;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.actionOffer = shuffled.slice(0, Math.min(limit, shuffled.length));
  state.actionUseCount = 0;
  state.playerUsedActions = [];
}

function logProgress(state: GameState) {
  pushLog(`進行: 階層${state.floorIndex + 1} - ${state.stepIndex + 1}/5`, 'system');
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
    // 複数戦闘: ひとまず1体生成だが配列にする。将来的に複数生成に拡張可能。
    state.enemies = [createEnemy(enemyKind, state.floorIndex)];
    state.selectedEnemyIndex = 0;
    // 味方は開始時点では空。将来的に編成機能で埋まる想定。
    state.currentEncounterKind = enemyKind;
    state.phase = 'combat';
    // 戦闘開始直後のターン開始効果を適用
    startTurn(state);
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

export async function combatAction(state: GameState, id: Action) {
  if (state.phase !== 'combat') return;
  if (!state.actionOffer.includes(id)) return;
  if (state.playerUsedActions && state.playerUsedActions.includes(id)) return;
  // プレイヤーのターゲットは選択中の敵（デフォルトは先頭生存）
  let target = state.enemies.find((e) => e.hp > 0);
  if (
    state.selectedEnemyIndex !== undefined &&
    state.enemies[state.selectedEnemyIndex] &&
    state.enemies[state.selectedEnemyIndex].hp > 0
  ) {
    target = state.enemies[state.selectedEnemyIndex];
  }
  performAction(state, state.player, target, id);
  state.player = { ...state.player };
  state.enemies = state.enemies.map((e) => ({ ...e }));
  state.actionUseCount += 1;
  state.playerUsedActions?.push(id);
  // いったん反映し、エフェクトが終わるのを待つ
  commit();
  await waitForAnimationsComplete();
  resyncFromStore(state);
  // 撃破整理（プレイヤー行動で全滅した可能性）
  removeDeadActors(state);
  if (state.enemies.length === 0 && state.phase !== 'combat') {
    commit();
    return;
  }
  // 洞察(Reveal) は即座に永続化 (attributes + actions)
  if (id === 'Reveal') {
    const enemy0 = state.enemies[0];
    if (enemy0) {
      // 洞察により、対象の全アクションを insightActions としてマーク
      const allActs = enemy0.actions.slice();
      const uniq = Array.from(new Set([...(enemy0.insightActions || []), ...allActs]));
      enemy0.insightActions = uniq;
      // 報酬用にも積んでおく（複数戦闘想定で floor 単位に持つなら別管理だが現状一時）
      state.insightRewardActions = Array.from(
        new Set([...(state.insightRewardActions || []), ...uniq])
      );
      persistRevealInfo(enemy0.kind, state.floorIndex, enemy0);
    }
    // 即時反映: enemy も再ラップ済みなので commit 前に早期コミット
    commit();
  }
  // 敵1体が倒れた場合もあるが、配列からはターン終了時に掃除する。
  if (state.actionUseCount >= state.player.maxActionsPerTurn) {
    // プレイヤーのターン終了 -> 味方AI -> 敵AI -> 次ターン開始
    await alliesTurn(state);
    if (state.phase !== 'combat') {
      commit();
      return;
    }
    await enemiesTurn(state);
    if (state.phase === 'combat') {
      // 敵ターンで store 参照が差し替わっている可能性があるため同期
      resyncFromStore(state);
      const ok = startTurn(state); // 敵ターン後の新ターン開始（毒などのターン開始エフェクトが発生）
      if (!ok) {
        // 何らかの理由でターン開始処理が途中で終了（死亡や勝敗確定）した場合
        commitState(state);
        return;
      }
      await waitForAnimationsComplete();
      resyncFromStore(state);
    }
  }
  commit();
}

// performActorAction は performAction に統合済み

async function alliesTurn(state: GameState) {
  // 味方は敵と同様に自動行動（敵AIとほぼ同じロジック）。
  for (const ally of state.allies.filter((a) => a.hp > 0)) {
    const acted: Action[] = [];
    const maxActs = ally.maxActionsPerTurn;
    for (let i = 0; i < maxActs; i++) {
      const candidates = ally.actions.filter((a) => !acted.includes(a));
      if (candidates.length === 0) break;
      const act = candidates[Math.floor(Math.random() * candidates.length)];
      acted.push(act);
      const target = state.enemies.find((e) => e.hp > 0);
      performAction(state, ally, target, act);
      commit();
      await waitForAnimationsComplete();
      resyncFromStore(state);
      removeDeadActors(state);
      if (state.enemies.length === 0) break;
    }
    if (state.enemies.length === 0) break;
  }
}

async function enemiesTurn(state: GameState) {
  for (const enemy of state.enemies.filter((e) => e.hp > 0)) {
    const acted: Action[] = [];
    const maxActs = enemy.maxActionsPerTurn;
    for (let i = 0; i < maxActs; i++) {
      const candidates = enemy.actions.filter((a) => !acted.includes(a));
      if (candidates.length === 0) break;
      const act = candidates[Math.floor(Math.random() * candidates.length)];
      acted.push(act);
      // 敵のターゲットはプレイヤー優先。将来は味方含めたヘイトなど拡張余地。
      const target = state.player.hp > 0 ? state.player : state.allies.find((a) => a.hp > 0);
      performAction(state, enemy, target, act);
      commit();
      await waitForAnimationsComplete();
      resyncFromStore(state);
      if (state.player.hp <= 0) break;
    }
    if (state.player.hp <= 0) break;
  }
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

function removeDeadActors(state: GameState) {
  // 敵の死亡整理
  const before = state.enemies.length;
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (before > 0 && state.enemies.length === 0) {
    state.selectedEnemyIndex = undefined;
    // 全滅 -> 勝利（報酬へ）
    const kind = state.currentEncounterKind ?? 'normal';
    state.phase = 'progress';
    if (kind === 'boss') {
      prepareReward(state, 'boss');
    } else {
      state.stepIndex += 1;
      prepareReward(state, kind);
    }
  }
  // 味方の死亡整理（現時点では保持だけ。将来的な復活等は別途）
  state.allies = state.allies.filter((a) => a.hp > 0);
}

function startTurn(state: GameState) {
  const actors: Actor[] = [state.player, ...state.allies, ...state.enemies];
  for (const actor of actors) {
    tickStatusesTurnStart(actor);
    if (actor.hp <= 0) {
      if (actor === state.player) {
        state.phase = 'gameover';
        pushLog('毒で倒れた...', 'system');
      } else {
        // 味方 or 敵が継続ダメージで倒れた
        if (actor.side === 'enemy') {
          pushLog('敵を継続ダメージで倒した!', 'combat');
          state.player.score += 1;
          removeDeadActors(state);
          if (state.phase !== 'combat') {
            commitState(state);
            return false;
          }
        } else {
          pushLog('味方が継続ダメージで倒れた...', 'combat');
          state.allies = state.allies.filter((a) => a.hp > 0);
        }
      }
      commitState(state);
      return false;
    }
  }
  if (state.phase === 'combat') rollActions(state);
  state.actionUseCount = 0;
  state.playerUsedActions = [];
  state.player = { ...state.player };
  state.allies = state.allies.map((a) => ({ ...a }));
  state.enemies = state.enemies.map((e) => ({ ...e }));
  commitState(state);
  return true;
}

function prepareReward(state: GameState, defeatedKind: 'normal' | 'elite' | 'boss') {
  const opts = getRewardsForEnemy(state, defeatedKind);
  // 洞察で開示したアクションを1つだけ報酬に混ぜる（未所持のみ）。
  const insightActs: Action[] = (state.insightRewardActions || []).slice();
  const candidate = insightActs.find((a) => !state.player.actions.includes(a));
  if (candidate) {
    const extra: RewardOption = {
      id: `insight:${candidate}`,
      label: `洞察: ${candidate} を会得`,
      kind: defeatedKind === 'boss' ? 'boss' : 'normal',
      apply: (s: GameState) => {
        if (!s.player.actions.includes(candidate)) s.player.actions.push(candidate);
        pushLog(`洞察報酬: 新アクション ${candidate} を会得`, 'system');
      }
    };
    // 既存3件に混ぜる。件数が増えるがUIは動的。
    opts.push(extra);
  }
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
  // 洞察由来の一時リストは消費後にクリア（同一アクションの重複提示を避ける）
  state.insightRewardActions = [];
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
