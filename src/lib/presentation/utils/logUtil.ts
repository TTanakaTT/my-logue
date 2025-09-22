import type { GameState, LogEntry } from '$lib/domain/entities/BattleState';
import type { Actor, ActorKind, ActorSide } from '$lib/domain/entities/Character';
import type { ActionDef } from '$lib/domain/entities/Action';
import { get, writable, type Writable } from 'svelte/store';

// ログ関連のユーティリティを集約
// 既存の pushLog / pushCombatLog / emitActionLog API は互換維持しつつ
// logUtil 名前空間的メソッドも提供

export const MAX_LOG_ENTRIES = 20;

// --- state 非依存化用内部ストア ---
let _currentState: GameState | undefined;

export function registerLogStateProvider(provider: () => GameState | undefined) {
  // 毎回 provider を呼ぶよりシンプルに直近状態参照を外部が更新する方式も可能だが
  // まずは provider 方式で柔軟性確保
  getState = provider;
}

let getState: () => GameState | undefined = () => _currentState;

// 明示的に状態を差し替えたいケース用（ゲーム初期化時など）
export function setLogState(state: GameState | undefined) {
  _currentState = state;
  // 初回購読時など、表示が空であれば既存ログからシード
  if (state) {
    const hasDisplay = get(_displayLogs).length > 0;
    if (!hasDisplay && !_running && _queue.length === 0 && state.log && state.log.length > 0) {
      seedInitialLogs(state);
    }
  }
}

// -----------------------------
// 表示用: タイプライタ/キュー
// -----------------------------

export type DisplayLogEntry = LogEntry & {
  id: number;
  shown: string; // 画面に出ている文字列（タイプライタ進行中）
  done: boolean; // 表示完了フラグ
};

// 表示用のSvelteストア（UIはこれを購読して描画）
const _displayLogs: Writable<DisplayLogEntry[]> = writable([]);
export const displayLogs = { subscribe: _displayLogs.subscribe };

// ログ表示の内部キューとランナ
const _queue: LogEntry[] = [];
let _running = false;
let _idSeq = 1;

// 1件のログをタイプライタ表示する。完了まで次は開始しない。
async function runOne(entry: LogEntry) {
  const id = _idSeq++;
  const node: DisplayLogEntry = { ...entry, id, shown: '', done: false };
  // 最新を上に表示するため先頭に追加
  _displayLogs.update((arr) => {
    const next = [node, ...arr];
    return next.slice(0, MAX_LOG_ENTRIES);
  });

  const msg = entry.message ?? '';
  // 総表示時間: 文字数に応じて 0.3s〜1.0s に収める（40文字で上限付近）
  const MIN_TOTAL = 300; // ms
  const MAX_TOTAL = 1000; // ms
  const ratio = Math.min(1, msg.length / 40);
  const total = Math.round(MIN_TOTAL + (MAX_TOTAL - MIN_TOTAL) * ratio);

  if (msg.length === 0) {
    await delay(MIN_TOTAL);
  } else {
    // 長文でも総時間が必ず total(ms) 以下になるようtick分割
    const isMax = total >= MAX_TOTAL;
    const tickCount = isMax ? Math.min(msg.length, MAX_TOTAL) : msg.length;
    const charsPerTick = Math.ceil(msg.length / tickCount);
    const stepMs = Math.max(1, Math.floor(total / tickCount));
    for (let t = 1; t <= tickCount; t++) {
      const i = Math.min(msg.length, t * charsPerTick);
      await delay(stepMs);
      const shown = msg.slice(0, i);
      _displayLogs.update((arr) => arr.map((e) => (e.id === id ? { ...e, shown } : e)));
    }
  }
  // 完了（端数時間があればここで自然に吸収される）
  _displayLogs.update((arr) => arr.map((e) => (e.id === id ? { ...e, done: true } : e)));
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function enqueueForDisplay(entry: LogEntry) {
  _queue.push(entry);
  if (!_running) runQueue();
}

async function runQueue() {
  _running = true;
  try {
    while (_queue.length > 0) {
      const next = _queue.shift()!;
      await runOne(next);
    }
  } finally {
    _running = false;
  }
}

export function resetDisplayLogs() {
  _queue.length = 0;
  _running = false;
  _displayLogs.set([]);
}

// 初期状態など、既存の配列から表示を開始したいときに使う
export function seedInitialLogs(state: GameState) {
  // 表示は最新が先頭。state.logもunshift運用なので順序はそのまま使用。
  for (const entry of state.log.slice().reverse()) {
    // 末尾（古い）から順に投入し、最終的に最新が最後に開始される
    enqueueForDisplay(entry);
  }
}

function append(entry: LogEntry) {
  const state = getState();
  if (!state) return;
  state.log.unshift(entry);
  if (state.log.length > MAX_LOG_ENTRIES) state.log.pop();
  // 表示キューへ（表示順序もunshiftと一致させる）
  enqueueForDisplay(entry);
}

export function pushLog(message: string, kind: LogEntry['kind'] = 'system') {
  append({ message, kind });
}

export function pushCombatLog(message: string, side: ActorSide, actorKind?: ActorKind) {
  append({ message, kind: 'combat', side, actorKind });
}

export function emitActionLog(actor: Actor, target: Actor | undefined, def: ActionDef) {
  const state = getState();
  if (!state) return;
  const message = def.log ? def.log({ actor, target, state }) : undefined;
  if (!message) return;
  pushCombatLog(message, actor.side, actor.kind);
}

export const logUtil = {
  system: (message: string) => pushLog(message, 'system'),
  combat: (message: string, side?: ActorSide, actorKind?: ActorKind) =>
    side ? pushCombatLog(message, side, actorKind) : pushLog(message, 'combat'),
  event: (message: string) => pushLog(message, 'event'),
  rest: (message: string) => pushLog(message, 'rest'),
  action: emitActionLog,
  register: registerLogStateProvider,
  setState: setLogState,
  displayLogs,
  resetDisplayLogs,
  seedInitialLogs
};

export type LogUtil = typeof logUtil;
