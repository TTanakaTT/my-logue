<script lang="ts">
  export let icon: string = '';
  export let size: number = 48;
  export let additionalClass: string = '';

  $: styleAttr = `font-size:${size}px;`;
</script>

<span class={`material-symbols-outlined ${additionalClass}`} style={styleAttr}> {icon}</span>
