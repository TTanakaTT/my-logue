<script lang="ts">
  import {
    gameState,
    restart,
    chooseNode,
    combatAction,
    restChoice,
    nextProgress,
    pickReward,
    commitPlayerName,
    selectCompanion,
    skipCompanionSelection
  } from '$lib/domain/services/state_service';
  import { getAction } from '$lib/data/repositories/action_repository';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  import LogViewer from '$lib/presentation/components/LogViewer.svelte';
  import { uiAnimating } from '$lib/presentation/utils/effect_bus';
  import GraphView from '$lib/presentation/components/GraphView.svelte';
  import Icon from '$lib/presentation/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';

  let debugMode = false;

  function handleGraphSelect(id: number) {
    const layout = $gameState.floorLayout;
    if (!layout) return;
    const node = layout.nodes.find((n) => n.id === id);
    if (!node) return;
    chooseNode($gameState, node);
  }
  function debug(): void {
    debugMode = true;
    try {
      const snapshot = JSON.parse(JSON.stringify($gameState));
      console.debug('[DEBUG gameState snapshot]', snapshot);
    } catch {
      console.debug('[DEBUG gameState raw]', $gameState);
    }
  }
</script>

<header class="bg-panel py-2 px-4 flex flex-wrap items-center gap-4 text-sm text-gray-200">
  <div>{m.ui_floor({ n: $gameState.floorIndex })}</div>
  <div>{m.ui_highest({ n: $gameState.highestFloor })}</div>
  <button class="btn-base" on:click={debug}>debug</button>
</header>

<main class="flex-1">
  <div style="display: contents">
    <section class="rounded-lg my-3 mx-2">
      <div class="flex flex-row gap-2 flex-wrap">
        {#key [$gameState.player.characterAttributes.STR, $gameState.player.characterAttributes.CON, $gameState.player.characterAttributes.POW, $gameState.player.characterAttributes.DEX, $gameState.player.characterAttributes.APP, $gameState.player.characterAttributes.INT, $gameState.player.statuses
            .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
            .join(',')].join('|')}
          <CharacterPanel character={$gameState.player} side="player" panelKey="player" />
        {/key}
        {#each $gameState.allies as ally, i (i)}
          {#key [ally.characterAttributes.STR, ally.characterAttributes.CON, ally.characterAttributes.POW, ally.characterAttributes.DEX, ally.characterAttributes.APP, ally.characterAttributes.INT, ally.statuses
              .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
              .join(',')].join('|')}
            <CharacterPanel character={ally} side="player" panelKey={`ally-${i}`} />
          {/key}
        {/each}
        {#each $gameState.enemies as enemy, i (i)}
          {#key [enemy.characterAttributes, enemy.statuses
              .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
              .join(',')].join('|')}
            <CharacterPanel character={enemy} side="enemy" panelKey={`enemy-${i}`} />
          {/key}
        {/each}
      </div>
    </section>
    <section class="bg-panel rounded-lg mb-4 py-2 px-4">
      <h3 class="mt-0 font-semibold mb-2">{m.ui_log()}</h3>
      <LogViewer />
    </section>
  </div>
