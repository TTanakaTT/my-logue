<script lang="ts">
  import {
    gameState,
    restart,
    chooseNode,
    combatAction,
    restChoice,
    nextProgress
  } from './game/state';
  import { getAction } from './game/actions';
  import type { GameState } from './game/types';
  let state: GameState;
  const unsubscribe = gameState.subscribe((s) => (state = s));
  import { onDestroy } from 'svelte';
  onDestroy(unsubscribe);

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
  <div>HP: {state.player.hp} / {state.player.maxHP}</div>
  <div>攻撃力: {state.player.attack}</div>
  <div>撃破数: {state.player.score}</div>
  <div>最高到達階層: {state.highestFloor}</div>
  {#if state.phase === 'gameover' || state.phase === 'victory'}
    <button class="btn-base" on:click={restart}>リスタート</button>
  {/if}
</header>

<main>
  {#if state.phase === 'progress'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold mb-2">進行</h2>
      <div class="flex flex-wrap gap-2 mb-2">
        {#each availableNodeKinds(state.stepIndex) as kind, i}
          <button class="btn-base" on:click={() => chooseNode(state, kind)}>{kind}</button>
        {/each}
      </div>
      {#if debugMode}
        <button
          class="btn-base"
          on:click={() => {
            state.stepIndex += 1;
            nextProgress(state);
          }}>スキップ(デバッグ)</button
        >
      {/if}
    </section>
  {/if}

  {#if state.phase === 'combat'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold mb-2">戦闘</h2>
      {#if state.enemy}
        <p class="mb-2 text-sm">
          敵: {state.enemy.kind} HP {state.enemy.hp}/{state.enemy.baseHP} 攻撃 {state.enemy.attack +
            (state.enemy.buffAttack || 0)}
        </p>
      {/if}
      <div class="mb-2 text-sm">行動 {state.actionUseCount}/2</div>
      <div class="flex flex-wrap gap-2">
        {#each state.actionOffer as id}
          {#if getAction(id)}
            <button
              class="btn-base"
              disabled={state.actionUseCount >= 2}
              on:click={() => combatAction(state, id)}
            >
              {getAction(id)?.name}
            </button>
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
        on:click={() => {
          state.stepIndex += 1;
          nextProgress(state);
        }}>進む</button
      >
    </section>
  {/if}

  {#if state.phase === 'rest'}
    <section class="bg-panel rounded-lg mb-4 p-4">
      <h2 class="mt-0 text-lg font-semibold mb-2">休憩</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn-base" on:click={() => restChoice(state, 'heal')}>HP30%回復</button>
        <button class="btn-base" on:click={() => restChoice(state, 'maxhp')}>最大HP+3</button>
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
        {state.rewardIsBoss ? (state.rewardIsFinalBoss ? '最終ボス報酬' : 'ボス報酬') : '成長報酬'}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each state.rewardOptions || [] as r}
          <button
            class="btn-base"
            on:click={() => import('./game/state').then(m => m.pickReward(state, r.id))}
            >{r.label}</button
          >
        {/each}
      </div>
    </section>
  {/if}

  <section class="bg-panel rounded-lg mb-4 p-4">
    <h3 class="mt-0 font-semibold mb-2">ログ</h3>
    <div class="text-[0.85rem] leading-tight max-h-[200px] overflow-auto bg-logbg p-2 rounded-md">
      {#each state.log as entry}
        <div class={`mb-[2px] last:mb-0 flex items-start kind-${entry.kind}`}>
          <span
            class="inline-block min-w-[55px] text-center font-semibold text-[0.6rem] tracking-wide mr-1 px-1 py-[2px] rounded bg-gray-700 text-gray-300"
            >{entry.kind}</span
          >
          {entry.message}
        </div>
      {/each}
    </div>
  </section>
</main>

<footer class="bg-panel rounded-lg mb-4 p-4 flex flex-row gap-2">
  <button class="btn-base" on:click={restart}>やり直し</button>
  <button class="btn-base" on:click={() => (debugMode = !debugMode)}>デバッグ</button>
</footer>
