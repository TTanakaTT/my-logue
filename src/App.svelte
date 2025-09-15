<script lang="ts">
  import {
    gameState,
    restart,
    chooseNode,
    combatAction,
    restChoice,
    nextProgress,
    pickReward
  } from '$lib/domain/state/state';
  import { getAction } from '$lib/data/repositories/actionRepository';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  // Svelteの$store構文を使用し手動subscribeを撤廃
  $: state = $gameState;

  let debugMode = false;

  function availableNodeKinds(stepIndex: number): ('combat' | 'event' | 'rest' | 'boss')[] {
    switch (stepIndex) {
      case 0:
        return ['combat'];
      case 1:
        return ['combat', 'event'];
      case 2:
        return ['event', 'rest'];
      case 3:
        return ['combat', 'combat'];
      case 4:
        return ['boss'];
      default:
        return ['combat'];
    }
  }
</script>

<header
  class="bg-panel rounded-lg py-2 px-4 flex flex-wrap items-center gap-4 text-sm text-gray-200"
>
  <div>階層: {state.floorIndex + 1} / 10</div>
  <div>ステップ: {state.stepIndex + 1} / 5</div>
  <div>撃破数: {state.player.score}</div>
  <div>最高到達階層: {state.highestFloor}</div>
  {#if state.phase === 'gameover' || state.phase === 'victory'}
    <button class="btn-base" on:click={restart}>リスタート</button>
  {/if}
</header>

<main>
  <!-- キャラクターパネル表示 -->
  <section class="rounded-lg mt-4 mb-4 mx-2 p-0">
    <div class="flex flex-row gap-4 flex-wrap">
      {#key state.player.hp + ':' + state.player.STR + ':' + state.player.CON + ':' + state.player.guard + ':' + state.player.dots
          .map((d) => d.id + ':' + d.turns)
          .join(',')}
        <CharacterPanel actor={state.player} side="player" />
      {/key}
      {#if state.enemy}
        {#key state.enemy.hp + ':' + state.enemy.STR + ':' + state.enemy.CON + ':' + state.enemy.guard + ':' + state.enemy.dots
            .map((d) => d.id + ':' + d.turns)
            .join(',')}
          <CharacterPanel actor={state.enemy} side="enemy" />
        {/key}
      {/if}
    </div>
  </section>
  <section class="bg-panel rounded-lg mb-4 py-2 px-4">
    {#if state.phase === 'progress'}
      <h2 class="mt-0 text-lg font-semibold mb-2">進行</h2>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each availableNodeKinds(state.stepIndex) as kind, i (i)}
          <button class="btn-base" on:click={() => chooseNode(state, kind)}>{kind}</button>
        {/each}
      </div>
      {#if debugMode}
        <button
          class="btn-base"
          on:click={() =>
            gameState.update((s) => {
              s.stepIndex += 1;
              nextProgress(s);
              return { ...s };
            })}>スキップ(デバッグ)</button
        >
      {/if}
    {/if}
    {#if state.phase === 'combat'}
      <h2 class="mt-0 text-lg font-semibold mb-2">戦闘</h2>
      <div class="mb-2 text-sm">行動 {state.actionUseCount}/{state.player.maxActionsPerTurn}</div>
      <div class="flex flex-wrap gap-2">
        {#each state.actionOffer as id (id)}
          {#if getAction(id)}
            {#if state.playerUsedActions && state.playerUsedActions.includes(id)}
              <button class="btn-base opacity-40 cursor-not-allowed line-through" disabled
                >{getAction(id)?.name}</button
              >
            {:else}
              <button
                class="btn-base"
                disabled={state.actionUseCount >= state.player.maxActionsPerTurn}
                on:click={() => combatAction(state, id)}
              >
                {getAction(id)?.name}
              </button>
            {/if}
          {/if}
        {/each}
      </div>
    {/if}

    {#if state.phase === 'event'}
      <h2 class="mt-0 text-lg font-semibold mb-2">イベント結果</h2>
      <p class="mb-3 text-sm">イベント効果が適用されました。</p>
      <button
        class="btn-base"
        on:click={() =>
          gameState.update((s) => {
            s.stepIndex += 1;
            nextProgress(s);
            return { ...s };
          })}>進む</button
      >
    {/if}

    {#if state.phase === 'rest'}
      <h2 class="mt-0 text-lg font-semibold mb-2">休憩</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn-base" on:click={() => restChoice(state, 'heal')}>HP30%回復</button>
        <button class="btn-base" on:click={() => restChoice(state, 'maxhp')}>CON+1</button>
      </div>
    {/if}

    {#if state.phase === 'victory'}
      <h2 class="mt-0 text-lg font-semibold">勝利!</h2>
    {/if}
    {#if state.phase === 'gameover'}
      <h2 class="mt-0 text-lg font-semibold text-bad">ゲームオーバー</h2>
    {/if}
    {#if state.phase === 'reward'}
      <h2 class="mt-0 text-lg font-semibold mb-2">
        {#if state.rewardIsBoss}ボス報酬{:else}成長報酬{/if}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each state.rewardOptions || [] as r (r.id)}
          <button class="btn-base" on:click={() => pickReward(state, r.id)}>{r.label}</button>
        {/each}
      </div>
    {/if}
  </section>

  <section class="bg-panel rounded-lg mb-4 py-2 px-4">
    <h3 class="mt-0 font-semibold mb-2">ログ</h3>
    <div
      class="text-sm leading-tight max-h-50 overflow-auto bg-logbg p-2 rounded-md flex flex-col gap-1"
    >
      {#each state.log as entry, i (i)}
        <div class="flex items-center flex-wrap gap-1">
          <span
            class={`inline-block text-center font-semibold text-xs tracking-wide px-2 py-1 rounded bg-gray-700 text-gray-300 log-kind-${entry.kind}`}
            >{entry.kind}</span
          >
          {#if entry.kind === 'combat' && entry.side}
            <span
              class={`inline-block px-2 py-1 rounded text-xs font-semibold tracking-wide log-side-${entry.side}`}
              >{entry.actorKind === 'boss' ? 'boss' : entry.side}</span
            >
          {/if}
          <span class="px-2 py-1">{entry.message}</span>
        </div>
      {/each}
    </div>
  </section>
</main>

<footer class="bg-panel rounded-lg mb-4 py-2 px-4 flex flex-row gap-2">
  <button class="btn-base" on:click={restart}>やり直し</button>
  <button class="btn-base" on:click={() => (debugMode = !debugMode)}>デバッグ</button>
</footer>
