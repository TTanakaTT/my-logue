import { writable, get } from 'svelte/store';
import { APP_VERSION } from '$lib/config/version';
import type { GameState, RewardOption } from '$lib/domain/entities/battle_state';
import type { Actor, Character, Enemy, Player } from '$lib/domain/entities/character';
import type { Action } from '$lib/domain/entities/action';
import { calcMaxHP } from '$lib/domain/services/attribute_service';
import { buildPlayerFromCsv, buildEnemyFromCsv } from '$lib/data/repositories/character_repository';
import { randomName } from '$lib/data/repositories/random_name_repository';
import { performAction } from '$lib/domain/services/action_executor';
import { waitForAnimationsComplete } from '$lib/presentation/utils/effectBus';
import { randomEvent } from '$lib/domain/services/event_service';
import { pushLog, setLogState, resetDisplayLogs } from '$lib/presentation/utils/logUtil';
import { getRewardsForEnemy } from '$lib/data/repositories/reward_repository';
import { tickStatusesTurnStart } from '$lib/data/consts/statuses';
import { createCompanionRepository } from '$lib/data/repositories/companion_repository';
import { getOrCreateFloorLayout } from '$lib/domain/services/floor_generation_service';
import type { FloorLayout, FloorNode } from '$lib/domain/entities/floor';

const STORAGE_VERSION_PREFIX = `version_${APP_VERSION}`;
const HIGH_KEY = `${STORAGE_VERSION_PREFIX}:highest_floor`;
const OBSERVED_ACTIONS_KEY = `${STORAGE_VERSION_PREFIX}:observed_charactor_actions`;
const EXPOSED_CHARACTORS_KEY = `${STORAGE_VERSION_PREFIX}:exposed_charactors`;

type ObservedActionsMap = Record<string, Action[]>; // character name -> observed actions

function loadObservedActionsMap(): ObservedActionsMap {
  try {
    const raw = localStorage.getItem(OBSERVED_ACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: ObservedActionsMap = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) out[k] = (v as Action[]).filter((x) => typeof x === 'string');
      }
      return out;
    }
  } catch (e) {
    console.warn('Failed to load observed_charactor_actions', e);
  }
  return {};
}

