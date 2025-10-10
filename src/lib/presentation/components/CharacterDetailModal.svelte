<script lang="ts">
  import Icon from './Icon.svelte';
  import TooltipBadge from './TooltipBadge.svelte';
  import type { Character, Actor, CharacterAttribute } from '$lib/domain/entities/character';
  import { isEnemy, isPlayer } from '$lib/domain/entities/character';
  import type { Mineral } from '$lib/domain/entities/mineral';

  // Props
  export let character: Character;
  export let actor: Actor | null = null;
  export let characterAttributes: { key: CharacterAttribute; label: string }[] = [];
  export let heldMinerals: Mineral[] = [];
  export let mineralEffectsText: (m: Mineral) => string;
  export let effectiveAttributes: Record<CharacterAttribute, number> | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;

  // 敵の公開可否（モーダルでも厳格に）
  function isAttributeRevealed(key: CharacterAttribute): boolean {
    if (!actor) return true; // アクターでなければ公開対象外（キャラ定数表示）
    if (!isEnemy(actor)) return true; // 味方は常に公開
    return actor.isExposed || Boolean(actor.revealedAttributes?.includes(key));
  }

  const canShowMinerals = (() => {
    if (!actor) return false;
    if (!isEnemy(actor)) return true;
    return actor.isExposed === true;
  })();

  // 鉱石はレア度の降順で並べる（名前で安定化）
  $: sortedMinerals = [...heldMinerals].sort(
    (a, b) => b.rarity - a.rarity || a.nameJa.localeCompare(b.nameJa)
  );

  // 表示用: 補正ステータス行（o.key/o.label ごと）
  type AttributeRow = {
    key: CharacterAttribute;
    label: string;
    revealed: boolean;
    base?: number;
    eff?: number;
    delta?: number;
  };
  $: attributeRows = actor
    ? characterAttributes.map((o) => {
        const revealed = isAttributeRevealed(o.key);
        const base = revealed ? actor.baseAttributes[o.key] : undefined;
        const eff = revealed && effectiveAttributes ? effectiveAttributes[o.key] : undefined;
        const delta = revealed && eff !== undefined && base !== undefined ? eff - base : undefined;
        return { key: o.key, label: o.label, revealed, base, eff, delta } satisfies AttributeRow;
      })
    : ([] as AttributeRow[]);

  // 行動回数（base -> eff (+/-delta)）
  type StatRow = { title: string; base?: number; eff: number; delta?: number };
  $: actionRow = actor
    ? ({
        title: '行動回数',
        base: actor.baseAttributes.maxActionsPerTurn,
        eff: character.maxActionsPerTurn,
        delta: character.maxActionsPerTurn - actor.baseAttributes.maxActionsPerTurn
      } satisfies StatRow)
    : null;

  // 選択肢数（プレイヤーのみ表示）
  $: choicesRow =
    actor && isPlayer(actor)
      ? (() => {
          const bonus = heldMinerals.reduce((sum, m) => sum + (m.maxActionChoices ?? 0), 0);
          const eff = actor.maxActionChoices;
          const base = eff - bonus;
          const delta = eff - base;
          return { title: '選択肢数', base, eff, delta } satisfies StatRow;
        })()
      : null;

  function getRarityColor(rarity: number): string {
    switch (rarity) {
      case 5:
        return 'text-amber-500';
      case 4:
        return 'text-violet-500';
      case 3:
        return 'text-sky-500';
      case 2:
        return 'text-lime-500';
      case 1:
      default:
        return 'text-stone-400';
    }
  }
  // 鉱石表示用（必要情報を事前計算）
  $: mineralItems = canShowMinerals
    ? sortedMinerals.map((m) => ({
        id: m.id,
        nameJa: m.nameJa,
        rarity: m.rarity,
        rarityColor: getRarityColor(m.rarity),
        tooltip: mineralEffectsText(m)
      }))
    : [];
</script>

<!-- モーダル: 背景 -->
<div
  class="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4"
  role="dialog"
  aria-modal="true"
