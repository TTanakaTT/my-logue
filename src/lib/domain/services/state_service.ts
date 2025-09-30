import { writable, get } from 'svelte/store';
import type { GameState, RewardOption } from '$lib/domain/entities/battle_state';
import type { Player, Actor, StatKey } from '$lib/domain/entities/character';
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
import type { CompanionSnapshot } from '$lib/domain/entities/companion';

const HIGH_KEY = 'mylogue_highest_floor';
const ENEMY_REVEAL_KEY_PREFIX = 'mylogue_enemy_revealed_';
const ENEMY_REVEALINFO_KEY_PREFIX = 'mylogue_enemy_revealinfo_';

interface RevealInfoPersisted {
  actions: Action[];
  revealedAttributes?: Record<string, boolean>;
}

function loadRevealedActions(kind: string, floor: number): Action[] | undefined {
  const key = `${ENEMY_REVEAL_KEY_PREFIX}${kind}_${floor}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Action[];
  } catch (e) {
    console.warn('Failed to parse legacy revealedActions', e);
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
    console.warn('Failed to parse revealInfo', e);
  }
  return undefined;
}

export function persistRevealedActions(kind: string, floor: number, actions: Action[]) {
  try {
    localStorage.setItem(
      `${ENEMY_REVEAL_KEY_PREFIX}${kind}_${floor}`,
      JSON.stringify(actions.slice().sort())
    );
  } catch (e) {
    console.warn('Failed to persist revealedActions', e);
  }
}
export function persistRevealInfo(kind: string, floor: number, enemy: Actor) {
  try {
    const data: RevealInfoPersisted = {
      actions: (enemy.revealedActions || []).slice().sort(),
      revealedAttributes: enemy.revealed ? { ...enemy.revealed } : undefined
    };
    localStorage.setItem(`${ENEMY_REVEALINFO_KEY_PREFIX}${kind}_${floor}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to persist revealInfo', e);
  }
}

export function recalcPlayer(p: Player) {
  const max = calcMaxHP(p);
  if (p.hp > max) p.hp = max;
}

function basePlayer(): Player {
  const p = buildPlayerFromCsv();
  p.name = randomName();
  p.hp = calcMaxHP(p);
  return p;
}

