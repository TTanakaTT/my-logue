<script lang="ts">
  import { gameState, chooseNode } from '$lib/domain/services/state_service';
  import CharacterPanel from '$lib/presentation/components/CharacterPanel.svelte';
  import LogViewer from '$lib/presentation/components/LogViewer.svelte';
  import { uiAnimating } from '$lib/presentation/utils/effect_bus';
  import ControlPanel from '$lib/presentation/components/ControlPanel.svelte';
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

<main class=" flex flex-col items-center">
  <section class="rounded-lg my-3 w-full max-w-5xl px-2">
    <div class="flex flex-row gap-4 flex-nowrap items-stretch">
      <div class="flex-1 flex flex-row-reverse gap-2 flex-wrap justify-start">
        {#key [$gameState.player.characterAttributes.STR, $gameState.player.characterAttributes.CON, $gameState.player.characterAttributes.POW, $gameState.player.characterAttributes.DEX, $gameState.player.characterAttributes.APP, $gameState.player.characterAttributes.INT, $gameState.player.statuses
            .map((d) => `${d.id}:${d.count ?? 0}`)
            .join(',')].join('|')}
          <CharacterPanel character={$gameState.player} side="player" panelKey="player" />
        {/key}
        {#each $gameState.allies as ally, i (i)}
          {#key [ally.characterAttributes.STR, ally.characterAttributes.CON, ally.characterAttributes.POW, ally.characterAttributes.DEX, ally.characterAttributes.APP, ally.characterAttributes.INT, ally.statuses
              .map((d) => `${d.id}:${d.count ?? 0}`)
              .join(',')].join('|')}
            <CharacterPanel character={ally} side="player" panelKey={`ally-${i}`} />
          {/key}
        {/each}
      </div>
      <div class="flex-1 flex flex-row gap-2 flex-wrap justify-start">
        {#each $gameState.enemies as enemy, i (i)}
          {#key [enemy.characterAttributes, enemy.statuses
              .map((d) => `${d.id}:${d.count ?? 0}`)
              .join(',')].join('|')}
            <CharacterPanel character={enemy} side="enemy" panelKey={`enemy-${i}`} />
          {/key}
        {/each}
      </div>
    </div>
  </section>
</main>

<footer class="sticky z-0 bottom-0 py-1 px-4">
  <section class="mx-auto w-full max-w-5xl mb-4 px-2 z-10 flex justify-center">
    <ControlPanel
      gameStateValue={$gameState}
      uiAnimatingValue={$uiAnimating}
      {debugMode}
      onGraphSelect={handleGraphSelect}
    />
  </section>
  <LogViewer />
</footer>
