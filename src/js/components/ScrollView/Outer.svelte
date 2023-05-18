<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	import { createObserver } from 'svelte-use-io';
  import PQueue from "p-queue";

  import Inner from './Inner.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let container;

  let currentSeq = 1;

  export let startSeq = 1;

  onMount(() => {
    console.log("-- itemCount", manifest.totalSeq, startSeq);
  })
</script>

<div class="view--container" bind:this={container}>
  {#if container}
  <Inner {container} {startSeq}></Inner>
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