>
  <!-- モーダル: 本体（高さは画面内に収めて中身をスクロール） -->
  <div
    class="bg-neutral-800 text-sm rounded-lg shadow-lg border border-neutral-600 w-full max-w-xl max-h-[90vh] flex flex-col"
  >
    <!-- ヘッダ -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-700 shrink-0">
      <div class="font-semibold">{character.name}</div>
      <button
        class="text-gray-300 hover:text-white"
        aria-label="閉じる"
        on:click={() => onClose?.()}
      >
        <Icon icon="close" size={18} />
      </button>
    </div>

    <!-- 本文: スクロール領域 -->
    <div class="px-4 pt-2 pb-7 space-y-4 overflow-y-auto">
      <!-- 補正ステータス -->
      <div>
        <div class="grid gap-x-4 gap-y-1 grid-cols-3 sm:grid-cols-6">
          {#if actor}
            {#each attributeRows as r (r.key)}
              <div class="flex flex-col items-center">
                <span class="text-gray-300">{r.label}</span>
                {#if r.revealed}
                  <div class="flex items-end gap-1">
                    {#if r.delta && r.delta !== 0}
                      <span class="text-gray-500">{r.base}</span>
                      <div class="flex flex-col items-center">
                        <span class="text-xs {r.delta > 0 ? 'text-emerald-400' : 'text-red-400'}">
                          {r.delta > 0 ? '+' : ''}{r.delta}
                        </span>
                        <Icon
                          icon="arrow_right_alt"
                          size={18}
                          additionalClass="text-gray-500 -mt-1.5"
                        />
                      </div>
                    {/if}
                    <span class="text-base">{r.eff}</span>
                  </div>
                {:else}
                  <span class="text-gray-500">???</span>
                {/if}
              </div>
            {/each}
            {#if actionRow}
              <div class="flex flex-col items-center">
                <span class="text-gray-300">{actionRow.title}</span>
                <div class="flex items-end gap-1">
                  {#if actionRow.delta && actionRow.delta !== 0}
                    <span class="text-gray-500">{actionRow.base}</span>
                    <div class="flex flex-col items-center">
                      <span
                        class="text-xs {actionRow.delta > 0 ? 'text-emerald-400' : 'text-red-400'}"
                        >{actionRow.delta > 0 ? '+' : ''}{actionRow.delta}</span
                      >
                      <Icon
                        icon="arrow_right_alt"
                        size={18}
                        additionalClass="text-gray-500 -mt-1.5"
                      />
                    </div>
                  {/if}
                  <span class="text-base">{actionRow.eff}</span>
                </div>
              </div>
            {/if}
            {#if choicesRow}
              <div class="flex flex-col items-center">
                <span class="text-gray-300">{choicesRow.title}</span>
                <div class="flex items-end gap-1">
                  {#if choicesRow.delta && choicesRow.delta !== 0}
                    <span class="text-gray-500">{choicesRow.base}</span>
                    <div class="flex flex-col items-center">
                      <span
                        class="text-xs {choicesRow.delta > 0 ? 'text-emerald-400' : 'text-red-400'}"
                        >{choicesRow.delta > 0 ? '+' : ''}{choicesRow.delta}</span
                      >
                      <Icon
                        icon="arrow_right_alt"
                        size={18}
                        additionalClass="text-gray-500 -mt-1.5"
                      />
                    </div>
                  {/if}
                  <span class="text-base">{choicesRow.eff}</span>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- 所持鉱石 -->
      <div>
        <div class="text-gray-400 mb-2">所持</div>
        {#if !actor}
          <div class="text-gray-500">なし</div>
        {:else if !canShowMinerals}
          <div class="text-gray-500">不明</div>
        {:else if sortedMinerals.length === 0}
          <div class="text-gray-500">なし</div>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each mineralItems as it (it.id)}
              <TooltipBadge
                badgeClass="bg-neutral-700/40 border border-neutral-600"
                description={it.tooltip}
              >
                <span class="inline-flex items-center gap-1">
                  <span class="font-medium {it.rarityColor}">{it.nameJa}</span>
                  <span class="relative inline-flex items-center justify-center h-5 rounded">
                    <span class="absolute top-[5px] text-[8px] font-semibold">{it.rarity}</span>
                    <Icon icon="star" size={24} fill={true} additionalClass={it.rarityColor} />
                  </span>
                </span>
              </TooltipBadge>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
