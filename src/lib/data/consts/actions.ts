import type { ActionDef } from '$lib/domain/entities/action';
import { heal } from '$lib/domain/services/statsService';
import { applyPhysicalDamage, applyPsychicDamage } from '$lib/domain/services/damageService';

export const action = {
  Strike: {
    name: 'ストライク',
    description: 'STRで相手に攻撃',
    log: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return target.guard
        ? `${actor.STR}の力で攻撃！${target.name}は防御体制を取って、ダメージを半減させた！`
        : `${target.name}に${actor.STR}の力で攻撃！`;
    },
    execute: ({ actor, target }) => {
      if (target) {
        applyPhysicalDamage(actor, target, actor.STR);
      }
    }
  },
  Curse: {
    name: '呪う',
    description: 'POWで相手に攻撃',
    cooldownTurns: 1,
    log: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return `${actor.POW}の精神力で呪った！${target.name}は${target.POW}÷2の精神力で抵抗した！`;
    },
    execute: ({ actor, target }) => {
      if (target) {
        applyPsychicDamage(actor, target, actor.POW);
      }
    }
  },
  Guard: {
    name: 'ガード',
    description: '次のターンまでダメージ半減',
    log: () => '防御態勢を取った！',
    execute: ({ actor }) => {
      actor.guard = true;
    }
  },
  FirstAid: {
    name: '応急処置',
    description: 'DEXで自分に応急処置',
    log: ({ actor }) => `${actor.DEX}の器用さで応急処置を行なった。`,
    execute: ({ actor }) => {
      heal(actor, actor.DEX);
    }
  },
  Poison: {
    name: 'ポイズンダート',
    description: '敵に3ダメ/ターン (3ターン)',
    log: () => '毒を投げた',
    execute: ({ target }) => {
      if (!target) return;
      const list = target.dots;
      const existing = list.find((d) => d.id === 'poison');
      if (existing) existing.turns = 3;
      else list.push({ id: 'poison', damage: 3, turns: 3 });
    }
  },
  Reveal: {
    name: '洞察',
    description: '相手を洞察する',
    log: ({ target }) => {
      if (!target) return '対象はもういない...';
      return `${target.name}の情報を詳細に洞察した。`;
    },
    execute: ({ target }) => {
      if (!target) return;
      // ステータスを全て開示
      const nextRevealed = {
        ...(target.revealed || {}),
        hp: true,
        CON: true,
        STR: true,
        POW: true,
        DEX: true,
        APP: true,
        INT: true
      } as typeof target.revealed;
      target.revealed = nextRevealed;
      // アクションを全て開示
      const current = target.revealedActions ? [...target.revealedActions] : [];
      for (const id of target.actions) if (!current.includes(id)) current.push(id);
      target.revealedActions = current;
    }
  }
} satisfies Record<string, ActionDef>;
