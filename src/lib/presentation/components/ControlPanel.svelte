<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import {
    gameState,
    combatAction,
    commitPlayerName,
    selectCompanion,
    skipCompanionSelection
  } from '$lib/domain/services/state_service';
  import {
    restChoice,
    nextProgress,
    pickReward,
    restart
  } from '$lib/domain/services/state_service';
  import { getAction } from '$lib/data/repositories/action_repository';
  import GraphView from '$lib/presentation/components/GraphView.svelte';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  import Icon from '$lib/presentation/components/Icon.svelte';
  import type { GameState } from '$lib/domain/entities/battle_state';

  export let gameStateValue: GameState;
  export let uiAnimatingValue: boolean;
  export let debugMode = false;
  export let onGraphSelect: (id: number) => void;
</script>

<section
  class={`mt-4 bg-panel/80 border border-gray-700 rounded-xl p-4 shadow-inner mx-auto transition-[width,max-width] duration-500 ease-out ${gameStateValue.phase === 'progress' ? 'w-full max-w-5xl' : 'inline-flex flex-col items-stretch max-w-3xl'}`}
>
  {#if gameStateValue.phase === 'companion_select'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.companion_select_title()}</h2>
    <div class="flex flex-wrap gap-3 mb-4 justify-center">
      {#each gameStateValue.companionCandidates || [] as c (c.id)}<button
          class="hover:bg-gray-600 cursor-pointer"
          on:click={() => selectCompanion(gameStateValue, c.id)}
        >
          <CharacterPanel character={c} side="player" panelKey={c.name} />
        </button>
      {/each}
    </div>
    <div class="flex gap-2 justify-center">
      <button class="btn-base" on:click={() => skipCompanionSelection(gameStateValue)}
        >{m.btn_skip()}</button
      >
    </div>
  {:else if gameStateValue.phase === 'combat'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.combat_title()}</h2>
    {#if gameStateValue.player.characterAttributes.maxActionsPerTurn > 1}
      <div class="mb-2 text-sm">
        {m.actions_count({
          used: gameStateValue.actionUseCount,
          max: gameStateValue.player.characterAttributes.maxActionsPerTurn
        })}
      </div>
    {/if}
    {#if gameStateValue.enemies.length > 1}
      <div class="mb-2 text-sm flex flex-wrap gap-2 items-center">
        <span class="text-gray-400">{m.target_label()}</span>
        {#each gameStateValue.enemies as e, idx (idx)}
          <button
            class={`btn-base ${gameStateValue.selectedEnemyIndex === idx ? 'border border-emerald-400' : ''}`}
            disabled={e.hp <= 0}
            on:click={() =>
              gameState.update((s) => {
                s.selectedEnemyIndex = idx;
                return { ...s };
              })}>{e.name}{e.hp <= 0 ? m.defeated_suffix() : ''}</button
          >
        {/each}
      </div>
    {/if}
    <div class="flex flex-wrap gap-2 justify-center">
      {#each gameStateValue.actionOffer as id, idx (id)}
        {#if getAction(id)}
          {#if gameStateValue.playerUsedActions && gameStateValue.playerUsedActions.includes(id)}
            <button class="btn-base opacity-40 cursor-not-allowed line-through" disabled
              >{idx === 0 ? '★ ' : ''}{getAction(id)?.name}</button
            >
          {:else}
            <button
              class={`btn-base ${idx === 0 ? 'border-amber-400 border-2 shadow-lg bg-amber-600/30' : ''}`}
              disabled={uiAnimatingValue ||
                gameStateValue.actionUseCount >=
                  gameStateValue.player.characterAttributes.maxActionsPerTurn}
              on:click={() => combatAction(gameStateValue, id)}
              title={idx === 0 ? m.tooltip_critical() : getAction(id)?.description}
            >
              {idx === 0 ? '★ ' : ''}{getAction(id)?.name}
            </button>
          {/if}
        {/if}
      {/each}
    </div>
  {:else if gameStateValue.phase === 'event'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.event_title()}</h2>
    <div class="flex justify-center">
      <button
        class="btn-base"
        on:click={() =>
          gameState.update((s: GameState) => {
            nextProgress(s);
            return { ...s };
          })}>{m.btn_next()}</button
      >
    </div>
  {:else if gameStateValue.phase === 'rest'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.rest_title()}</h2>
    <div class="flex flex-wrap gap-2 justify-center">
      <button class="btn-base" on:click={() => restChoice(gameStateValue)}>{m.btn_heal_30()}</button
      >
    </div>
  {:else if gameStateValue.phase === 'victory'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.victory_title()}</h2>
    <div class="flex justify-center">
      <button class="btn-base" on:click={restart}>{m.btn_restart()}</button>
    </div>
  {:else if gameStateValue.phase === 'gameover'}
    <h2 class="mt-0 text-lg font-semibold text-bad mb-2">{m.gameover_title()}</h2>
    <div class="flex justify-center">
      <button class="btn-base" on:click={restart}>{m.btn_restart()}</button>
    </div>
  {:else if gameStateValue.phase === 'progress'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.progress_title()}</h2>
    {#if gameStateValue.floorLayout}
      <div class="w-full">
        <GraphView
          layout={gameStateValue.floorLayout}
          currentNodeId={gameStateValue.currentNodeId}
          consumedNodeIds={gameStateValue.consumedNodeIds || []}
          startNodeId={gameStateValue.floorLayout?.startNodeId}
          onSelectNode={onGraphSelect}
        />
      </div>
    {/if}

    {#if debugMode}
      <button
        class="btn-base mt-2"
        on:click={() =>
          gameState.update((s: GameState) => {
            nextProgress(s);
            return { ...s };
          })}
      >
        skip
      </button>
    {/if}
  {:else if gameStateValue.phase === 'reward'}
    <h2 class="mt-0 text-lg font-semibold mb-2">
      {#if gameStateValue.rewardIsBoss}{m.reward_title_boss()}{:else}{m.reward_title_growth()}{/if}
    </h2>
    <div class="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
      {#each gameStateValue.rewardOptions || [] as r (r.id)}
        <button
          class="btn-base whitespace-pre-line text-left"
          on:click={() => pickReward(gameStateValue, r.id)}>{r.label}</button
        >
      {/each}
    </div>
  {/if}
</section>
