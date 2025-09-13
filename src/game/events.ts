import type { EventDef } from './types';
import { pushLog, createEnemy, rollActions } from './state';

export const events: EventDef[] = [
  {
    id: 'risk_reward',
    name: '血の儀式',
    description: 'HPを10失い攻撃力+2',
    apply: (state) => {
      state.player.hp -= 10;
      state.player.attack += 2;
      pushLog(state, '儀式で攻撃力+2 しかしHP-10', 'event');
      if (state.player.hp <= 0) pushLog(state, '儀式で倒れた...', 'event');
    }
  },
  {
    id: 'safe_heal',
    name: '静寂の泉',
    description: '最大HPの30%回復',
    apply: (state) => {
      const heal = Math.max(1, Math.floor(state.player.maxHP * 0.3));
      const before = state.player.hp;
      state.player.hp = Math.min(state.player.maxHP, state.player.hp + heal);
      pushLog(state, `泉で${state.player.hp - before}回復`, 'event');
    }
  },
  {
    id: 'early_boss',
    name: '歪んだ裂け目',
    description: '階層スキップして次階層ボスへ',
    apply: (state) => {
      // 次階層ボス戦へ直行するが floorIndex は撃破時に進むためここでは進めない
      pushLog(state, '裂け目に飛び込みボスへ', 'event');
      state.stepIndex = 4; // ボスステップへジャンプ
      // 直接ボス戦開始状態に遷移
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
