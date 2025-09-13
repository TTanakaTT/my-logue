import type { ActionDef, GameState, Actor } from './types';
import { pushCombatLog } from './state';
import { calcAttack, calcMaxHP } from './stats';

// 共通ログ生成ユーティリティ
function emitActionLog(
  state: GameState,
  actor: Actor,
  target: Actor | undefined,
  def: ActionDef,
  formula: { result: number; calc: string } | undefined,
  extra?: string
) {
  if (!def.logTemplate && !extra) return;
  const actorName =
    actor === state.player
      ? 'プレイヤー'
      : state.enemy?.kind === 'boss' && actor === state.enemy
        ? 'ボス'
        : '敵';
  const targetName = target
    ? target === state.player
      ? 'プレイヤー'
      : state.enemy?.kind === 'boss' && target === state.enemy
        ? 'ボス'
        : '敵'
    : '';
  let base = def.logTemplate || '';
  if (base) {
    base = base
      .replace('{actor}', actorName)
      .replace('{target}', targetName)
      .replace('{calc}', formula?.calc ?? '')
      .replace('{result}', formula ? String(formula.result) : '');
  }
  const message = [base, extra].filter(Boolean).join(' ');
  const tag: 'player' | 'enemy' | 'boss' =
    actor === state.player
      ? 'player'
      : state.enemy && state.enemy.kind === 'boss' && actor === state.enemy
        ? 'boss'
        : 'enemy';
  pushCombatLog(state, message, tag);
}

function applyDamage(state: GameState, source: Actor, target: Actor | undefined, amount: number) {
  if (!target) return;
  let final = amount;
  if (target.guard) {
    final = Math.ceil(final / 2);
    target.guard = false; // 1回で解除
  }
  target.hp -= final;
  return final;
}

export const actions: ActionDef[] = [
  {
    id: 'strike',
    name: 'ストライク',
    description: '基本攻撃: 6 + (攻撃=STR+バフ)',
    logTemplate: '{actor}が{target}に素早く攻撃！ 6 + 攻撃 = {calc} => {result}ダメージ!',
    computeFormula: ({ actor }) => {
      const atk = calcAttack(actor);
      const result = 6 + atk;
      return { result, calc: `6 + ${atk} = ${result}` };
    },
    execute: (state, { actor, target }) => {
      const def = actions.find((a) => a.id === 'strike')!; // 自参照
      const baseFormula = def.computeFormula?.({ actor, target, state });
      let finalFormula = baseFormula;
      if (baseFormula && target) {
        const applied = applyDamage(state, actor, target, baseFormula.result);
        if (applied !== baseFormula.result) {
          finalFormula = {
            ...baseFormula,
            calc: baseFormula.calc + ` (半減後:${applied})`,
            result: applied as number
          };
        }
      }
      emitActionLog(
        state,
        actor,
        target,
        def,
        finalFormula,
        target ? `(残りHP:${target?.hp})` : undefined
      );
    }
  },
  {
    id: 'heavy',
    name: 'ヘビーブロー',
    description: '強攻撃: 12 + 攻撃*0.5 (次ターン出現しない)',
    cooldownTurns: 1,
    logTemplate: '{actor}が渾身の一撃！ 12 + (攻撃*0.5) = {calc} => {result}ダメージ!',
    computeFormula: ({ actor }) => {
      const atk = calcAttack(actor);
      const add = Math.floor(atk * 0.5);
      const result = 12 + add;
      return {
        result,
        calc: `12 + floor(${atk}*0.5=${(atk * 0.5).toFixed(1)})(${add}) = ${result}`
      };
    },
    execute: (state, { actor, target }) => {
      const def = actions.find((a) => a.id === 'heavy')!;
      const baseFormula = def.computeFormula?.({ actor, target, state });
      let finalFormula = baseFormula;
      if (baseFormula && target) {
        const applied = applyDamage(state, actor, target, baseFormula.result);
        if (applied !== baseFormula.result) {
          finalFormula = {
            ...baseFormula,
            calc: baseFormula.calc + ` (半減後:${applied})`,
            result: applied as number
          };
        }
      }
      emitActionLog(
        state,
        actor,
        target,
        def,
        finalFormula,
        target ? `(残りHP:${target?.hp})` : undefined
      );
    }
  },
  {
    id: 'guard',
    name: 'ガード',
    description: 'このターン受ける次のダメージ半減',
    logTemplate: '{actor}は身構えた！ 次の被ダメージ半減',
    execute: (state, { actor }) => {
      actor.guard = true;
      const def = actions.find((a) => a.id === 'guard')!;
      emitActionLog(state, actor, undefined, def, undefined);
    }
  },
  {
    id: 'recover',
    name: '回復',
    description: 'HP5回復',
    logTemplate: '{actor}は回復魔法！ {calc}回復 (HP:{result})',
    computeFormula: ({ actor }) => {
      const max = calcMaxHP(actor);
      const before = actor.hp;
      const heal = Math.min(5, max - before);
      const after = before + heal;
      return { result: after, calc: `${before} + ${heal} -> ${after}/${max}` };
    },
    execute: (state, { actor }) => {
      const def = actions.find((a) => a.id === 'recover')!;
      const formula = def.computeFormula?.({ actor, state });
      if (formula) actor.hp = formula.result; // result は最終HP
      emitActionLog(state, actor, undefined, def, formula);
    }
  },
  {
    id: 'poison',
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    logTemplate: '{actor}は毒を投げた！ {target}に毒(3x3ターン)付与',
    execute: (state, { actor, target }) => {
      if (!target) return;
      const list = target.dots;
      const existing = list.find((d) => d.id === 'poison');
      if (existing) existing.turns = 3;
      else list.push({ id: 'poison', damage: 3, turns: 3 });
      const def = actions.find((a) => a.id === 'poison')!;
      emitActionLog(state, actor, target, def, undefined);
    }
  },
  {
    id: 'powerup',
    name: 'パワーアップ',
    description: 'STR+1 永続 (派生攻撃上昇)',
    logTemplate: '{actor}の筋力が高まる！ STR+1 -> {calc}',
    computeFormula: ({ actor }) => {
      const before = actor.STR;
      const after = before + 1;
      return { result: after, calc: `${before} => ${after}` };
    },
    execute: (state, { actor }) => {
      const def = actions.find((a) => a.id === 'powerup')!;
      const formula = def.computeFormula?.({ actor, state });
      actor.STR += 1; // resultは後値
      emitActionLog(state, actor, undefined, def, formula);
    }
  }
];

export function getAction(id: string) {
  return actions.find((a) => a.id === id);
}