export function createEnemy(kind: 'normal' | 'elite' | 'boss', floorIndex: number): Actor {
  const e = buildEnemyFromCsv(kind, floorIndex);
  e.hp = calcMaxHP(e);
  const info = loadRevealInfo(kind, floorIndex);
  if (info) {
    e.revealedActions = info.actions.slice();
    if (info.revealedAttributes) {
      const allowed: StatKey[] = ['hp', 'CON', 'STR', 'POW', 'DEX', 'APP', 'INT'];
      const obj: Partial<Record<StatKey, boolean>> = {};
      for (const k of allowed) if (info.revealedAttributes[k]) obj[k] = true;
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
  const compRepo = createCompanionRepository();
  const companions = compRepo.list();
  return {
    floorIndex: 1,
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
    insightRewardActions: []
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
    maxActionsPerTurn: target.maxActionsPerTurn,
    maxActionChoices: target.maxActionChoices
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

export function rollActions(state: GameState) {
  const pool = state.player.actions;
  const limit = state.player.maxActionChoices;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.actionOffer = shuffled.slice(0, Math.min(limit, shuffled.length));
  state.actionUseCount = 0;
  state.playerUsedActions = [];
}

function logProgress(state: GameState) {
  pushLog(`進行: 階層${state.floorIndex} - ${state.stepIndex}/5`, 'system');
}

export function nextProgress(state: GameState) {
  if (state.stepIndex === 5) {
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog('全階層を踏破! 勝利!', 'system');
      if (state.highestFloor < 10) {
        state.highestFloor = 10;
        localStorage.setItem(HIGH_KEY, String(state.highestFloor));
      }
      commit(state);
      return;
    }
    state.stepIndex = 1;
    logProgress(state);
  }
  state.phase = 'progress';
  logProgress(state);
  commit(state);
}

export function chooseNode(state: GameState, kind: 'combat' | 'event' | 'rest' | 'boss') {
  if (kind === 'combat' || kind === 'boss') {
    const enemyKind: 'normal' | 'elite' | 'boss' =
      kind === 'boss' ? 'boss' : state.stepIndex === 4 ? 'elite' : 'normal';
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
  if (id === 'Reveal') {
    const enemy0 = state.enemies[0];
    if (enemy0) {
      const allActs = enemy0.actions.slice();
      const uniq = Array.from(new Set([...(enemy0.insightActions || []), ...allActs]));
      enemy0.insightActions = uniq;
      state.insightRewardActions = Array.from(
        new Set([...(state.insightRewardActions || []), ...uniq])
      );
      persistRevealInfo(enemy0.kind, state.floorIndex, enemy0);
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
      state.player.score += 1;
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
    // ゲームオーバー時プレイヤーを仲間候補として保存
    try {
      const repo = createCompanionRepository();
      const snap: CompanionSnapshot = {
        id: String(Date.now()),
        name: state.player.name,
        STR: state.player.STR,
        CON: state.player.CON,
        POW: state.player.POW,
        DEX: state.player.DEX,
        APP: state.player.APP,
        INT: state.player.INT,
        maxActionsPerTurn: state.player.maxActionsPerTurn,
        maxActionChoices: state.player.maxActionChoices,
        actions: [...state.player.actions]
      };
      repo.add(snap);
      pushLog(` ${state.player.name} を仲間にした`, 'system');
    } catch (e) {
      // 失敗してもゲーム進行は継続
      console.warn('companion save failed', e);
    }
  }
}

function removeDeadActors(state: GameState) {
  const before = state.enemies.length;
  state.enemies = state.enemies.filter((e: Actor) => e.hp > 0);
  if (before > 0 && state.enemies.length === 0) {
    state.selectedEnemyIndex = undefined;
    const kind = state.currentEncounterKind ?? 'normal';
    state.phase = 'progress';
    if (kind === 'boss') prepareReward(state, 'boss');
    else {
      state.stepIndex += 1;
      prepareReward(state, kind);
    }
  }
  state.allies = state.allies.filter((a: Actor) => a.hp > 0);
}

function startTurn(state: GameState) {
  const actors: Actor[] = [state.player, ...state.allies];
  for (const actor of actors) {
    tickStatusesTurnStart(actor);
    if (actor.hp <= 0) {
      if (actor === state.player) {
        state.phase = 'gameover';
        pushLog('毒で倒れた...', 'system');
        // ゲームオーバー時プレイヤーを仲間候補として保存
        try {
          const repo = createCompanionRepository();
          const snap: CompanionSnapshot = {
            id: String(Date.now()),
            name: state.player.name,
            STR: state.player.STR,
            CON: state.player.CON,
            POW: state.player.POW,
            DEX: state.player.DEX,
            APP: state.player.APP,
            INT: state.player.INT,
            maxActionsPerTurn: state.player.maxActionsPerTurn,
            maxActionChoices: state.player.maxActionChoices,
            actions: [...state.player.actions]
          };
          repo.add(snap);
          pushLog(` ${state.player.name} を仲間にした`, 'system');
        } catch (e) {
          console.warn('companion save failed', e);
        }
      } else {
        pushLog('味方が継続ダメージで倒れた...', 'combat');
        state.allies = state.allies.filter((a: Actor) => a.hp > 0);
      }
      commit(state);
      return false;
    }
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
  if (state.rewardIsBoss) {
    state.floorIndex += 1;
    if (state.floorIndex >= 10) {
      state.phase = 'victory';
      pushLog('全階層を踏破! 勝利!', 'system');
      if (state.highestFloor < 10) {
        state.highestFloor = 10;
        localStorage.setItem(HIGH_KEY, String(state.highestFloor));
      }
      commit(state);
      return;
    }
    state.stepIndex = 1;
    logProgress(state);
    state.phase = 'progress';
  } else {
    state.phase = 'progress';
  }
  state.rewardOptions = undefined;
  state.rewardIsBoss = false;
  logProgress(state);
  commit(state);
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
  commit(state);
}
