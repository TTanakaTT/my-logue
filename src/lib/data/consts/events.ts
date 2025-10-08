import type { EventDef } from '$lib/domain/entities/events';
import { createEnemy, rollActions } from '$lib/domain/services/state_service';
import { pushLog } from '$lib/presentation/utils/log_util';
import { awardRandomMineral } from '$lib/domain/services/mineral_service';
import { calcMaxHP } from '$lib/domain/services/attribute_service';

// PascalCase キー & id 削除
export const events = {
  RiskReward: {
    name: '血の儀式',
    description: 'HPを10失い ランダムな鉱石を得る',
    apply: (state) => {
      state.player.hp -= 10;
      const id = awardRandomMineral(state.player);
      if (id) pushLog(`儀式で鉱石を得た しかしHP-10`, 'event');
      else pushLog(`儀式でHP-10 (鉱石は増えなかった)`, 'event');
      if (state.player.hp <= 0) pushLog('儀式で倒れた...', 'event');
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
      pushLog(`泉で${state.player.hp - before}回復 (${state.player.hp}/${max})`, 'event');
    }
  },
  CombatElite: {
    name: '戦慄の咆哮',
    description: '即座に精鋭と戦闘する',
    apply: (state) => {
      pushLog('精鋭が現れた!', 'event');
      // 現在のステップを変えずそのまま elite 戦へ移行（複数対応）
      state.enemies = [createEnemy('elite', state.floorIndex)];
      state.currentEncounterKind = 'elite';
      state.phase = 'combat';
      rollActions(state);
      pushLog('精鋭戦開始!(イベント)', 'combat');
    }
  }
} satisfies Record<string, EventDef>;

export type EventId = keyof typeof events;
