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
  import { getAction } from '$lib/data/repositories/characterRepository';
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
  class="bg-panel rounded-lg mb-4 p-4 flex flex-wrap items-center gap-4 text-sm text-gray-200"
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
  <section class="rounded-lg mb-4 p-0">
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
  {#if state.phase === 'progress'}
    <section class="bg-panel rounded-lg mb-4 p-4">
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
    </section>
  {/if}

  {#if state.phase === 'combat'}
    <section class="bg-panel rounded-lg mb-4 p-4">
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
    </section>
  {/if}

  {#if state.phase === 'event'}
    <section class="bg-panel rounded-lg mb-4 p-4">
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
    </section>
  {/if}

  {#if state.phase === 'rest'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold mb-2">休憩</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn-base" on:click={() => restChoice(state, 'heal')}>HP30%回復</button>
        <button class="btn-base" on:click={() => restChoice(state, 'maxhp')}>CON+1</button>
      </div>
    </section>
  {/if}

  {#if state.phase === 'victory'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold">勝利!</h2>
    </section>
  {/if}
  {#if state.phase === 'gameover'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold text-bad">ゲームオーバー</h2>
    </section>
  {/if}
  {#if state.phase === 'reward'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold mb-2">
        {#if state.rewardIsBoss}
          {#if state.rewardIsFinalBoss}最終ボス報酬{:else}ボス報酬{/if}
        {:else}成長報酬{/if}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each state.rewardOptions || [] as r (r.id)}
          <button class="btn-base" on:click={() => pickReward(state, r.id)}>{r.label}</button>
        {/each}
      </div>
    </section>
  {/if}

  <section class="bg-panel rounded-lg mb-4 p-4">
    <h3 class="mt-0 font-semibold mb-2">ログ</h3>
    <div class="text-[0.85rem] leading-tight max-h-[200px] overflow-auto bg-logbg p-2 rounded-md">
      {#each state.log as entry, i (i)}
        <div class="mb-[2px] last:mb-0 flex items-start">
          <span
            class={`inline-block min-w-[55px] text-center font-semibold text-[0.6rem] tracking-wide mr-1 px-1 py-[2px] rounded bg-gray-700 text-gray-300 log-kind-${entry.kind}`}
            >{entry.kind}</span
          >
          {#if entry.kind === 'combat' && entry.side}
            <span
              class={`inline-block mr-1 px-1 py-[2px] rounded text-[0.55rem] font-semibold tracking-wide log-side-${entry.side}`}
              >{entry.actorKind === 'boss' ? 'boss' : entry.side}</span
            >
          {/if}
          <span>{entry.message}</span>
        </div>
      {/each}
    </div>
  </section>
</main>

<footer class="bg-panel rounded-lg mb-4 p-4 flex flex-row gap-2">
  <button class="btn-base" on:click={restart}>やり直し</button>
  <button class="btn-base" on:click={() => (debugMode = !debugMode)}>デバッグ</button>
</footer>
