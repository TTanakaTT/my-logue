import type { EventDef } from '../entities/events';
import { pushLog, createEnemy, rollActions } from '../state/state';
import { calcMaxHP } from '../services/stats';

export const events: EventDef[] = [
  {
    id: 'risk_reward',
    name: '血の儀式',
    description: 'HPを10失い STR+2',
    apply: (state) => {
      state.player.hp -= 10;
      state.player.STR += 2;
      pushLog(state, `儀式でSTR+2 しかしHP-10`, 'event');
      if (state.player.hp <= 0) pushLog(state, '儀式で倒れた...', 'event');
    }
  },
  {
    id: 'safe_heal',
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
  {
    id: 'early_boss',
    name: '歪んだ裂け目',
    description: '階層スキップして次階層ボスへ',
    apply: (state) => {
      pushLog(state, '裂け目に飛び込みボスへ', 'event');
      state.stepIndex = 4;
      state.enemy = createEnemy('boss', state.floorIndex);
      state.phase = 'combat';
      rollActions(state);
      pushLog(state, 'ボス戦開始!(裂け目)', 'combat');
    }
  }
];

export function randomEvent(): EventDef {
  return events[Math.floor(Math.random() * events.length)];
}
