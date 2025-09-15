<script lang="ts">
  export let label: string;
  export let description: string;
  export let badgeClass: string = '';
  export let revealed: boolean = true; // アクション未公開など
  export let autoHideMs: number = 100000;

  let open = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    if (!revealed) return;
    open = true;
    if (autoHideMs > 0) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        open = false;
        timer = null;
      }, autoHideMs);
    }
  }
  function hide() {
    if (!revealed) return;
    open = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function focus() {
    if (!revealed) return;
    open = true;
  }
  function blur() {
    if (!revealed) return;
    if (timer) return;
    open = false;
  }
  function toggle() {
    if (!revealed) return;
    if (!timer) {
      show();
      return;
    }
    if (open) {
      hide();
    } else {
      show();
    }
  }
  function onDocumentClick(e: MouseEvent) {
    if (!open) return;
    const path = e.composedPath();
    if (!path.includes(wrapper)) hide();
  }
  let wrapper: HTMLElement;
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onDocumentClick);
  }
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('click', onDocumentClick);
    }
  });

  $: klass = (() => {
    const base = 'inline-flex items-center px-1 py-0.5 rounded text-xs';

    const unrevealed = !revealed ? 'opacity-60 pointer-events-none' : 'cursor-pointer';
    return `${base} ${badgeClass} ${unrevealed}`;
  })();
</script>

<button
  bind:this={wrapper}
  class="relative p-0 m-0 border-0 bg-transparent flex"
  type="button"
  aria-label={description}
  disabled={!revealed}
  onfocus={focus}
  onblur={blur}
  onmouseenter={focus}
  onmouseleave={blur}
  onclick={toggle}
>
  <span class={klass} data-revealed={revealed}>{label}</span>
  {#if open}
    <span
      class="absolute z-1000 max-w-3xs text-xs px-2 py-1 rounded bg-black/80 text-gray-100 border border-white/10 top-full -left-100 translate-x-100"
      role="tooltip"
    >
      {description}
    </span>
  {/if}
</button>
