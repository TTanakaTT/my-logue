<script lang="ts">
  import Icon from './Icon.svelte';
  import { getContext } from 'svelte';
  import { readable, type Readable } from 'svelte/store';

  export let description: string = '';
  export let badgeClass: string = '';
  export let revealed: boolean = true; // アクション未公開など
  export let autoHideMs: number = 100000;
  // New: optional icon and title for default rendering
  export let icon: string | undefined = undefined;
  export let title: string | undefined = undefined;
  // Optional override to force icons-only mode
  export let iconOnly: boolean | undefined = undefined;

  // Read compact mode from group context
  const compactFromGroup =
    (getContext('tooltip-badge-compact') as Readable<boolean> | undefined) ?? readable(false);
  let compact = false;
  const unsubscribe = compactFromGroup.subscribe((v) => (compact = v));

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
    unsubscribe?.();
  });

  $: klass = (() => {
    const base = 'inline-flex items-center px-1 py-0.5 rounded text-xs';

    const unrevealed = !revealed ? 'opacity-60 pointer-events-none' : 'cursor-pointer';
    return `${base} ${badgeClass} ${unrevealed}`;
  })();
  $: showIconOnly = iconOnly ?? compact;
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
  <span class={klass} data-revealed={revealed}>
    {#if icon}
      <Icon {icon} size={14} additionalClass={title && !showIconOnly ? 'mr-1' : ''} />
    {/if}
    {#if title && !showIconOnly}
      <span>{title}</span>
    {:else}
      <slot />
    {/if}
  </span>
  {#if open}
    <span
      class="absolute z-1000 max-w-3xs text-xs px-2 py-1 rounded bg-black/80 text-gray-100 border border-white/10 top-full -left-100 translate-x-100 whitespace-pre-line"
      role="tooltip"
      >{description}
    </span>
  {/if}
</button>
