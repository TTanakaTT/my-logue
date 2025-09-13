<script lang="ts">
  import type { Actor } from './types';
  import { calcMaxHP } from './stats';
  export let actor: Actor;
  export let title: string;
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

  function valueFor(key: (typeof order)[number]['key']) {
    const rev = actor.revealed?.[key];
    if (!rev) return '???';
    if (key === 'hp') return displayed.hp;
    return (displayed as any)[key];
  }
</script>

<div
  class={`rounded-lg p-3 text-xs space-y-1 bg-neutral-800/40 backdrop-blur ring-2 shadow-sm min-w-[150px] panel-side-${side}`}
>
  <div class="font-semibold mb-1 flex items-center gap-2">
    <span>{title}</span>
  </div>
  <div class="flex flex-wrap gap-1 mb-1 min-h-[18px]">
    {#if guardActive}
      <span
        class="px-1 rounded text-[10px] leading-[14px] font-semibold bg-green-700 text-green-100"
        >G</span
      >
    {/if}
    {#if poisonTurns}
      <span
        class="px-1 rounded text-[10px] leading-[14px] font-semibold bg-purple-700 text-purple-100"
        title="毒継続ターン">毒{poisonTurns}</span
      >
    {/if}
    {#if !guardActive && !poisonTurns}
      <span class="text-[10px] text-gray-500">&nbsp;</span>
    {/if}
  </div>
  {#each order as o}
    <div class="flex justify-between">
      <span class="text-gray-400">{o.label}</span>
      <span>{valueFor(o.key)}</span>
    </div>
  {/each}
</div>
