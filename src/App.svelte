<script lang="ts">
  import {
    gameState,
    restart,
    chooseNode,
    combatAction,
    restChoice,
    nextProgress,
    pickReward
  } from '$lib/domain/services/stateService';
  import { getAction } from '$lib/data/repositories/actionRepository';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  import LogViewer from '$lib/presentation/components/LogViewer.svelte';
  import { uiAnimating } from '$lib/presentation/utils/effectBus';
  // Svelteの$store構文を使用し手動subscribeを撤廃
  $: state = $gameState;

  let debugMode = false;

  // ノード種別: 表示上 normal / elite / boss / event / rest
  type NodeKindDisplay = 'normal' | 'elite' | 'boss' | 'event' | 'rest';
  function availableNodeKinds(stepIndex: number): NodeKindDisplay[] {
    switch (stepIndex) {
      case 1:
        return ['normal'];
      case 2:
        return ['normal', 'event'];
      case 3:
        return ['event', 'rest'];
      case 4:
        return ['elite'];
      case 5:
        return ['boss'];
      default:
        return ['normal'];
    }
  }

  function handleChoose(kind: NodeKindDisplay) {
    if (kind === 'normal') chooseNode(state, 'combat');
    else if (kind === 'elite')
      chooseNode(state, 'combat'); // createEnemy内の分岐とstate.stepIndexでelite化済
    else if (kind === 'boss') chooseNode(state, 'boss');
    else if (kind === 'event') chooseNode(state, 'event');
    else if (kind === 'rest') chooseNode(state, 'rest');
  }
</script>

<header
  class="bg-panel rounded-lg py-2 px-4 flex flex-wrap items-center gap-4 text-sm text-gray-200"
>
  <div>階層: {state.floorIndex} - {state.stepIndex}/5</div>
  <div>撃破数: {state.player.score}</div>
  <div>最高到達階層: {state.highestFloor}</div>
</header>

<main>
  <!-- キャラクターパネル表示 -->
  <section class="rounded-lg mt-4 mb-4 mx-2 p-0">
    <div class="flex flex-row gap-4 flex-wrap relative">
      <!-- キーに全ステータスを含め POW/DEX/APP/INT 変化時も再描画されるようにする -->
      {#key [state.player.hp, state.player.STR, state.player.CON, state.player.POW, state.player.DEX, state.player.APP, state.player.INT, state.player.statuses
          .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
          .join(',')].join('|')}
        <CharacterPanel actor={state.player} side="player" panelKey="player" />
      {/key}
      {#each state.allies as ally, i (i)}
        {#key [ally.hp, ally.STR, ally.CON, ally.POW, ally.DEX, ally.APP, ally.INT, ally.statuses
            .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
            .join(',')].join('|')}
          <CharacterPanel actor={ally} side="player" panelKey={`ally-${i}`} />
        {/key}
      {/each}
      {#each state.enemies as enemy, i (i)}
        {#key [enemy.hp, enemy.STR, enemy.CON, enemy.POW, enemy.DEX, enemy.APP, enemy.INT, enemy.statuses
            .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
            .join(',')].join('|')}
          <CharacterPanel actor={enemy} side="enemy" panelKey={`enemy-${i}`} />
        {/key}
      {/each}
    </div>
  </section>
  <section class="bg-panel rounded-lg mb-4 py-2 px-4">
    <h3 class="mt-0 font-semibold mb-2">ログ</h3>
    <LogViewer />
  </section>
  <section class="bg-panel rounded-lg mb-4 py-2 px-4">
    {#if state.phase === 'progress'}
      <h2 class="mt-0 text-lg font-semibold mb-2">進行</h2>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each availableNodeKinds(state.stepIndex) as kind, i (i)}
          <button class="btn-base" on:click={() => handleChoose(kind)}>{kind}</button>
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
      {#if state.player.maxActionsPerTurn > 1}
        <div class="mb-2 text-sm">行動 {state.actionUseCount}/{state.player.maxActionsPerTurn}</div>
      {/if}
      {#if state.enemies.length > 1}
        <div class="mb-2 text-sm flex flex-wrap gap-2 items-center">
          <span class="text-gray-400">対象:</span>
          {#each state.enemies as e, idx (idx)}
            <button
              class={`btn-base ${state.selectedEnemyIndex === idx ? 'border border-emerald-400' : ''}`}
              disabled={e.hp <= 0}
              on:click={() =>
                gameState.update((s) => {
                  s.selectedEnemyIndex = idx;
                  return { ...s };
                })}>{e.name}{e.hp <= 0 ? ' (撃破)' : ''}</button
            >
          {/each}
        </div>
      {/if}
      <div class="flex flex-wrap gap-2">
        {#each state.actionOffer as id, idx (id)}
          {#if getAction(id)}
            {#if state.playerUsedActions && state.playerUsedActions.includes(id)}
              <button class="btn-base opacity-40 cursor-not-allowed line-through" disabled
                >{idx === 0 ? '★ ' : ''}{getAction(id)?.name}</button
              >
            {:else}
              <button
                class={`btn-base ${idx === 0 ? 'border-amber-400 border-2 shadow-lg bg-amber-600/30' : ''}`}
                disabled={$uiAnimating || state.actionUseCount >= state.player.maxActionsPerTurn}
                on:click={() => combatAction(state, id)}
                title={idx === 0 ? 'クリティカル (効果強化)' : getAction(id)?.description}
              >
                {idx === 0 ? '★ ' : ''}{getAction(id)?.name}
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
      <h2 class="mt-0 text-lg font-semibold mb-2">勝利!</h2>
      <button class="btn-base" on:click={restart}>リスタート</button>
    {/if}
    {#if state.phase === 'gameover'}
      <h2 class="mt-0 text-lg font-semibold text-bad mb-2">ゲームオーバー</h2>
      <button class="btn-base" on:click={restart}>リスタート</button>
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
</main>

<footer class="bg-panel rounded-lg mb-4 py-2 px-4 flex flex-row gap-2">
  <button class="btn-base" on:click={restart}>やり直し</button>
  <button class="btn-base" on:click={() => (debugMode = !debugMode)}>デバッグ</button>
</footer>
