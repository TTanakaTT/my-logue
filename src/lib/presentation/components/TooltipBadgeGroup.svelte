<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte';
  import { writable, type Writable } from 'svelte/store';

  // Public API
  export let className: string = '';

  // Provide a reactive compact flag to children via context
  const compactStore: Writable<boolean> = writable(false);
  setContext('tooltip-badge-compact', compactStore);
  let isCompact = false;
  const unsubscribe = compactStore.subscribe((v) => (isCompact = v));

  let wrapper: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  // Hysteresis control to avoid flip-flop between compact and expanded
  let compact = false;
  let lastCompactWidth = 0; // clientWidth recorded when switching to compact
  const EXPAND_THRESHOLD_PX = 24; // require some extra room before expanding back

  function evaluateWrap() {
    if (!wrapper) return;
    const children = Array.from(wrapper.children) as HTMLElement[];
    if (children.length <= 1) {
      if (compact) {
        compact = false;
        compactStore.set(false);
      }
      return;
    }
    const firstTop = children[0].offsetTop;
    // If any child moved to a new row (offsetTop increases), we consider it wrapped.
    const wrapped = children.some((c) => c.offsetTop > firstTop);
    const width = wrapper.clientWidth;

    if (!compact && wrapped) {
      compact = true;
      lastCompactWidth = width;
      compactStore.set(true);
      return;
    }
    if (compact && !wrapped) {
      // Only expand back if we have noticeably more room than when we compacted
      if (width > lastCompactWidth + EXPAND_THRESHOLD_PX) {
        compact = false;
        compactStore.set(false);
      }
      return;
    }
  }

  onMount(() => {
    // Observe size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => evaluateWrap());
      resizeObserver.observe(wrapper);
    }
    // Observe child list/size changes
    mutationObserver = new MutationObserver(() => evaluateWrap());
    // attributes/subtree can cause thrashing when class/style toggles; rely on childList + ResizeObserver
    mutationObserver.observe(wrapper, { childList: true });

    // Initial evaluation after mount & next tick
    setTimeout(evaluateWrap, 0);
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    unsubscribe?.();
  });
</script>

<div
  bind:this={wrapper}
  class={`group flex flex-wrap gap-1 ${className}`}
  aria-expanded={!isCompact}
  data-compact={isCompact}
>
  <slot compact={isCompact} />
</div>