</main>
<footer class="sticky bottom-0 bg-panel border-t border-gray-700 rounded-t-xl py-2 px-4">
  {#if !$gameState.playerNameCommitted}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.player_name_title()}</h2>
    <div class="flex flex-col gap-2 max-w-xs">
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <div class="flex items-center gap-1 rounded bg-gray-800 border border-gray-600 pl-2 pr-1">
            <input
              id="player-name"
              class="bg-transparent outline-none flex-1 h-full py-0"
              bind:value={$gameState.player.name}
              placeholder={m.placeholder_player_name()}
              maxlength={20}
              autocomplete="off"
            />
            <button
              class="p-1 rounded hover:bg-gray-700"
              on:click={restart}
              aria-label={m.aria_random_name()}
            >
              <Icon icon="cycle" size={16} />
            </button>
          </div>
        </div>
        <button
          class="btn-base"
          on:click={() => commitPlayerName($gameState.player.name)}
          disabled={!$gameState.player.name.trim()}>{m.btn_start()}</button
        >
      </div>
    </div>
  {:else if $gameState.phase === 'companion_select'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.companion_select_title()}</h2>
    <div class="flex flex-wrap gap-3 mb-4">
      {#each $gameState.companionCandidates || [] as c (c.id)}<button
          class="hover:bg-gray-600 cursor-pointer"
          on:click={() => selectCompanion($gameState, c.id)}
        >
          <CharacterPanel character={c} side="player" panelKey={c.name} />
        </button>
      {/each}
    </div>
    <div class="flex gap-2">
      <button class="btn-base" on:click={() => skipCompanionSelection($gameState)}
        >{m.btn_skip()}</button
      >
    </div>
  {:else if $gameState.phase === 'progress'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.progress_title()}</h2>
    {#if $gameState.floorLayout}
      <div class="">
        <GraphView
          layout={$gameState.floorLayout}
          currentNodeId={$gameState.currentNodeId}
          consumedNodeIds={$gameState.consumedNodeIds || []}
          startNodeId={$gameState.floorLayout?.startNodeId}
          onSelectNode={handleGraphSelect}
        />
      </div>
    {/if}

    {#if debugMode}
      <button
        class="btn-base"
        on:click={() =>
          gameState.update((s) => {
            nextProgress(s);
            return { ...s };
          })}
      >
        skip
      </button>
    {/if}
  {/if}

  {#if $gameState.phase === 'combat'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.combat_title()}</h2>
    {#if $gameState.player.characterAttributes.maxActionsPerTurn > 1}
      <div class="mb-2 text-sm">
        {m.actions_count({
          used: $gameState.actionUseCount,
          max: $gameState.player.characterAttributes.maxActionsPerTurn
        })}
      </div>
    {/if}
    {#if $gameState.enemies.length > 1}
      <div class="mb-2 text-sm flex flex-wrap gap-2 items-center">
        <span class="text-gray-400">{m.target_label()}</span>
        {#each $gameState.enemies as e, idx (idx)}
          <button
            class={`btn-base ${$gameState.selectedEnemyIndex === idx ? 'border border-emerald-400' : ''}`}
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
    <div class="flex flex-wrap gap-2">
      {#each $gameState.actionOffer as id, idx (id)}
        {#if getAction(id)}
          {#if $gameState.playerUsedActions && $gameState.playerUsedActions.includes(id)}
            <button class="btn-base opacity-40 cursor-not-allowed line-through" disabled
              >{idx === 0 ? '★ ' : ''}{getAction(id)?.name}</button
            >
          {:else}
            <button
              class={`btn-base ${idx === 0 ? 'border-amber-400 border-2 shadow-lg bg-amber-600/30' : ''}`}
              disabled={$uiAnimating ||
                $gameState.actionUseCount >=
                  $gameState.player.characterAttributes.maxActionsPerTurn}
              on:click={() => combatAction($gameState, id)}
              title={idx === 0 ? m.tooltip_critical() : getAction(id)?.description}
            >
              {idx === 0 ? '★ ' : ''}{getAction(id)?.name}
            </button>
          {/if}
        {/if}
      {/each}
    </div>
  {/if}

  {#if $gameState.phase === 'event'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.event_title()}</h2>
    <button
      class="btn-base"
      on:click={() =>
        gameState.update((s) => {
          nextProgress(s);
          return { ...s };
        })}>{m.btn_next()}</button
    >
  {/if}

  {#if $gameState.phase === 'rest'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.rest_title()}</h2>
    <div class="flex flex-wrap gap-2">
      <button class="btn-base" on:click={() => restChoice($gameState)}>{m.btn_heal_30()}</button>
    </div>
  {/if}

  {#if $gameState.phase === 'victory'}
    <h2 class="mt-0 text-lg font-semibold mb-2">{m.victory_title()}</h2>
    <button class="btn-base" on:click={restart}>{m.btn_restart()}</button>
  {/if}
  {#if $gameState.phase === 'gameover'}
    <h2 class="mt-0 text-lg font-semibold text-bad mb-2">{m.gameover_title()}</h2>
    <button class="btn-base" on:click={restart}>{m.btn_restart()}</button>
  {/if}
  {#if $gameState.phase === 'reward'}
    <h2 class="mt-0 text-lg font-semibold mb-2">
      {#if $gameState.rewardIsBoss}{m.reward_title_boss()}{:else}{m.reward_title_growth()}{/if}
    </h2>
    <div class="flex flex-wrap gap-2">
      {#each $gameState.rewardOptions || [] as r (r.id)}
        <button
          class="btn-base whitespace-pre-line text-left"
          on:click={() => pickReward($gameState, r.id)}>{r.label}</button
        >
      {/each}
    </div>
  {/if}
</footer>
