<script>
  import { onMount, onDestroy, getContext } from 'svelte';

  import Inner from './Inner.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let container;
  let instance;

  export let startSeq = 1;

  export const currentLocation = function() {
    return instance.currentLocation();
  }

  $: if ( instance ) { manifest.currentLocation.set(currentLocation()); }

  onMount(() => {
  })
</script>

<div class="view--container" bind:this={container}>
  {#if container}
  <Inner {container} {startSeq} bind:this={instance}></Inner>    
  {/if}
</div>

<style>

  .view--container {
    grid-row: 1/2;
    min-height: 0;
    overflow: auto;

    /* display: grid;
    grid-template-rows: minmax(0, 1fr); */

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
</style>