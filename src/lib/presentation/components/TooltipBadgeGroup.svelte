<script lang="ts">
  import { onMount, onDestroy, setContext } from 'svelte';
  import { writable, type Writable } from 'svelte/store';

  // Public API
  export let className: string = '';

  // Provide a reactive compact flag to children via context
  const compactStore: Writable<boolean> = writable(false);
  setContext('tooltip-badge-compact', compactStore);

  let wrapper: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  function evaluateWrap() {
    if (!wrapper) return;
    const children = Array.from(wrapper.children) as HTMLElement[];
    if (children.length <= 1) {
      compactStore.set(false);
      return;
    }
    const firstTop = children[0].offsetTop;
    // If any child moved to a new row (offsetTop increases), we consider it wrapped.
    const wrapped = children.some((c) => c.offsetTop > firstTop);
    compactStore.set(wrapped);
  }

  onMount(() => {
    // Observe size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => evaluateWrap());
      resizeObserver.observe(wrapper);
    }
    // Observe child list/size changes
    mutationObserver = new MutationObserver(() => evaluateWrap());
    mutationObserver.observe(wrapper, { childList: true, subtree: true, attributes: true });

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
  });
</script>

<div bind:this={wrapper} class={`flex flex-wrap gap-1 ${className}`}>
  <slot />
</div>
