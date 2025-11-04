import type { ActionDef } from '$lib/domain/entities/action';
import { heal } from '$lib/domain/services/attribute_service';
import { applyPhysicalDamage, applyPsychicDamage } from '$lib/domain/services/damage_service';
import { addStatus } from '$lib/data/consts/statuses';
import { isEnemy } from '$lib/domain/entities/character';

export const action = {
  Strike: {
    name: 'ストライク',
    icon: 'destruction',
    description: 'STRで相手に攻撃 (クリティカル: ダメージ2倍)',
    normalLog: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return `${target.name}に${actor.characterAttributes.STR}の力で攻撃！`;
    },
    criticalLog: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return `クリティカル！${target.name}に${actor.characterAttributes.STR * 2}の力で強打！`;
    },
    normalAction: ({ actor, target }) => {
      if (target) applyPhysicalDamage(actor, target, actor.characterAttributes.STR);
    },
    criticalAction: ({ actor, target }) => {
      if (target) applyPhysicalDamage(actor, target, actor.characterAttributes.STR * 2);
    }
  },
  Curse: {
    name: '呪う',
    icon: 'skull',
    description: 'POWで相手に攻撃 (クリティカル: ダメージ2倍)',
    cooldownTurns: 1,
    normalLog: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return `${actor.characterAttributes.POW}の精神力で呪った！${target.name}は${target.characterAttributes.POW}÷2の精神力で抵抗した！`;
    },
    criticalLog: ({ actor, target }) => {
      if (!target) return '攻撃対象はもういない...';
      return `クリティカル呪詛！${actor.characterAttributes.POW * 2}の精神力で${target.name}を苛んだ！`;
    },
    normalAction: ({ actor, target }) => {
      if (target) applyPsychicDamage(actor, target, actor.characterAttributes.POW);
    },
    criticalAction: ({ actor, target }) => {
      if (target) applyPsychicDamage(actor, target, actor.characterAttributes.POW * 2);
    }
  },
  Guard: {
    name: 'ガード',
    icon: 'shield',
    description: '次のターンまでダメージ半減 (クリティカル: 75%カット)',
    normalLog: () => '防御態勢を取った！',
    criticalLog: () => 'クリティカル防御！完璧な構えで身を固めた！',
    normalAction: ({ actor }) => {
      addStatus(actor, 'Guard');
    },
    criticalAction: ({ actor }) => {
      addStatus(actor, 'Guard');
      addStatus(actor, 'Guard');
    }
  },
  FirstAid: {
    name: '応急処置',
    icon: 'healing',
    description: 'DEXで自分に応急処置 (クリティカル: 回復量2倍)',
    normalLog: ({ actor }) => `${actor.characterAttributes.DEX}の器用さで応急処置を行なった。`,
    criticalLog: ({ actor }) =>
      `クリティカル応急！${actor.characterAttributes.DEX * 2}の効果で素早く処置した。`,
    normalAction: ({ actor }) => {
      heal(actor, actor.characterAttributes.DEX);
    },
    criticalAction: ({ actor }) => {
      heal(actor, actor.characterAttributes.DEX * 2);
    }
  },
  Poison: {
    name: 'ポイズンダート',
    icon: 'dew_point',
    description: '敵に毒 (3ターン) を付与 (クリティカル: 2スタック付与)',
    normalLog: () => '毒を投げた',
    criticalLog: () => 'クリティカルヒット！濃い毒を浴びせた！',
    normalAction: ({ target }) => {
      if (!target) return;
      addStatus(target, 'Poison');
    },
    criticalAction: ({ target }) => {
      if (!target) return;
      addStatus(target, 'Poison');
      addStatus(target, 'Poison');
    }
  },
  Insight: {
    name: '洞察',
    icon: 'insights',
    description: '相手を洞察し見切りを付与(物理/精神与ダメ-30%) (クリティカル: 物理/精神与ダメ-51%',
    normalLog: ({ target }) => {
      if (!target) return '対象はもういない...';
      return `${target.name}の情報を詳細に洞察し、攻撃の癖を見切った。`;
    },
    criticalLog: ({ target }) => {
      if (!target) return '対象はもういない...';
      return `鋭い洞察！${target.name}の行動パターンまでも看破し完全に見切った。`;
    },
    normalAction: ({ target }) => {
      if (!target) return;

      if (isEnemy(target)) target.isExposed = true;

      addStatus(target, 'Mikiri');
    },
    criticalAction: ({ target }) => {
      if (!target) return;

      if (isEnemy(target)) target.isExposed = true;

      addStatus(target, 'Mikiri');
      addStatus(target, 'Mikiri');
    }
  }
} satisfies Record<string, ActionDef>;
