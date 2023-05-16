<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	import { createObserver } from 'svelte-use-io';

  import Inner from './Inner.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let container;
  let content;

  let currentSeq = 1;

  let zoom = 1;
  let zoomIndex = 0;
  const zoomScales = [ 1, 1.5, 1.75, 2, 2.5 ];

  onMount(() => {
    // return () => {
    //   emitter.off('goto.page', gotoPage);
    // }
  })
</script>

<div class="view--container" bind:this={container}>
  <Inner {container}></Inner>
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