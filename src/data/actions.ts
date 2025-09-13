import type { ActionDef } from '../game/types';
import { calcMaxHP } from '../game/stats';
import { emitActionLog, applyDamage } from '../game/actionUtils';

export const actions: ActionDef[] = [
  {
    id: 'strike',
    name: 'ストライク',
    description: '基本攻撃: 6 + (攻撃=STR+バフ)',
    logTemplate: '{actor}が{target}に素早く攻撃！ 6 + 攻撃 = {calc} => {result}ダメージ!',
    computeFormula: ({ actor }) => {
      const result = 6 + actor.STR;
      return { result, calc: `6 + ${actor.STR} = ${result}` };
    },
    execute: (state, { actor, target }) => {
      const def = actions.find((a) => a.id === 'strike')!;
      const baseFormula = def.computeFormula?.({ actor, target, state });
      let finalFormula = baseFormula;
      if (baseFormula && target) {
        const applied = applyDamage(state, actor, target, baseFormula.result);
        if (applied !== undefined && applied !== baseFormula.result) {
          finalFormula = {
            ...baseFormula,
            calc: baseFormula.calc + ` (半減後:${applied})`,
            result: applied
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
      const add = Math.floor(actor.STR * 0.5);
      const result = 12 + add;
      return {
        result,
        calc: `12 + floor(${actor.STR}*0.5=${(actor.STR * 0.5).toFixed(1)})(${add}) = ${result}`
      };
    },
    execute: (state, { actor, target }) => {
      const def = actions.find((a) => a.id === 'heavy')!;
      const baseFormula = def.computeFormula?.({ actor, target, state });
      let finalFormula = baseFormula;
      if (baseFormula && target) {
        const applied = applyDamage(state, actor, target, baseFormula.result);
        if (applied !== undefined && applied !== baseFormula.result) {
          finalFormula = {
            ...baseFormula,
            calc: baseFormula.calc + ` (半減後:${applied})`,
            result: applied
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
      if (formula) actor.hp = formula.result;
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
      actor.STR += 1;
      emitActionLog(state, actor, undefined, def, formula);
    }
  }
];
