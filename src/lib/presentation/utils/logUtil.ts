import type { GameState, LogEntry } from '$lib/domain/entities/BattleState';
import type { Actor, ActorKind, ActorSide } from '$lib/domain/entities/Character';
import type { ActionDef } from '$lib/domain/entities/Action';

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
}

function append(entry: Omit<LogEntry, 'timestamp'>) {
  const state = getState();
  if (!state) return;
  state.log.unshift(entry);
  if (state.log.length > MAX_LOG_ENTRIES) state.log.pop();
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
  setState: setLogState
};

export type LogUtil = typeof logUtil;
