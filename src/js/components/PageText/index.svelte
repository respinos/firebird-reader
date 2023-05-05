<script>

  import { onMount } from 'svelte';
  import { getContext } from 'svelte';
  
  export let hidden = false;
  export let seq;
  export let canvas;
  export let div;

  let matches = [];
  let page_coords;

  let pageText;

  export function update(div) {
    pageText.append(div);
  }

  // $: if (image) { loadPageText() }
  // $: if ( getContext('answer') ) { console.log("AHOY HAVE ANSWER", seq); }

</script>

<style>

  .page-text.hidden {
    display: block;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background: #eee;
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px 1px 1px 1px);
    clip: rect(1px, 1px, 1px, 1px);
  }

  .page-text {
    position: relative;
    grid-area: 1/1;
    width: 100%;
  }

  /* :global(mark.highlight) {
    position: absolute;
    background: greenyellow;
    opacity: 0.4;
  } */

</style>

<figcaption class="page-text" bind:this={pageText}>
</figcaption>
