<script lang="ts">
  import { effects } from '$lib/presentation/utils/effectBus';
  import Icon from './Icon.svelte';
  export let panelKey: string;
  $: localEffects = $effects.filter((e) => e.panelKey === panelKey);
  const EFFECT_SIZE = 72;
</script>

<div class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
  {#each localEffects as e (e.id)}
    <Icon
      icon={e.effect.icon}
      size={EFFECT_SIZE}
      additionalClass="{e.effect.effectClass} opacity-90 select-none"
    />
  {/each}
</div>
