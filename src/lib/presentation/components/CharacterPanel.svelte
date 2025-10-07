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
    type CharacterAttribute,
    type Actor
  } from '$lib/domain/entities/character';
  import { status } from '$lib/data/consts/statuses';
  import type { StatusInstance } from '$lib/domain/entities/status';
  import { getAction } from '$lib/data/repositories/action_repository';

  // Local component imports
  import TooltipBadge from './TooltipBadge.svelte';
  import PanelEffectLayer from './PanelEffectLayer.svelte';
  import FloatingNumbersLayer from './FloatingNumbersLayer.svelte';
  import Icon from './Icon.svelte';

  export let character: Character;
  export let side: 'player' | 'enemy' = 'player';

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

  // --- HP 表示アニメーション設定 ---
  const HP_ANIM_MIN_MS = 1000;
  const HP_ANIM_MAX_MS = 2000;

  // 数値アニメーション用（手動）
  let displayedHp = isActor(character) && isHpRevealed() ? character.hp : '???';
  let lastHp = 0;
  let hpEmphasis: 'none' | 'damage' | 'heal' = 'none';
  let hpEmphasisActive = false;
  let hpEmphasisTimer: ReturnType<typeof setTimeout> | null = null;
  let hpAnimFrame: number | null = null;

  // HPの色（リアクティブに算出）: 赤(0%) ↔ 緑(100%)
  let hpColor = '';
  $: hpColor = (() => {
    if (!isActor(character)) return '';
    if (typeof displayedHp !== 'number') return ''; // ???表示時
    const max = Math.max(1, calcMaxHP(character));
    const ratio = Math.max(0, Math.min(1, displayedHp / max));
    const g = Math.round(ratio * 100);
    const r = 100 - g;
    return `color-mix(in oklab, var(--color-hp-max) ${g}%, var(--color-hp-dead) ${r}%)`;
  })();

  // 最大HPかどうか（小数→四捨五入後に比較）
  let hpIsFull = false;
  $: hpIsFull = (() => {
    if (!isActor(character)) return false;
    if (typeof displayedHp !== 'number') return false; // ???表示時
    const max = Math.max(1, calcMaxHP(character));
    return Math.round(displayedHp) >= max;
  })();

  // HPクラスを算出（読みやすさのために切り出し）
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
  // HPの公開可否（敵の未公開時は???表示）
  function isHpRevealed(): boolean {
    if (!isActor(character)) return false;
    if (!isEnemy(character)) return true;
    return character.isExposed || Boolean(character.revealedAttributes?.includes('hp'));
  }

  // HP変化の検知とアニメーション
  function handleHpChange(current: number, max: number) {
    if (typeof displayedHp !== 'number') return; // ???表示時
    if (current === lastHp) return;

    const delta = Math.abs(current - lastHp);
    const ratioDelta = Math.min(1, delta / max);
    const duration = Math.round(HP_ANIM_MIN_MS + (HP_ANIM_MAX_MS - HP_ANIM_MIN_MS) * ratioDelta);

    // 強調表示（回復/被ダメージ）
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

  // HP変更に反応（依存は character のみ）
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

  const FLOAT_NONZERO_THRESHOLD = 0.0001;
  function isNonZero(v: number): boolean {
    return Math.abs(v) > FLOAT_NONZERO_THRESHOLD;
  }

  function formatSignedPercent(v: number): string {
    const p = (v * 100).toFixed(0);
    const sign = v > 0 ? '+' : '';
    return sign + p + '%';
  }

  function rateColorStyle(v: number): string {
    if (!isNonZero(v)) return '';
    // ある程度濃い色から始めて、|v|が大きいほど濃くする
    const mag = Math.min(1, Math.abs(v));
    const pct = Math.round(100 * mag);
    const colorVar = v >= 0 ? 'var(--color-mod-up)' : 'var(--color-mod-down)';
    return `color: color-mix(in oklab, ${colorVar} ${pct}%, white ${100 - pct}%);`;
  }

  $: actor = isActor(character) ? (character as Actor) : null;

  function getDisplayedAttribute(key: Attribute): string | number {
    // アクター以外の表示制御
    if (!isActor(character)) {
      return key === 'hp' ? '' : characterAttributeValues[key];
    }

    if (!isEnemy(character)) {
      // 自分および味方は常に公開
      return key === 'hp' ? displayedHp : characterAttributeValues[key];
    }

    // 敵の表示制御
    if (
      character.isExposed ||
      (character.revealedAttributes && character.revealedAttributes.includes(key))
    ) {
      return key === 'hp' ? displayedHp : characterAttributeValues[key];
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
        <TooltipBadge
          badgeClass={`${status[g.status.id].badgeClass ?? ''} border px-1`}
          label={`${status[g.status.id].name}${g.count > 1 ? `x${g.count}` : ''}${g.status.remainingTurns !== undefined ? `(${g.status.remainingTurns})` : ''}`}
          description={status[g.status.id].description}
        />
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
    {#if actor}
      {#each actorAttributes as o (o.key)}
        <div class="flex flex-col items-center relative">
          <span class="text-gray-400">{o.label}</span>
          {#if o.key === 'hp'}
            <!-- HPは割合に応じて色を補間し、変化時は強調 -->
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
      <div class="flex flex-col items-center relative">
        <span class="text-gray-400">{o.label}</span>
        <span>{getDisplayedAttribute(o.key)}</span>
      </div>
    {/each}
  </div>
  {#if actor}
    <div class="w-full flex flex-col gap-1">
      {#if isNonZero(actor.physDamageUpRate) || isNonZero(actor.physDamageCutRate)}
        <div class="flex items-center gap-2">
          <span class="text-gray-400">物理補正</span>
          {#if isNonZero(actor.physDamageUpRate)}
            <span
              style={rateColorStyle(actor.physDamageUpRate)}
              class="inline-flex items-center gap-1"
            >
              <Icon icon="swords" size={14} />
              {formatSignedPercent(actor.physDamageUpRate)}
            </span>
          {/if}
          {#if isNonZero(actor.physDamageUpRate) && isNonZero(actor.physDamageCutRate)}
            <span class="text-gray-400">|</span>
          {/if}
          {#if isNonZero(actor.physDamageCutRate)}
            <span
              style={rateColorStyle(actor.physDamageCutRate)}
              class="inline-flex items-center gap-1"
            >
              <Icon icon="shield" size={14} />
              {formatSignedPercent(actor.physDamageCutRate)}
            </span>
          {/if}
        </div>
      {/if}
      {#if isNonZero(actor.psyDamageUpRate) || isNonZero(actor.psyDamageCutRate)}
        <div class="flex items-center gap-2">
          <span class="text-gray-400">精神補正</span>
          {#if isNonZero(actor.psyDamageUpRate)}
            <span
              style={rateColorStyle(actor.psyDamageUpRate)}
              class="inline-flex items-center gap-1"
            >
              <Icon icon="swords" size={14} />
              {formatSignedPercent(actor.psyDamageUpRate)}
            </span>
          {/if}
          {#if isNonZero(actor.psyDamageUpRate) && isNonZero(actor.psyDamageCutRate)}
            <span class="text-gray-400">|</span>
          {/if}
          {#if isNonZero(actor.psyDamageCutRate)}
            <span
              style={rateColorStyle(actor.psyDamageCutRate)}
              class="inline-flex items-center gap-1"
            >
              <Icon icon="shield" size={14} />
              {formatSignedPercent(actor.psyDamageCutRate)}
            </span>
          {/if}
        </div>
      {/if}
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
