<script lang="ts">
  import {
    isActor,
    isEnemy,
    type ActorAttribute,
    type Attribute,
    type Character,
    type CharacterAttribute
  } from '$lib/domain/entities/character';
  import { calcMaxHP } from '$lib/domain/services/attribute_service';
  import { SvelteMap } from 'svelte/reactivity';
  import PanelEffectLayer from './PanelEffectLayer.svelte';
  import FloatingNumbersLayer from './FloatingNumbersLayer.svelte';
  import { getAction } from '$lib/data/repositories/action_repository';
  import TooltipBadge from './TooltipBadge.svelte';
  import { status } from '$lib/data/consts/statuses';
  import type { StatusInstance } from '$lib/domain/entities/status';

  export let character: Character;
  export let side: 'player' | 'enemy' = 'player';

  $: _isActor = isActor(character);
  type DamageScaling = 'physUp' | 'physCut' | 'psyUp' | 'psyCut';

  const characterAttributes: {
    key: CharacterAttribute;
    label: string;
  }[] = [
    { key: 'CON', label: '体力' },
    { key: 'STR', label: '筋力' },
    { key: 'POW', label: '精神' },
    { key: 'DEX', label: '器用' },
    { key: 'APP', label: '魅力' },
    { key: 'INT', label: '知力' }
  ];
  const actorAttributes: {
    key: ActorAttribute;
    label: string;
  }[] = [{ key: 'hp', label: 'HP' }];

  $: characterAttributeValues = {
    CON: character.CON,
    STR: character.STR,
    POW: character.POW,
    DEX: character.DEX,
    APP: character.APP,
    INT: character.INT
  };
  $: actorAttributeValues = isActor(character)
    ? {
        hp: `${character.hp}/${calcMaxHP(character)}`,
        physUp: character.physDamageUpRate,
        physCut: character.physDamageCutRate,
        psyUp: character.psyDamageUpRate,
        psyCut: character.psyDamageCutRate
      }
    : { hp: '', physUp: 0, physCut: 0, psyUp: 0, psyCut: 0 };

  function getDisplayedScaling(key: DamageScaling): string | number {
    if (!isActor(character)) return '???';
    switch (key) {
      case 'physUp':
      case 'physCut':
      case 'psyUp':
      case 'psyCut':
        return (actorAttributeValues[key] * 100).toFixed(0) + '%';
    }
  }
  function getDisplayedAttribute(key: Attribute): string | number {
    // アクター以外の表示制御
    if (!isActor(character)) {
      return key === 'hp' ? '' : characterAttributeValues[key];
    }

    if (!isEnemy(character)) {
      // 自分および味方は常に公開
      return key === 'hp' ? actorAttributeValues[key] : characterAttributeValues[key];
    }

    // 敵の表示制御
    if (
      character.isExposed ||
      (character.revealedAttributes && character.revealedAttributes.includes(key))
    ) {
      return key === 'hp' ? actorAttributeValues[key] : characterAttributeValues[key];
    } else {
      return '???';
    }
  }

  $: actionInfos = character.actions.map((id) => {
    const def = getAction(id);
    let isObserved = false;
    let isExposed = false;
    let revealed = true;
    let name = def?.name || id;
    let description = def?.description;

    if (isActor(character) && isEnemy(character)) {
      if (character.observedActions) isObserved = character.observedActions.includes(id);
      isExposed = character.isExposed;
      revealed = isExposed || isObserved;
      if (!revealed) {
        name = '???';
        description = '???';
      }
    }
    return {
      id,
      revealed,
      name,
      description,
      isExposed,
      isObserved
    };
  });

  // ステータス表示用グルーピング: id + 残ターン一致のみスタック数をまとめる
  interface GroupedStatus {
    status: StatusInstance;
    count: number;
  }
  $: groupedStatuses = (() => {
    if (!isActor(character)) return [];

    const map = new SvelteMap<string, GroupedStatus>();
    for (const st of character.statuses) {
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
  // 親から識別されるように panelKey を受け取る
  export let panelKey: string = '';
</script>

<div
  class={`relative rounded-lg p-3 text-xs space-y-1 bg-neutral-800/40 border-2 shadow-sm w-3xs panel-side-${side}`}
>
  {#if panelKey}
    <PanelEffectLayer {panelKey} />
  {/if}
  <div class="font-semibold mb-1 flex items-center gap-2">
    <span>{character.name}</span>
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
    {#if _isActor}
      {#each actorAttributes as o (o.key)}
        <div class="flex flex-col items-center relative">
          <span class="text-gray-400">{o.label}</span>
          <span>{getDisplayedAttribute(o.key)}</span>
          <div class="pointer-events-none absolute left-1/2 -top-1 z-60">
            <FloatingNumbersLayer {panelKey} />
          </div>
        </div>
      {/each}
    {/if}
    {#each characterAttributes as o (o.key)}
      <div class="flex flex-col items-center relative">
        <span class="text-gray-400">{o.label}</span>
        <span>{getDisplayedAttribute(o.key)}</span>
      </div>
    {/each}
  </div>
  {#if _isActor}
    <div class="w-full flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-gray-400">物理</span>
        <span>攻撃 {getDisplayedScaling('physUp')}</span>
        <span class="text-gray-400">|</span>
        <span>防御 {getDisplayedScaling('physCut')}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-400">精神</span>
        <span>攻撃 {getDisplayedScaling('psyUp')}</span>
        <span class="text-gray-400">|</span>
        <span>防御 {getDisplayedScaling('psyCut')}</span>
      </div>
    </div>
  {/if}
  <div class="mt-2 flex flex-col">
    <div class="flex">
      <span class="text-gray-400">アクション ({character.maxActionsPerTurn}回)</span>
    </div>
    <div class="flex flex-wrap gap-1 mt-1">
      {#each actionInfos as a (a.id)}
        <TooltipBadge
          badgeClass={`${a.isExposed ? 'bg-emerald-700/70 border border-emerald-400/50' : a.isObserved ? 'bg-sky-700/70 border border-sky-400/50' : 'bg-gray-700/60'}`}
          label={a.name}
          description={a.description}
          revealed={a.revealed}
        />
      {/each}
    </div>
  </div>
</div>
