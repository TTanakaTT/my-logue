<script lang="ts">
  import type { Actor } from '$lib/domain/entities/character';
  import { calcMaxHP } from '$lib/domain/services/stats';
  export let actor: Actor;
  export let side: 'player' | 'enemy' = 'player';

  const order: { key: 'hp' | 'CON' | 'STR' | 'POW' | 'DEX' | 'APP' | 'INT'; label: string }[] = [
    { key: 'hp', label: 'HP' },
    { key: 'CON', label: 'CON' },
    { key: 'STR', label: 'STR' },
    { key: 'POW', label: 'POW' },
    { key: 'DEX', label: 'DEX' },
    { key: 'APP', label: 'APP' },
    { key: 'INT', label: 'INT' }
  ];

  $: guardActive = actor.guard;
  $: poisonTurns = actor.dots.find((d) => d.id === 'poison')?.turns;
  $: displayed = {
    hp: `${actor.hp}/${calcMaxHP(actor)}`,
    CON: actor.CON,
    STR: actor.STR,
    POW: actor.POW,
    DEX: actor.DEX,
    APP: actor.APP,
    INT: actor.INT
  };

  function valueFor(key: (typeof order)[number]['key']): string | number {
    const rev = actor.revealed?.[key];
    if (!rev) return '???';
    if (key === 'hp') return displayed.hp;
    return displayed[key];
  }
  import { getAction } from '$lib/data/repositories/actionRepository';
  $: actionInfos = actor.actions.map((id) => {
    const def = getAction(id);
    const revealed = actor.side === 'enemy' ? actor.revealedActions?.includes(id) : true;
    return {
      id,
      revealed,
      name: revealed ? def?.name || id : '???',
      description: revealed ? def?.description : '未使用のため不明'
    };
  });
</script>

<div
  class={`rounded-lg p-3 text-xs space-y-1 bg-neutral-800/40 backdrop-blur border-2 shadow-sm w-3xs panel-side-${side}`}
>
  <div class="font-semibold mb-1 flex items-center gap-2">
    <span>{actor.name}</span>
  </div>
  <div class="flex flex-wrap gap-1 mb-1">
    {#if guardActive}
      <span class="px-1 rounded text-xs font-semibold bg-green-700 text-green-100">G</span>
    {/if}
    {#if poisonTurns}
      <span
        class="px-1 rounded text-xs font-semibold bg-purple-700 text-purple-100"
        title="毒継続ターン">毒{poisonTurns}</span
      >
    {/if}
    {#if !guardActive && !poisonTurns}
      <span class="text-xs text-gray-500">&nbsp;</span>
    {/if}
  </div>
  <div class="flex flex-row flex-wrap gap-2">
    {#each order as o (o.key)}
      <div class="flex flex-col items-center">
        <span class="text-gray-400">{o.label}</span>
        <span>{valueFor(o.key)}</span>
      </div>
    {/each}
  </div>
  <div class="mt-2">
    <div class="text-gray-400">アクション</div>
    <div class="flex flex-wrap gap-1 mt-1">
      {#each actionInfos as a (a.id)}
        <span
          class="px-1 py-0.5 rounded bg-gray-700/60 text-xs whitespace-nowrap"
          title={a.description}
          data-revealed={a.revealed}
        >
          {a.name}
        </span>
      {/each}
    </div>
  </div>
</div>
