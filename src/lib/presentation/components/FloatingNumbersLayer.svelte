<script lang="ts">
  import { floatings } from '$lib/presentation/utils/effect_bus';
  export let panelKey: string;
  // filter 対象
  $: local = $floatings.filter((f) => f.panelKey === panelKey);
  // 表示順: 生成順で上に積む (新しいものを上: reverse)
  $: ordered = [...local].reverse();
</script>

{#each ordered as f (f.id)}
  <div
    class="text-xs font-extrabold px-2 py-0.5 rounded-md select-none animate-float-up origin-center
      {f.kind === 'damage'
      ? 'bg-float-damage-bg text-float-damage-fg'
      : 'bg-float-heal-bg text-float-heal-fg'}"
    style="--delay:{(ordered.length - 1 - ordered.indexOf(f)) * 40}ms"
  >
    {f.kind === 'damage' ? `-${f.value}` : `+${f.value}`}
  </div>
{/each}

<!-- NOTE: .animate-float-up にカスタムプロパティ --delay を加味するなら Tailwind のカスタム animation を調整する余地あり (現状は単純表示) -->
