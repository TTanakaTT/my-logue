<script lang="ts">
  import type { Actor } from '$lib/domain/entities/Character';
  import { calcMaxHP } from '$lib/domain/services/attributeService';
  export let actor: Actor;
  export let side: 'player' | 'enemy' = 'player';
  import { SvelteMap } from 'svelte/reactivity';

  type StatKey =
    | 'hp'
    | 'physUp'
    | 'physCut'
    | 'psyUp'
    | 'psyCut'
    | 'CON'
    | 'STR'
    | 'POW'
    | 'DEX'
    | 'APP'
    | 'INT';

  const order: {
    key: Exclude<StatKey, 'physUp' | 'physCut' | 'psyUp' | 'psyCut'>;
    label: string;
  }[] = [
    { key: 'hp', label: 'HP' },
    { key: 'CON', label: 'CON' },
    { key: 'STR', label: 'STR' },
    { key: 'POW', label: 'POW' },
    { key: 'DEX', label: 'DEX' },
    { key: 'APP', label: 'APP' },
    { key: 'INT', label: 'INT' }
  ];

  $: displayed = {
    hp: `${actor.hp}/${calcMaxHP(actor)}`,
    physUp: actor.physDamageUpRate,
    physCut: actor.physDamageCutRate,
    psyUp: actor.psyDamageUpRate,
    psyCut: actor.psyDamageCutRate,
    CON: actor.CON,
    STR: actor.STR,
    POW: actor.POW,
    DEX: actor.DEX,
    APP: actor.APP,
    INT: actor.INT
  };

  function valueFor(key: StatKey): string | number {
    switch (key) {
      case 'physUp':
      case 'physCut':
      case 'psyUp':
      case 'psyCut':
        return (displayed[key] * 100).toFixed(0) + '%';
    }
    const rev = actor.revealed?.[key];
    if (!rev) return '???';
    return displayed[key];
  }
  import { getAction } from '$lib/data/repositories/actionRepository';
  import TooltipBadge from './TooltipBadge.svelte';
  import { status } from '$lib/data/consts/statuses';
  import type { StatusInstance } from '$lib/domain/entities/Status';
  $: actionInfos = actor.actions.map((id) => {
    const def = getAction(id);
    const revealed = actor.side === 'enemy' ? actor.revealedActions?.includes(id) : true;
    return {
      id,
      revealed,
      name: revealed ? def?.name || id : '???',
      description: revealed ? def?.description : '???'
    };
  });

  // ステータス表示用グルーピング: id + 残ターン一致のみスタック数をまとめる
  interface GroupedStatus {
    status: StatusInstance;
    count: number;
  }
  $: groupedStatuses = (() => {
    const map = new SvelteMap<string, GroupedStatus>();
    for (const st of actor.statuses) {
      const key = `${st.id}:${st.remainingTurns ?? 'inf'}`;
      const ex = map.get(key);
      if (ex) ex.count += 1;
      else map.set(key, { status: st, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.status.id === b.status.id) {
        const ar = a.status.remainingTurns ?? 9999;
        const br = b.status.remainingTurns ?? 9999;
        return ar - br;
      }
      return a.status.id.localeCompare(b.status.id);
    });
  })();
</script>

<div
  class={`rounded-lg p-3 text-xs space-y-1 bg-neutral-800/40 border-2 shadow-sm w-3xs panel-side-${side}`}
>
  <div class="font-semibold mb-1 flex items-center gap-2">
    <span>{actor.name}</span>
  </div>
  <div class="flex flex-wrap gap-1 mb-1 min-h-4">
    {#each groupedStatuses as g (g.status.id + ':' + (g.status.remainingTurns ?? 'inf'))}
      {#if status[g.status.id]}
        {#if status[g.status.id].badgeClass}
          <TooltipBadge
            badgeClass={`${status[g.status.id].badgeClass} border px-1`}
            label={`${status[g.status.id].name}${g.count > 1 ? `x${g.count}` : ''}${g.status.remainingTurns !== undefined ? `(${g.status.remainingTurns})` : ''}`}
            description={status[g.status.id].description}
          />
        {:else}
          <TooltipBadge
            badgeClass="bg-gray-600/60 border border-gray-300 px-1"
            label={`${status[g.status.id].name}${g.count > 1 ? `x${g.count}` : ''}${g.status.remainingTurns !== undefined ? `(${g.status.remainingTurns})` : ''}`}
            description={status[g.status.id].description}
          />
        {/if}
      {:else}
        <TooltipBadge
          badgeClass="bg-gray-600/60 border border-red-400 px-1"
          label={g.status.id}
          description="未定義のステータス"
        />
      {/if}
    {/each}
  </div>
  <div class="flex flex-row flex-wrap gap-2">
    {#each order as o (o.key)}
      <div class="flex flex-col items-center">
        <span class="text-gray-400">{o.label}</span>
        <span>{valueFor(o.key)}</span>
      </div>
    {/each}
  </div>
  <div class="w-full flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <span class="text-gray-400">物理ダメージ</span>
      <span>UP {valueFor('physUp')}</span>
      <span class="text-gray-400">/</span>
      <span>CUT {valueFor('physCut')}</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-gray-400">精神ダメージ</span>
      <span>UP {valueFor('psyUp')}</span>
      <span class="text-gray-400">/</span>
      <span>CUT {valueFor('psyCut')}</span>
    </div>
  </div>
  <div class="mt-2">
    <div class="text-gray-400">アクション</div>
    <div class="flex flex-wrap gap-1 mt-1">
      {#each actionInfos as a (a.id)}
        <TooltipBadge
          badgeClass="bg-gray-700/60"
          label={a.name}
          description={a.description}
          revealed={a.revealed}
        />
      {/each}
    </div>
  </div>
</div>
