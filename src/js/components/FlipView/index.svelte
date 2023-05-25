<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	// import { createObserver } from '../../lib/observer';

  import Inner from './Inner.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let container;
  let content;
  let instance;

  export let startSeq = 1;

  export const currentLocation = function() {
    return instance.currentLocation();
  }

  let zoom = 1;
  let zoomIndex = 0;
  const zoomScales = [ 1, 1.5, 1.75, 2, 2.5 ];

  $: if ( instance ) { manifest.currentLocation.set(currentLocation()); }

  onMount(() => {
    // return () => {
    //   emitter.off('goto.page', gotoPage);
    // }
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
    overflow: hidden;

    /* display: grid;
    grid-template-rows: minmax(0, 1fr); */

    display: grid;
    grid-template-columns: minmax(0, 1fr);

    position: relative;
  }
</style>