<script lang="ts">
  export let icon: string = '';
  export let size: number = 48;
  export let fill: boolean = false;
  export let weight: number = 400;
  export let additionalClass: string = '';
  $: font = `font-variation-settings: 'FILL' ${fill ? 1 : 0}, 'wght' ${weight};`;
  $: styleAttr = `font-size:${size}px;`;
</script>

<span class={`material-symbols-outlined ${additionalClass}`} style="{font} {styleAttr}">
  {icon}</span
>