function saveObservedActionsMap(map: ObservedActionsMap) {
  try {
    localStorage.setItem(OBSERVED_ACTIONS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save observed_charactor_actions', e);
  }
}

export function addObservedActions(characterId: string, acts: Action[]) {
  if (typeof localStorage === 'undefined') return;
  const map = loadObservedActionsMap();
  const current = new Set(map[characterId] || []);
  for (const a of acts) current.add(a);
  map[characterId] = Array.from(current).sort();
  saveObservedActionsMap(map);
}

function loadExposedCharactors(): string[] {
  try {
    const raw = localStorage.getItem(EXPOSED_CHARACTORS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
  } catch (e) {
    console.warn('Failed to load exposed_charactors', e);
  }
  return [];
}

function saveExposedCharactors(list: string[]) {
  try {
    localStorage.setItem(EXPOSED_CHARACTORS_KEY, JSON.stringify(Array.from(new Set(list))));
  } catch (e) {
    console.warn('Failed to save exposed_charactors', e);
  }
}

export function markCharactorExposed(name: string) {
  if (typeof localStorage === 'undefined') return;
  const list = loadExposedCharactors();
  if (!list.includes(name)) {
    list.push(name);
    saveExposedCharactors(list);
  }
}

export function recalcPlayer(p: Actor) {
  const max = calcMaxHP(p);
  if (p.hp > max) p.hp = max;
}

function basePlayer(): Player {
  const p = buildPlayerFromCsv();
  p.name = randomName();
  p.hp = calcMaxHP(p);
  return p;
}

export function createEnemy(kind: 'normal' | 'elite' | 'boss', floorIndex: number): Enemy {
  const e = buildEnemyFromCsv(kind, floorIndex);
  e.hp = calcMaxHP(e);
  /**
   * Scenario (documentation):
   * 1. 初回遭遇: observed_charactor_actions に該当名が無ければ actions は全て不明扱い (exposedActions 空)。
   * 2. 敵が行動 → action_executor で個別に addObservedActions し観測済みアクションが徐々に増える。
   * 3. プレイヤーが "Observed" 実行 → markCharactorExposed + 全アクション addObservedActions → 次回以降
   *    createEnemy 時点で全能力値 & 全アクション公開。
   * 4. バージョンが上がると別バージョン用キーになるため、旧バージョン情報は新バージョンでは参照されない
   *    (ゲームバランス変更に伴う再収集を許容)。必要ならマイグレーションを将来実装可能。
   */
  const exposedIds = loadExposedCharactors();
  const observedMap = loadObservedActionsMap();
  if (exposedIds.includes(e.id)) {
    markCharactorExposed(e.id);
    addObservedActions(e.id, e.actions.slice());
  }

  const postExposedIds = loadExposedCharactors();
  if (postExposedIds.includes(e.id)) {
    e.isExposed = true;
    return e;
  }

  // Partial knowledge
  if (observedMap[e.id]) {
    e.observedActions = observedMap[e.id].slice();
  }
  return e;
}

function ensureFloorLayout(floorIndex: number, state?: GameState): FloorLayout {
  const layout = getOrCreateFloorLayout(floorIndex);
  if (state) state.floorLayout = layout;
  return layout;
}

function initState(): GameState {
  const highest = Number(localStorage.getItem(HIGH_KEY) || '0');
  const compRepo = createCompanionRepository();
  const companions = compRepo.list();
  const floorIndex = 1;
  const layout = ensureFloorLayout(floorIndex);
  return {
    floorIndex,
    stepIndex: 1,
    phase: companions.length > 0 ? 'companion_select' : 'progress',
    player: basePlayer(),
    playerNameCommitted: false,
    companionCandidates: companions,
    allies: [],
    enemies: [],
    selectedEnemyIndex: undefined,
    log: [{ message: 'ゲーム開始', kind: 'system' }],
    highestFloor: highest,
    actionOffer: [],
    actionUseCount: 0,
    playerUsedActions: [],
    insightRewardActions: [],
    floorLayout: layout
  };
}

export const gameState = writable<GameState>(initState());
gameState.subscribe((s) => setLogState(s));

export function restart() {
  const s = initState();
  resetDisplayLogs();
  gameState.set(s);
}

export function selectCompanion(state: GameState, id: string) {
  if (state.phase !== 'companion_select') return;
  const target = state.companionCandidates?.find((c) => c.id === id);
  if (!target) return;
  // スナップショットを Actor 化 (ally)
  const ally: Actor = {
    id: target.id,
    side: 'player',
    kind: 'player',
    name: target.name,
    STR: target.STR,
    CON: target.CON,
    POW: target.POW,
    DEX: target.DEX,
    APP: target.APP,
    INT: target.INT,
    hp: 0,
    statuses: [],
    physDamageCutRate: 0,
    psyDamageCutRate: 0,
    physDamageUpRate: 0,
    psyDamageUpRate: 0,
    actions: [...target.actions],
    maxActionsPerTurn: target.maxActionsPerTurn
  };
  ally.hp = calcMaxHP(ally);
  state.allies.push(ally);
  state.phase = 'progress';
  pushLog(`仲間 ${ally.name} を迎え入れた`, 'system');
  commit(state);
}

export function skipCompanionSelection(state: GameState) {
  if (state.phase !== 'companion_select') return;
  state.phase = 'progress';
  pushLog('仲間選択をスキップ', 'system');
  commit(state);
}

export function commitPlayerName(newName: string) {
  const trimmed = (newName || '').trim();
  if (!trimmed) return;
  gameState.update((s) => {
    s.player.name = trimmed;
    s.player = { ...s.player };
    s.playerNameCommitted = true;
    pushLog(`プレイヤー名を「${trimmed}」に設定`, 'system');
    return { ...s };
  });
}

function commit(state: GameState) {
  gameState.set({
    ...state,
    player: { ...state.player },
    allies: state.allies.map((a) => ({ ...a })),
    enemies: state.enemies.map((e) => ({ ...e })),
    log: [...state.log]
  });
}

function resyncFromStore(state: GameState) {
  Object.assign(state, get(gameState));
}

/**
 * プレイヤー現在値を CompanionRepository へ保存する共通処理。
 * ゲームオーバー/勝利双方で呼び出し。
 * 失敗してもゲーム進行へ影響しない。
 */
function savePlayerAsCompanion(state: GameState) {
  try {
    const repo = createCompanionRepository();
    const snap: Character = {
      id: String(Date.now()),
      name: state.player.name,
      STR: state.player.STR,
      CON: state.player.CON,
      POW: state.player.POW,
      DEX: state.player.DEX,
      APP: state.player.APP,
      INT: state.player.INT,
      maxActionsPerTurn: state.player.maxActionsPerTurn,
      actions: [...state.player.actions]
    };
    repo.add(snap);
    pushLog(` ${state.player.name} を仲間にした`, 'system');
  } catch (e) {
    console.warn('companion save failed', e);
  }
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
  pushLog(`進行: 階層${state.floorIndex} - ${state.stepIndex}`, 'system');
}

function advanceToNextAvailableStep(state: GameState) {
  const layout = ensureFloorLayout(state.floorIndex, state);
  if (!layout) return;
  const stepsWithNodes = layout.steps
    .filter((s) => s.nodes.length > 0)
    .map((s) => s.stepIndex)
    .sort((a, b) => a - b);
  if (stepsWithNodes.length === 0) {
    // 進めるノードが無い: そのまま (階層進行は progress ノードのみ)
    pushLog('進行可能なノードがありません', 'system');
    commit(state);
    return;
  }
  // 現在より大きい stepIndex の中で最小を探し、無ければ最小にラップ
  const next = stepsWithNodes.find((idx) => idx > state.stepIndex) ?? stepsWithNodes[0];
  state.stepIndex = next;
  state.phase = 'progress';
  logProgress(state);
  commit(state);
}

export function nextProgress(state: GameState) {
  advanceToNextAvailableStep(state);
}

function handleFloorTransition(state: GameState) {
  // Victory 条件 (仮上限 11 以降で勝利)
  if (state.floorIndex >= 11) {
    state.phase = 'victory';
    pushLog('全階層を踏破! 勝利!', 'system');
    savePlayerAsCompanion(state);
    if (state.highestFloor < state.floorIndex) {
      state.highestFloor = state.floorIndex;
      localStorage.setItem(HIGH_KEY, String(state.highestFloor));
    }
    commit(state);
    return;
  }
  state.stepIndex = 1;
  ensureFloorLayout(state.floorIndex, state);
  state.phase = 'progress';
  logProgress(state);
  commit(state);
}

export function chooseNode(state: GameState, node: FloorNode) {
  // ノード消費: 現在ステップから削除
  const layout = state.floorLayout;
  if (layout) {
    const step = layout.steps.find((s) => s.stepIndex === state.stepIndex);
    if (step) {
      step.nodes = step.nodes.filter((n) => n.id !== node.id);
    }
  }
  const kind = node.kind;
  if (kind === 'normal' || kind === 'elite' || kind === 'boss') {
    const enemyKind: 'normal' | 'elite' | 'boss' =
      kind === 'elite' ? 'elite' : kind === 'boss' ? 'boss' : 'normal';
    state.enemies = [createEnemy(enemyKind, state.floorIndex)];
    state.selectedEnemyIndex = 0;
    state.currentEncounterKind = enemyKind;
    state.phase = 'combat';
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
  } else if (kind === 'reward') {
    // 即時報酬ノード (戦闘なし) 将来拡張用: 現状イベント扱い
    state.phase = 'event';
    pushLog('報酬ノード(未実装) - placeholder', 'system');
  } else if (kind === 'progress') {
    // 階層進行
    state.floorIndex += 1;
    handleFloorTransition(state);
    return;
  }
  commit(state);
}

export async function combatAction(state: GameState, id: Action) {
  if (state.phase !== 'combat') return;
  if (!state.actionOffer.includes(id)) return;
  if (state.playerUsedActions && state.playerUsedActions.includes(id)) return;
  let target = state.enemies.find((e) => e.hp > 0);
  if (
    state.selectedEnemyIndex !== undefined &&
    state.enemies[state.selectedEnemyIndex] &&
    state.enemies[state.selectedEnemyIndex].hp > 0
  ) {
    target = state.enemies[state.selectedEnemyIndex];
  }
  const isCritical = state.actionOffer[0] === id;
  performAction(state, state.player, target, id, { isCritical });
  state.player = { ...state.player };
  state.enemies = state.enemies.map((e) => ({ ...e }));
  state.actionUseCount += 1;
  state.playerUsedActions?.push(id);
  commit(state);
  await waitForAnimationsComplete();
  resyncFromStore(state);
  removeDeadActors(state);
  if (state.enemies.length === 0 && state.phase !== 'combat') {
    commit(state);
    return;
  }
  if (id === 'Insight') {
    const enemy0 = state.enemies[0];
    if (enemy0) {
      const allActs = enemy0.actions.slice();
      enemy0.observedActions = allActs.slice();
      enemy0.isExposed = true;
      markCharactorExposed(enemy0.id);
      addObservedActions(enemy0.id, allActs);
      state.insightRewardActions = Array.from(
        new Set([...(state.insightRewardActions || []), ...allActs])
      );
    }
    commit(state);
  }
  if (state.actionUseCount >= state.player.maxActionsPerTurn) {
    await alliesTurn(state);
    if (state.phase !== 'combat') {
      commit(state);
      return;
    }
    await enemiesTurn(state);
    if (state.phase === 'combat') {
      resyncFromStore(state);
      const ok = startTurn(state);
      if (!ok) {
        commit(state);
        return;
      }
      await waitForAnimationsComplete();
      resyncFromStore(state);
    }
  }
  commit(state);
}

async function alliesTurn(state: GameState) {
  for (const ally of state.allies.filter((a: Actor) => a.hp > 0)) {
    const acted: Action[] = [];
    const maxActs = ally.maxActionsPerTurn;
    for (let i = 0; i < maxActs; i++) {
      const candidates = ally.actions.filter((a: Action) => !acted.includes(a));
      if (candidates.length === 0) break;
      const act = candidates[Math.floor(Math.random() * candidates.length)];
      acted.push(act);
      const target = state.enemies.find((e) => e.hp > 0);
      performAction(state, ally, target, act);
      commit(state);
      await waitForAnimationsComplete();
      resyncFromStore(state);
      removeDeadActors(state);
      if (state.enemies.length === 0) break;
    }
    if (state.enemies.length === 0) break;
  }
}

async function enemiesTurn(state: GameState) {
  for (const enemy of state.enemies.filter((e: Actor) => e.hp > 0)) {
    tickStatusesTurnStart(enemy);
    if (enemy.hp <= 0) {
      pushLog('敵を継続ダメージで倒した!', 'combat');
      removeDeadActors(state);
      if (state.phase !== 'combat') {
        commit(state);
        return;
      }
    }
  }
  for (const enemy of state.enemies.filter((e: Actor) => e.hp > 0)) {
    const acted: Action[] = [];
    const maxActs = enemy.maxActionsPerTurn;
    for (let i = 0; i < maxActs; i++) {
      const candidates = enemy.actions.filter((a: Action) => !acted.includes(a));
      if (candidates.length === 0) break;
      const act = candidates[Math.floor(Math.random() * candidates.length)];
      acted.push(act);
      const livingAllies: Actor[] = [state.player, ...state.allies].filter((a) => a.hp > 0);
      const target = livingAllies[Math.floor(Math.random() * livingAllies.length)];
      performAction(state, enemy, target, act);
      commit(state);
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
    // プレイヤーを仲間候補として保存
    savePlayerAsCompanion(state);
  }
}

function removeDeadActors(state: GameState) {
  const before = state.enemies.length;
  state.enemies = state.enemies.filter((e: Actor) => e.hp > 0);
  if (before > 0 && state.enemies.length === 0) {
    state.selectedEnemyIndex = undefined;
    const kind = state.currentEncounterKind ?? 'normal';
    state.phase = 'progress';
    prepareReward(state, kind);
  }
  state.allies = state.allies.filter((a: Actor) => a.hp > 0);
}

/**
 * プレイヤーターン開始処理。
 * @returns boolean プレイヤーが行動可能なら true / ゲームオーバーなら false
 */
function startTurn(state: GameState) {
  const actors: Actor[] = [state.player, ...state.allies];
  let playerDead = false;
  for (const actor of actors) {
    tickStatusesTurnStart(actor);
    if (actor.hp <= 0) {
      if (actor === state.player) {
        playerDead = true;
        state.phase = 'gameover';
        pushLog('毒で倒れた...', 'system');
        // ゲームオーバー時プレイヤーを仲間候補として保存
        savePlayerAsCompanion(state);
        break; // 以降の味方 tick は不要
      } else {
        // 味方死亡: ログのみ。ループは続行し他の味方やプレイヤーを処理。
        pushLog('味方が継続ダメージで倒れた...', 'combat');
      }
    }
  }

  // 死亡味方の除去 (ループ後にまとめて反映)
  state.allies = state.allies.filter((a: Actor) => a.hp > 0);

  if (playerDead) {
    commit(state);
    return false;
  }

  if (state.phase === 'combat') rollActions(state);
  state.actionUseCount = 0;
  state.playerUsedActions = [];
  state.player = { ...state.player };
  state.allies = state.allies.map((a) => ({ ...a }));
  state.enemies = state.enemies.map((e) => ({ ...e }));
  commit(state);
  return true;
}

function prepareReward(state: GameState, defeatedKind: 'normal' | 'elite' | 'boss') {
  const opts = getRewardsForEnemy(state, defeatedKind);
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
  state.insightRewardActions = [];
  state.phase = 'progress';
  state.rewardOptions = undefined;
  state.rewardIsBoss = false;
  // 次の利用可能ステップへ (循環 + 空ステップスキップ)
  advanceToNextAvailableStep(state);
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
  // rest ノードも消費済みなので次へ
  advanceToNextAvailableStep(state);
}
