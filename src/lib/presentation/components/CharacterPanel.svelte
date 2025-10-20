<script lang="ts">
  // Svelte framework imports
  import { onDestroy } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { cubicOut } from 'svelte/easing';

  // Project/library modules (non-component)
  import { calcMaxHP } from '$lib/domain/services/attribute_service';
  import {
    isActor,
    isEnemy,
    type ActorAttribute,
    type Attribute,
    type Character,
    type CharacterAttributeKey,
    type Actor,
    isPlayer
  } from '$lib/domain/entities/character';
  import { status } from '$lib/data/consts/statuses';
  import type { StatusInstance } from '$lib/domain/entities/status';
  import { getAction } from '$lib/data/repositories/action_repository';

  // Local component imports
  import TooltipBadge from './TooltipBadge.svelte';
  import PanelEffectLayer from './PanelEffectLayer.svelte';
  import FloatingNumbersLayer from './FloatingNumbersLayer.svelte';
  import Icon from './Icon.svelte';
  import { getMineral } from '$lib/data/repositories/mineral_repository';
  import type { Mineral } from '$lib/domain/entities/mineral';
  import CharacterDetailModal from './CharacterDetailModal.svelte';
  import { m } from '$lib/paraglide/messages';

  export let character: Character;
  export let side: 'player' | 'enemy' = 'player';

  const characterAttributes: { key: CharacterAttributeKey; label: string }[] = [
    { key: 'CON', label: m.attr_CON() },
    { key: 'STR', label: m.attr_STR() },
    { key: 'POW', label: m.attr_POW() },
    { key: 'DEX', label: m.attr_DEX() },
    { key: 'APP', label: m.attr_APP() },
    { key: 'INT', label: m.attr_INT() }
  ];
  const actorAttributes: {
    key: ActorAttribute;
    label: string;
  }[] = [{ key: 'hp', label: m.ui_hp() }];

  $: characterAttributeValues = character.characterAttributes;

  const HP_ANIM_MIN_MS = 1000;
  const HP_ANIM_MAX_MS = 2000;

  let displayedHp = isActor(character) && isHpRevealed() ? character.hp : m.ui_unknown();
  let lastHp = 0;
  let hpEmphasis: 'none' | 'damage' | 'heal' = 'none';
  let hpEmphasisActive = false;
  let hpEmphasisTimer: ReturnType<typeof setTimeout> | null = null;
  let hpAnimFrame: number | null = null;

  let hpColor = '';
  $: hpColor = (() => {
    if (!isActor(character)) return '';
    if (typeof displayedHp !== 'number') return '';
    const max = Math.max(1, calcMaxHP(character));
    const ratio = Math.max(0, Math.min(1, displayedHp / max));
    const g = Math.round(ratio * 100);
    const r = 100 - g;
    return `color-mix(in oklab, var(--color-hp-max) ${g}%, var(--color-hp-dead) ${r}%)`;
  })();

  let hpIsFull = false;
  $: hpIsFull = (() => {
    if (!isActor(character)) return false;
    if (typeof displayedHp !== 'number') return false;
    const max = Math.max(1, calcMaxHP(character));
    return Math.round(displayedHp) >= max;
  })();

  $: hpClass = (() => {
    const base = ['inline-block', 'px-1', 'rounded-sm', 'transition-all'];
    if (hpIsFull) base.push('font-black');
    if (hpEmphasisActive) {
      base.push('ring-1', 'scale-110');
      if (hpEmphasis === 'damage') base.push('ring-red-400/60');
      else base.push('ring-emerald-400/60');
    }
    return base.join(' ');
  })();

  function isHpRevealed(): boolean {
    if (!isActor(character)) return false;
    if (!isEnemy(character)) return true;
    return character.isExposed || Boolean(character.revealedAttributes?.includes('hp'));
  }

  function handleHpChange(current: number, max: number) {
    if (typeof displayedHp !== 'number') return;
    if (current === lastHp) return;

    const delta = Math.abs(current - lastHp);
    const ratioDelta = Math.min(1, delta / max);
    const duration = Math.round(HP_ANIM_MIN_MS + (HP_ANIM_MAX_MS - HP_ANIM_MIN_MS) * ratioDelta);

    hpEmphasis = current < lastHp ? 'damage' : 'heal';
    hpEmphasisActive = true;
    if (hpEmphasisTimer) clearTimeout(hpEmphasisTimer);
    hpEmphasisTimer = setTimeout(
      () => {
        hpEmphasisActive = false;
      },
      Math.min(600, duration)
    );

    const from = displayedHp;
    const to = current;
    const start = performance.now();
    const ease = cubicOut;
    if (hpAnimFrame) cancelAnimationFrame(hpAnimFrame);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      displayedHp = from + (to - from) * k;
      if (t < 1) {
        hpAnimFrame = requestAnimationFrame(tick);
      } else {
        displayedHp = to;
      }
    };
    hpAnimFrame = requestAnimationFrame(tick);

    lastHp = current;
  }

  function resetHpAnim() {
    if (hpAnimFrame) cancelAnimationFrame(hpAnimFrame);
    hpAnimFrame = null;
    lastHp = 0;
    displayedHp = 0;
    hpEmphasis = 'none';
    hpEmphasisActive = false;
  }

  let hpInitialized = false;
  $: {
    if (!isActor(character) || !isHpRevealed()) {
      resetHpAnim();
      hpInitialized = false;
    } else {
      const hp = character.hp;
      const max = Math.max(1, calcMaxHP(character));
      if (!hpInitialized) {
        lastHp = hp;
        displayedHp = hp;
        hpInitialized = true;
      }
      handleHpChange(hp, max);
    }
  }

  onDestroy(() => {
    if (hpEmphasisTimer) clearTimeout(hpEmphasisTimer);
    if (hpAnimFrame) cancelAnimationFrame(hpAnimFrame);
  });

  function formatSignedPercent(v: number): string {
    const p = (v * 100).toFixed(0);
    const sign = v >= 0 ? '+' : '';
    return sign + p + '%';
  }

  function rateColorStyle(v: number): string {
    const mag = Math.min(1, Math.abs(v));
    const pct = Math.round(100 * mag);
    const colorVar = v >= 0 ? 'var(--color-mod-up)' : 'var(--color-mod-down)';
    return `color: color-mix(in oklab, ${colorVar} ${pct}%, white ${100 - pct}%);`;
  }

  $: actor = isActor(character) ? (character as Actor) : null;

  function getDisplayedAttribute(key: Attribute): string | number {
    if (!isActor(character)) {
      return key === 'hp' ? '' : characterAttributeValues[key];
    }

    if (!isEnemy(character)) {
      return key === 'hp' ? displayedHp : characterAttributeValues[key];
    }

    if (
      character.isExposed ||
      (character.revealedAttributes && character.revealedAttributes.includes(key))
    ) {
      return key === 'hp' ? displayedHp : characterAttributeValues[key];
    } else {
      return m.ui_unknown();
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
        name = m.ui_unknown();
        description = m.ui_unknown();
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

  export let panelKey: string = '';

  let showDetail = false;
  function openDetail() {
    if (!isActor(character)) return;
    showDetail = true;
  }
  function closeDetail() {
    showDetail = false;
  }

  $: heldMinerals = (() => {
    if (!isActor(character)) return [] as Mineral[];
    const ids = character.heldMineralIds || [];
    const list = ids.map((id) => getMineral(id)).filter((m): m is Mineral => Boolean(m));
    return list;
  })();

  function mineralEffectsText(mineral: Mineral): string {
    const parts: string[] = [];
    if (mineral.STR) parts.push(`${m.attr_STR()} +${mineral.STR}`);
    if (mineral.CON) parts.push(`${m.attr_CON()} +${mineral.CON}`);
    if (mineral.POW) parts.push(`${m.attr_POW()} +${mineral.POW}`);
    if (mineral.DEX) parts.push(`${m.attr_DEX()} +${mineral.DEX}`);
    if (mineral.APP) parts.push(`${m.attr_APP()} +${mineral.APP}`);
    if (mineral.INT) parts.push(`${m.attr_INT()} +${mineral.INT}`);
    if (typeof mineral.maxActionsPerTurn === 'number' && mineral.maxActionsPerTurn !== 0)
      parts.push(`${m.attr_actionsPerTurn()} +${mineral.maxActionsPerTurn}`);
    if (typeof mineral.maxActionChoices === 'number' && mineral.maxActionChoices !== 0)
      parts.push(`${m.attr_actionChoices()} +${mineral.maxActionChoices}`);
    if (Array.isArray(mineral.grantedActions) && mineral.grantedActions.length > 0) {
      const names = mineral.grantedActions
        .map((id) => getAction(id)?.name || id)
        .filter(Boolean)
        .join(' / ');
      parts.push(`${m.ui_effect_actions()}: ${names}`);
    }
    return parts.join('\n');
  }
</script>

<div
  class={`rounded-lg px-2 py-1 text-xs space-y-1 bg-neutral-800/40 border-2 shadow-sm w-[170px] panel-side-${side}`}
>
  {#if panelKey}
    <PanelEffectLayer {panelKey} />
  {/if}
  <div class="font-semibold flex items-center gap-2">
    <span>{character.name}</span>
    {#if actor}
      <button
        class="inline-flex items-center justify-center text-sky-300 hover:text-sky-200 border rounded p-0.5 cursor-pointer"
        aria-label={m.aria_show_detail()}
        on:click={openDetail}
      >
        <Icon icon="menu_book" size={16} />
      </button>
    {/if}
  </div>

  <div class="grid grid-flow-col grid-rows-2 gap-1">
    {#if actor}
      {#each actorAttributes as o (o.key)}
        <div class="row-span-2 mt-1 flex flex-col items-center">
          <span class="text-gray-400">{o.label}</span>
          {#if o.key === 'hp'}
            <span class={hpClass} style={`color: ${hpColor}`}>
              {typeof displayedHp === 'number' ? Math.round(displayedHp) : displayedHp}
            </span>
          {:else}
            <span>{getDisplayedAttribute(o.key)}</span>
          {/if}
          <div class="pointer-events-none absolute left-1/2 -top-1 z-60">
            <FloatingNumbersLayer {panelKey} />
          </div>
        </div>
      {/each}
    {/if}
    {#each characterAttributes as o (o.key)}
      <div class="flex flex-col items-center">
        <span class="text-gray-400">{o.label}</span>
        <span>{getDisplayedAttribute(o.key)}</span>
      </div>
    {/each}
  </div>
  {#if actor}
    <div class="w-full flex flex-col gap-1">
      <div class="flex items-center gap-2 text-orange-200">
        <span>{m.ui_phys()}</span>
        <div class="inline-flex items-center gap-1">
          <Icon icon="swords" size={14} />
          <span style={rateColorStyle(actor.physDamageUpRate)}>
            {formatSignedPercent(actor.physDamageUpRate)}
          </span>
        </div>
        <span>{m.ui_divider()}</span>
        <div class="inline-flex items-center gap-1">
          <Icon icon="shield" size={14} />
          <span style={rateColorStyle(actor.physDamageCutRate)}>
            {formatSignedPercent(actor.physDamageCutRate)}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 text-purple-300">
        <span>{m.ui_psy()}</span>
        <div class="inline-flex items-center gap-1">
          <Icon icon="swords" size={14} />
          <span style={rateColorStyle(actor.psyDamageUpRate)}>
            {formatSignedPercent(actor.psyDamageUpRate)}
          </span>
        </div>
        <span>{m.ui_divider()}</span>

        <div class="inline-flex items-center gap-1">
          <Icon icon="shield" size={14} />
          <span style={rateColorStyle(actor.psyDamageCutRate)}>
            {formatSignedPercent(actor.psyDamageCutRate)}
          </span>
        </div>
      </div>
    </div>
  {/if}
  <div class="flex flex-col space-y-1">
    <div class="flex items-center gap-1">
      <span class="text-gray-400">{m.ui_actions_label()}</span>
      <span>(</span>
      <span>{character.characterAttributes.maxActionsPerTurn}</span>
      <span class="text-gray-400">{m.ui_times()}</span>
      {#if isActor(character) && isPlayer(character)}
        <span class="text-gray-400"> / </span>
        <span>{character.maxActionChoices}</span>
        <span class="text-gray-400">{m.ui_choices()}</span>
      {/if}
      <span>)</span>
    </div>
    <div class="flex flex-wrap gap-1">
      {#each actionInfos as a (a.id)}
        <TooltipBadge
          badgeClass={`${a.isExposed ? 'bg-emerald-700/70 border border-emerald-400/50' : a.isObserved ? 'bg-sky-700/70 border border-sky-400/50' : 'bg-gray-700/60'}`}
          description={a.description}
          revealed={a.revealed}
          >{a.name}
        </TooltipBadge>
      {/each}
    </div>
  </div>
  <div class="flex flex-wrap gap-1">
    {#each groupedStatuses as g (g.status.id + ':' + (g.status.remainingTurns ?? 'inf'))}
      {#if status[g.status.id]}
        <TooltipBadge
          badgeClass={`${status[g.status.id].badgeClass ?? ''} border px-1`}
          description={status[g.status.id].description}
          >{`${status[g.status.id].name}${g.count > 1 ? `x${g.count}` : ''}${g.status.remainingTurns !== undefined ? `(${g.status.remainingTurns})` : ''}`}
        </TooltipBadge>
      {:else}
        <TooltipBadge
          badgeClass="bg-gray-600/60 border border-red-400 px-1"
          description={m.ui_undefined_status()}>{g.status.id}</TooltipBadge
        >
      {/if}
    {/each}
  </div>
</div>

{#if showDetail && actor}
  <CharacterDetailModal
    {character}
    {actor}
    {characterAttributes}
    {heldMinerals}
    {mineralEffectsText}
    effectiveAttributes={characterAttributeValues}
    onClose={closeDetail}
  />
{/if}
