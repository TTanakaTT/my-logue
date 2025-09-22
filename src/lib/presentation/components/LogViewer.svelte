<script lang="ts">
  import type { DisplayLogEntry } from '$lib/presentation/utils/logUtil';
  import { displayLogs } from '$lib/presentation/utils/logUtil';
  // Svelteの$store構文
  $: logs = $displayLogs as DisplayLogEntry[];
</script>

<div class="text-sm leading-tight h-30 overflow-auto bg-logbg p-2 rounded-md flex flex-col gap-1">
  {#each logs as entry (entry.id)}
    <div class="flex items-center flex-wrap gap-1">
      <span class={`inline-block text-center font-semibold text-xs tracking-wide px-2 py-1 rounded bg-gray-700 text-gray-300 log-kind-${entry.kind}`}>{entry.kind}</span>
      {#if entry.kind === 'combat' && entry.side}
        <span class={`inline-block px-2 py-1 rounded text-xs font-semibold tracking-wide log-side-${entry.side}`}>{entry.actorKind === 'boss' ? 'boss' : entry.side}</span>
      {/if}
      <span class="px-2 py-1">{entry.shown}</span>
    </div>
  {/each}
</div>
