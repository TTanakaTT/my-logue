<script lang="ts">
  import { gameState, restart, chooseNode, combatAction, restChoice, nextProgress } from './game/state';
  import { getAction } from './game/actions';
  import type { GameState } from './game/types';
  let state: GameState;
  const unsubscribe = gameState.subscribe(s => state = s);
  import { onDestroy } from 'svelte';
  onDestroy(unsubscribe);

  function availableNodeKinds(stepIndex: number): ('combat'|'event'|'rest'|'boss')[] {
    switch(stepIndex){
      case 0: return ['combat'];
      case 1: return ['combat','event'];
      case 2: return ['event','rest'];
      case 3: return ['combat','combat'];
      case 4: return ['boss'];
      default: return ['combat'];
    }
  }
</script>

<header class="panel">
  <div>階層: {state.floorIndex + 1} / 10</div>
  <div>ステップ: {state.stepIndex + 1} / 5</div>
  <div>HP: {state.player.hp} / {state.player.maxHP}</div>
  <div>攻撃力: {state.player.attack}</div>
  <div>撃破数: {state.player.score}</div>
  <div>最高到達階層: {state.highestFloor}</div>
  {#if state.phase === 'gameover' || state.phase === 'victory'}
    <button on:click={restart}>リスタート</button>
  {/if}
</header>

<main>
  {#if state.phase === 'progress'}
    <section class="panel">
      <h2>進行</h2>
      <div class="actions">
        {#each availableNodeKinds(state.stepIndex) as kind, i}
          <button on:click={() => chooseNode(state, kind )}>{kind}</button>
        {/each}
      </div>
      <button on:click={() => { state.stepIndex +=1; nextProgress(state); }}>スキップ(デバッグ)</button>
    </section>
  {/if}

  {#if state.phase === 'combat'}
    <section class="panel">
      <h2>戦闘</h2>
      {#if state.enemy}
        <p>敵: {state.enemy.kind} HP {state.enemy.hp}/{state.enemy.baseHP} 攻撃 {state.enemy.attack + (state.enemy.buffAttack||0)}</p>
      {/if}
      <div>行動 {state.actionUseCount}/2</div>
      <div class="actions">
        {#each state.actionOffer as id}
          {#if getAction(id)}
            <button disabled={state.actionUseCount>=2} on:click={() => combatAction(state, id)}>
              {getAction(id)?.name}
            </button>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if state.phase === 'event'}
    <section class="panel">
      <h2>イベント結果</h2>
      <p>イベント効果が適用されました。</p>
      <button on:click={() => { state.stepIndex +=1; nextProgress(state); }}>進む</button>
    </section>
  {/if}

  {#if state.phase === 'rest'}
    <section class="panel">
      <h2>休憩</h2>
      <div class="actions">
        <button on:click={() => restChoice(state,'heal')}>HP30%回復</button>
        <button on:click={() => restChoice(state,'maxhp')}>最大HP+3</button>
      </div>
    </section>
  {/if}

  {#if state.phase === 'victory'}
    <section class="panel"><h2>勝利!</h2></section>
  {/if}
  {#if state.phase === 'gameover'}
    <section class="panel"><h2 class="bad">ゲームオーバー</h2></section>
  {/if}
  {#if state.phase === 'reward'}
    <section class="panel">
      <h2>{state.rewardIsBoss ? (state.rewardIsFinalBoss ? '最終ボス報酬' : 'ボス報酬') : '成長報酬'}</h2>
      <div class="actions">
        {#each state.rewardOptions || [] as r}
          <button on:click={() => import('./game/state').then(m => m.pickReward(state, r.id))}>{r.label}</button>
        {/each}
      </div>
    </section>
  {/if}

  <section class="panel">
    <h3>ログ</h3>
    <div class="log">
      {#each state.log as entry}
        <div class={`log-line kind-${entry.kind}`}>
          <span class="kind-tag">{entry.kind}</span> {entry.message}
        </div>
      {/each}
    </div>
  </section>
</main>

<footer class="panel">
  <button on:click={restart}>やり直し</button>
</footer>
