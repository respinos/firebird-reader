<script>
  import { onMount, getContext } from 'svelte';
  import screenfull from 'screenfull';

  import { tooltip } from '../../lib/tooltip';

  import ViewMenu from './ViewMenu.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  const currentSeq = manifest.currentSeq;
  $: seq = $currentSeq;
  $: console.log("ViewerToolbar", seq);

  const interfaceMode = manifest.interfaceMode;
  const isFullscreen =  manifest.isFullscreen;

  let enableZoomIn = true;
  let enableZoomOut = true;

  const enableZoomOptions = function(args) {
    console.log("-- enable.zoom", args);
    enableZoomIn = args.in;
    enableZoomOut = args.out;
  }

  const goto = function(args) {
    console.log("-- goto.page", args);
    emitter.emit('goto.page', args);
  }

  const zoom = function(delta) {
    emitter.emit('update.zoom', delta);
  }

  emitter.on('enable.zoom', enableZoomOptions);

  const toggleInterface = function(event, mode) {
    if ( mode ) {
      $interfaceMode = mode;
    } else {
      console.log("-- toggleInterface", $interfaceMode);
      $interfaceMode = ( $interfaceMode == 'default' ) ? 'minimal' : 'default';
    }
    document.body.dataset.interface = $interfaceMode;
    emitter.emit('toggle.interface', $interfaceMode);
  }

  const toggleFullscreen = function(event) {
    toggleInterface(event, screenfull.isFullscreen ? 'default' : 'minimal');
    screenfull.toggle(document.querySelector('#root')).then(() => {
      console.log("-- toggleFullScreen", screenfull.isFullscreen);
      $isFullscreen = screenfull.isFullscreen;
    })
  }

  let isFullscreenEnabled = false;
  let isRTL = manifest.direction() == 'rtl';

  $: console.log("-- view.toolbar interfaceMode", $interfaceMode);

  onMount(() => {
    isFullscreenEnabled = screenfull.isEnabled;
    window.screenfull = screenfull;
    return () => {
      // emitter.off('update.seq', updateSeq);
      emitter.off('enable.zoom', enableZoomOptions);
    }
  })
</script>

<div class="view--toolbar rounded">
  <button 
    type="button" 
    class="btn btn-outline-dark" 
    class:active={$interfaceMode == 'minimal'}
    aria-label={$interfaceMode == 'minimal' ? 'Show Controls' : 'Hide Controls'} 
    use:tooltip 
    on:click={toggleInterface}>
    <i 
      class:fa-solid={$interfaceMode == 'default'}
      class:fa-eye={$interfaceMode == 'default'}
      class:fa-regular={$interfaceMode == 'minimal'}
      class:fa-eye-slash={$interfaceMode == 'minimal'}
      ></i>
  </button>

  <!-- <button type="button" class="btn btn-outline-dark d-none d-sm-block">
    <i class="fa-regular fa-circle-question"></i>
  </button> -->

  {#if $interfaceMode == 'default'}
  <!-- navigation form -->
  <form class="d-none d-sm-block">
    <div class="d-flex align-items-center gap-1 bg-dark text-light p-1 px-2 rounded">
      <span>#</span>
      <input bind:value={seq} type="number" class="form-control text-center" min="1" max={manifest.totalSeq} on:change={() => goto({ seq: seq })} on:blur={() => goto({ seq: seq })} />
      <span>/</span>
      <span>{manifest.totalSeq}</span>
    </div>
  </form>

  <ViewMenu></ViewMenu>

  <div class="btn-group" role="group" aria-label="Zoom">
    <button 
      type="button" 
      class="btn btn-outline-dark" 
      aria-label="Zoom In" 
      disabled={!enableZoomIn}
      use:tooltip 
      on:click={() => zoom(1)}>
      <i class="fa-solid fa-plus"></i>
    </button>
    <button 
      type="button" 
      class="btn btn-outline-dark" 
      aria-label="Zoom Out" 
      disabled={!enableZoomOut}
      use:tooltip 
      on:click={() => zoom(-1)}>
      <i class="fa-solid fa-minus"></i>
    </button>
  </div>
  {/if}

  <!-- this is shameless and obvious -->
  {#if isRTL}
  <div class="btn-group" role="group" aria-label="Pagination">
    <button type="button" class="btn btn-outline-dark d-none d-md-block" aria-label="Last Page" use:tooltip on:click={() => goto({ seq: manifest.totalSeq })}>
      <i class="fa-solid fa-chevron-left border-start border-3 border-dark"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" aria-label="Next Page" use:tooltip on:click={() => goto({ delta: 1 })}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" aria-label="Previous Page" use:tooltip on:click={() => goto({ delta: -1 })}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
    <button type="button" class="btn btn-outline-dark d-none d-md-block" aria-label="First Page" use:tooltip on:click={() => goto({ seq: 1 })}>
      <i class="fa-solid fa-chevron-right border-end border-3 border-dark"></i>
    </button>
  </div>
  {:else}
  <div class="btn-group" role="group" aria-label="Pagination">
    <button type="button" class="btn btn-outline-dark d-none d-md-block" aria-label="First Page" use:tooltip on:click={() => goto({ seq: 1 })}>
      <i class="fa-solid fa-chevron-left border-start border-3 border-dark"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" aria-label="Previous Page" use:tooltip on:click={() => goto({ delta: -1 })}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" aria-label="Next Page" use:tooltip on:click={() => goto({ delta: 1 })}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
    <button type="button" class="btn btn-outline-dark d-none d-md-block" aria-label="Last Page" use:tooltip on:click={() => goto({ seq: manifest.totalSeq })}>
      <i class="fa-solid fa-chevron-right border-end border-3 border-dark"></i>
    </button>
  </div>
  {/if}

  {#if isFullscreenEnabled}
  <button 
    type="button" 
    class="btn btn-outline-dark" 
    aria-label={screenfull.isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
    use:tooltip
    on:click={toggleFullscreen}>
    <i class="fa-solid fa-maximize"></i>
  </button>
  {/if}

</div>

<style lang="scss">
  .view--toolbar {
    position: absolute;
    bottom: 1rem;
    /* left: 0.5rem; */
    right: 0.5rem;
    display: flex;
    align-items: center;
    padding: 0.25rem;
    background: #fff;
    justify-content: flex-end;
    z-index: 100;
    gap: 0.5rem;
    box-shadow: var(--shadow-elevation-medium);
  }

  :global(.stage::backdrop) {
    background-color: #fff;
  }

  :global(.apps[data-options-toggled="true"] .view--toolbar) {
    display: none;
  }

</style>