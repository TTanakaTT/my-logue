import type { EventDef } from '$lib/domain/entities/events';
import { pushLog, createEnemy, rollActions } from '$lib/domain/state/state';
import { calcMaxHP } from '$lib/domain/services/stats';

// PascalCase キー & id 削除
export const events = {
  RiskReward: {
    name: '血の儀式',
    description: 'HPを10失い STR+2',
    apply: (state) => {
      state.player.hp -= 10;
      state.player.STR += 2;
      pushLog(state, `儀式でSTR+2 しかしHP-10`, 'event');
      if (state.player.hp <= 0) pushLog(state, '儀式で倒れた...', 'event');
    }
  },
  SafeHeal: {
    name: '静寂の泉',
    description: '最大HPの30%回復',
    apply: (state) => {
      const max = calcMaxHP(state.player);
      const heal = Math.max(1, Math.floor(max * 0.3));
      const before = state.player.hp;
      state.player.hp = Math.min(max, state.player.hp + heal);
      pushLog(state, `泉で${state.player.hp - before}回復 (${state.player.hp}/${max})`, 'event');
    }
  },
  CombatElite: {
    name: '戦慄の咆哮',
    description: '即座に精鋭と戦闘する',
    apply: (state) => {
      pushLog(state, '精鋭が現れた!', 'event');
      // 現在のステップを変えずそのまま elite 戦へ移行
      state.enemy = createEnemy('elite', state.floorIndex);
      state.phase = 'combat';
      rollActions(state);
      pushLog(state, '精鋭戦開始!(イベント)', 'combat');
    }
  }
} satisfies Record<string, EventDef>;

export type EventId = keyof typeof events;
