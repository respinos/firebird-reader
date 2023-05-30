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

  const minimalInterface = manifest.minimalInterface;
  const isFullscreen =  manifest.isFullscreen;

  const goto = function(args) {
    console.log("-- goto.page", args);
    emitter.emit('goto.page', args);
  }

  const zoom = function(delta) {
    emitter.emit('update.zoom', delta);
  }

  const toggleInterface = function() {
    $minimalInterface = ! $minimalInterface;
    emitter.emit('toggle.interface', minimalInterface);
  }

  const toggleFullscreen = function() {
    screenfull.toggle(document.querySelector('.stage')).then(() => {
      console.log("-- toggleFullScreen", screenfull.isFullscreen);
      $isFullscreen = screenfull.isFullscreen;
    })
  }

  let isFullscreenEnabled = false;

  // emitter.on('update.seq', updateSeq);

  $: console.log("-- view.toolbar minimalInterface", $minimalInterface);

  onMount(() => {
    isFullscreenEnabled = screenfull.isEnabled;
    window.screenfull = screenfull;
    return () => {
      // emitter.off('update.seq', updateSeq);
    }
  })
</script>

<div class="view--toolbar rounded">
  <button 
    type="button" 
    class="btn btn-outline-dark" 
    class:active={$minimalInterface}
    aria-label={$minimalInterface ? 'Show Controls' : 'Hide Controls'} 
    use:tooltip 
    on:click={toggleInterface}>
    <i 
      class:fa-solid={!$minimalInterface}
      class:fa-eye={!$minimalInterface}
      class:fa-regular={$minimalInterface}
      class:fa-eye-slash={$minimalInterface}
      ></i>
  </button>

  <!-- <button type="button" class="btn btn-outline-dark d-none d-sm-block">
    <i class="fa-regular fa-circle-question"></i>
  </button> -->

  {#if ! $minimalInterface}
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
    <button type="button" class="btn btn-outline-dark" aria-label="Zoom In" use:tooltip on:click={() => zoom(1)}>
      <i class="fa-solid fa-plus"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" aria-label="Zoom Out" use:tooltip on:click={() => zoom(-1)}>
      <i class="fa-solid fa-minus"></i>
    </button>
  </div>
  {/if}

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

</style>