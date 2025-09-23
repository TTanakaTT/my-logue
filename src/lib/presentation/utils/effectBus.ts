import type { Actor } from '$lib/domain/entities/Character';
import type { GameState } from '$lib/domain/entities/BattleState';
import { writable, derived, get } from 'svelte/store';
import { setLogState as _setLogState, getCurrentState } from '$lib/presentation/utils/logUtil';

// エフェクト種別
export type EffectKind =
  | 'strike_attacker'
  | 'strike_hit'
  | 'guard'
  | 'curse_cast'
  | 'poison_tick'
  | 'heal_flash';

export type FloatKind = 'damage' | 'heal';

export interface EffectEvent {
  id: number;
  panelKey: string; // 'player' | `ally-${i}` | `enemy-${i}`
  kind: EffectKind;
  until: number; // performance.now() の期限
}

export interface FloatingEvent {
  id: number;
  panelKey: string;
  kind: FloatKind;
  value: number;
  until: number;
}

const _effects = writable<EffectEvent[]>([]);
export const effects = { subscribe: _effects.subscribe };

const _floatings = writable<FloatingEvent[]>([]);
export const floatings = { subscribe: _floatings.subscribe };

// アニメーション中フラグ（カウンタで管理）
const _animCounter = writable(0);
export const uiAnimating = derived(_animCounter, (n) => n > 0);

let _seq = 1;

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// requestAnimationFrame は現在未使用

// （旧）期限切れ掃除ループは、setTimeout による個別解除へ切替済み

export function beginAnimation(durationMs: number) {
  _animCounter.update((c) => c + 1);
  // ダミー効果としてカウンタだけ管理しても良いが、共通化のため cleanupLoop に委譲
  setTimeout(
    () => {
      _animCounter.update((c) => Math.max(0, c - 1));
    },
    Math.max(1, durationMs)
  );
}

export function playEffectOnKey(panelKey: string, kind: EffectKind, durationMs = 600) {
  const e: EffectEvent = { id: _seq++, panelKey, kind, until: now() + durationMs };
  _effects.update((arr) => [...arr, e]);
  _animCounter.update((c) => c + 1);
  // 寿命経過で自動解除
  setTimeout(
    () => {
      _effects.update((arr) => arr.filter((x) => x.id !== e.id));
      _animCounter.update((c) => Math.max(0, c - 1));
    },
    Math.max(1, durationMs)
  );
}

export function showFloatingOnKey(
  panelKey: string,
  kind: FloatKind,
  value: number,
  durationMs = 900
) {
  const f: FloatingEvent = { id: _seq++, panelKey, kind, value, until: now() + durationMs };
  _floatings.update((arr) => [...arr, f]);
  _animCounter.update((c) => c + 1);
  setTimeout(
    () => {
      _floatings.update((arr) => arr.filter((x) => x.id !== f.id));
      _animCounter.update((c) => Math.max(0, c - 1));
    },
    Math.max(1, durationMs)
  );
}

// 現在の GameState から Actor の panelKey を推定（参照一致）
export function panelKeyForActor(actor: Actor): string | undefined {
  const state: GameState | undefined = getCurrentState();
  if (!state) return undefined;
  if (actor === state.player) return 'player';
  const ai = state.allies.findIndex((a) => a === actor);
  if (ai >= 0) return `ally-${ai}`;
  const ei = state.enemies.findIndex((e) => e === actor);
  if (ei >= 0) return `enemy-${ei}`;
  return undefined;
}

export function playEffectOnActor(actor: Actor, kind: EffectKind, durationMs = 600) {
  const key = panelKeyForActor(actor);
  if (!key) return;
  playEffectOnKey(key, kind, durationMs);
}

export function showDamage(actor: Actor, value: number, durationMs = 900) {
  const key = panelKeyForActor(actor);
  if (!key) return;
  showFloatingOnKey(key, 'damage', value, durationMs);
}

export function showHeal(actor: Actor, value: number, durationMs = 900) {
  const key = panelKeyForActor(actor);
  if (!key) return;
  showFloatingOnKey(key, 'heal', value, durationMs);
}

// アクションIDに応じた簡易エフェクト
export function triggerActionEffects(actor: Actor, target: Actor | undefined, actionId: string) {
  switch (actionId) {
    case 'Strike': {
      playEffectOnActor(actor, 'strike_attacker', 350);
      if (target) playEffectOnActor(target, 'strike_hit', 500);
      beginAnimation(500);
      break;
    }
    case 'Curse': {
      playEffectOnActor(actor, 'curse_cast', 350);
      if (target) playEffectOnActor(target, 'strike_hit', 450);
      beginAnimation(450);
      break;
    }
    case 'Guard': {
      playEffectOnActor(actor, 'guard', 600);
      beginAnimation(600);
      break;
    }
    default: {
      // 既定: 短いロック
      beginAnimation(300);
    }
  }
}

// logUtil に現在状態登録を依頼（stateServiceが既に setLogState を呼ぶため互換確保）
export const setEffectState = _setLogState;

// 全アニメーション完了まで待つ
export function waitForAnimationsComplete(timeoutMs = 1200): Promise<void> {
  return new Promise((resolve) => {
    // 既に未実行なら即解決（subscribe の即時コールで TDZ を避ける）
    if (!get(uiAnimating)) {
      resolve();
      return;
    }
    const unsub = uiAnimating.subscribe((busy) => {
      if (!busy) {
        // ここに来る頃には unsub は代入済み
        unsub?.();
        // レンダリング安定のため、極小遅延
        setTimeout(resolve, 0);
      }
    });
    // セーフティタイムアウト
    if (timeoutMs > 0) {
      setTimeout(() => {
        unsub?.();
        resolve();
      }, timeoutMs);
    }
  });
}
