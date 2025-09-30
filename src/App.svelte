<script lang="ts">
  import {
    gameState,
    restart,
    chooseNode,
    combatAction,
    restChoice,
    nextProgress,
    pickReward,
    commitPlayerName
  } from '$lib/domain/services/state_service';
  import { getAction } from '$lib/data/repositories/action_repository';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  import LogViewer from '$lib/presentation/components/LogViewer.svelte';
  import { uiAnimating } from '$lib/presentation/utils/effectBus';

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
    if (kind === 'normal') chooseNode($gameState, 'combat');
    else if (kind === 'elite')
      chooseNode($gameState, 'combat'); // createEnemy内の分岐とstate.stepIndexでelite化済
    else if (kind === 'boss') chooseNode($gameState, 'boss');
    else if (kind === 'event') chooseNode($gameState, 'event');
    else if (kind === 'rest') chooseNode($gameState, 'rest');
  }
</script>

<header
  class="bg-panel rounded-lg py-2 px-4 flex flex-wrap items-center gap-4 text-sm text-gray-200"
>
  <div>階層: {$gameState.floorIndex} - {$gameState.stepIndex}/5</div>
  <div>撃破数: {$gameState.player.score}</div>
  <div>最高到達階層: {$gameState.highestFloor}</div>
</header>

<main>
  <!-- キャラクターパネル表示 -->
  <section class="rounded-lg mt-4 mb-4 mx-2 p-0">
    <div class="flex flex-row gap-4 flex-wrap relative">
      <!-- キーに全ステータスを含め POW/DEX/APP/INT 変化時も再描画されるようにする -->
      {#key [$gameState.player.hp, $gameState.player.STR, $gameState.player.CON, $gameState.player.POW, $gameState.player.DEX, $gameState.player.APP, $gameState.player.INT, $gameState.player.statuses
          .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
          .join(',')].join('|')}
        <CharacterPanel actor={$gameState.player} side="player" panelKey="player" />
      {/key}
      {#each $gameState.allies as ally, i (i)}
        {#key [ally.hp, ally.STR, ally.CON, ally.POW, ally.DEX, ally.APP, ally.INT, ally.statuses
            .map((d) => d.id + ':' + (d.remainingTurns ?? 'inf'))
            .join(',')].join('|')}
          <CharacterPanel actor={ally} side="player" panelKey={`ally-${i}`} />
        {/key}
      {/each}
      {#each $gameState.enemies as enemy, i (i)}
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
    {#if !$gameState.playerNameCommitted}
      <h2 class="mt-0 text-lg font-semibold mb-2">プレイヤー名設定</h2>
      <div class="flex flex-col gap-2 max-w-xs mb-4">
        <div class="flex gap-2">
          <input
            class="px-2 py-1 rounded bg-gray-800 border border-gray-600 focus:outline-none"
            bind:value={$gameState.player.name}
            placeholder="名前を入力"
            maxlength={20}
          />
          <button class="btn-base" on:click={restart}>ランダム生成</button>
        </div>
        <div class="flex gap-2">
          <button
            class="btn-base"
            on:click={() => commitPlayerName($gameState.player.name)}
            disabled={!$gameState.player.name.trim()}>開始</button
          >
        </div>
      </div>
    {:else if $gameState.phase === 'progress'}
      <h2 class="mt-0 text-lg font-semibold mb-2">進行</h2>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each availableNodeKinds($gameState.stepIndex) as kind, i (i)}
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
    {#if $gameState.phase === 'combat'}
      <h2 class="mt-0 text-lg font-semibold mb-2">戦闘</h2>
      {#if $gameState.player.maxActionsPerTurn > 1}
        <div class="mb-2 text-sm">
          行動 {$gameState.actionUseCount}/{$gameState.player.maxActionsPerTurn}
        </div>
      {/if}
      {#if $gameState.enemies.length > 1}
        <div class="mb-2 text-sm flex flex-wrap gap-2 items-center">
          <span class="text-gray-400">対象:</span>
          {#each $gameState.enemies as e, idx (idx)}
            <button
              class={`btn-base ${$gameState.selectedEnemyIndex === idx ? 'border border-emerald-400' : ''}`}
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
                  $gameState.actionUseCount >= $gameState.player.maxActionsPerTurn}
                on:click={() => combatAction($gameState, id)}
                title={idx === 0 ? 'クリティカル (効果強化)' : getAction(id)?.description}
              >
                {idx === 0 ? '★ ' : ''}{getAction(id)?.name}
              </button>
            {/if}
          {/if}
        {/each}
      </div>
    {/if}

    {#if $gameState.phase === 'event'}
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

    {#if $gameState.phase === 'rest'}
      <h2 class="mt-0 text-lg font-semibold mb-2">休憩</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn-base" on:click={() => restChoice($gameState, 'heal')}>HP30%回復</button>
        <button class="btn-base" on:click={() => restChoice($gameState, 'maxhp')}>CON+1</button>
      </div>
    {/if}

    {#if $gameState.phase === 'victory'}
      <h2 class="mt-0 text-lg font-semibold mb-2">勝利!</h2>
      <button class="btn-base" on:click={restart}>リスタート</button>
    {/if}
    {#if $gameState.phase === 'gameover'}
      <h2 class="mt-0 text-lg font-semibold text-bad mb-2">ゲームオーバー</h2>
      <button class="btn-base" on:click={restart}>リスタート</button>
    {/if}
    {#if $gameState.phase === 'reward'}
      <h2 class="mt-0 text-lg font-semibold mb-2">
        {#if $gameState.rewardIsBoss}ボス報酬{:else}成長報酬{/if}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each $gameState.rewardOptions || [] as r (r.id)}
          <button class="btn-base" on:click={() => pickReward($gameState, r.id)}>{r.label}</button>
        {/each}
      </div>
    {/if}
  </section>
</main>

<footer class="bg-panel rounded-lg mb-4 py-2 px-4 flex flex-row gap-2">
  <button class="btn-base" on:click={restart}>やり直し</button>
  <button class="btn-base" on:click={() => (debugMode = !debugMode)}>デバッグ</button>
</footer>
