<script lang="ts">
  import { effects, floatings } from '$lib/presentation/utils/effectBus';
  import Icon from './Icon.svelte';
  export let panelKey: string;
  $: localEffects = $effects.filter((e) => e.panelKey === panelKey);
  $: localFloatings = $floatings.filter((f) => f.panelKey === panelKey);
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
  {#each localFloatings as f (f.id)}
    <div
      class="absolute right-2 top-2 font-extrabold px-2 py-0.5 rounded-md transform translate-y-0 animate-float-up select-none
      {f.kind === 'damage' ? 'bg-float-damage-bg' : 'bg-float-heal-bg'} 
      'text-float-damage-fg'"
    >
      {f.kind === 'damage' ? `-${f.value}` : `+${f.value}`}
    </div>
  {/each}
</div>
