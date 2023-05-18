<script>
  import { onMount, getContext } from 'svelte';

  import ViewMenu from './ViewMenu.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  const currentSeq = manifest.currentSeq;
  $: seq = $currentSeq;

  // const updateSeq = function(data) {
  //   if ( data ) { seq = data; }
  // }

  const goto = function(args) {
    console.log("-- goto.page", args);
    emitter.emit('goto.page', args);
  }

  const zoom = function(delta) {
    emitter.emit('update.zoom', delta);
  }

  // emitter.on('update.seq', updateSeq);

  onMount(() => {
    return () => {
      // emitter.off('update.seq', updateSeq);
    }
  })
</script>

<div class="view--toolbar rounded">
  <button type="button" class="btn btn-outline-dark">
    <i class="fa-solid fa-eye"></i>
  </button>

  <button type="button" class="btn btn-outline-dark">
    <i class="fa-regular fa-circle-question"></i>
  </button>

  <!-- navigation form -->
  <form>
    <div class="d-flex align-items-center gap-1 bg-dark text-light p-1 px-2 rounded">
      <span>#</span>
      <input bind:value={seq} type="number" class="form-control text-center" min="1" max={manifest.totalSeq} on:change={() => goto({ seq: seq })} on:blur={() => goto({ seq: seq })} />
      <span>/</span>
      <span>{manifest.totalSeq}</span>
    </div>
  </form>

  <ViewMenu></ViewMenu>

  <div class="btn-group" role="group" aria-label="Zoom">
    <button type="button" class="btn btn-outline-dark" on:click={() => zoom(1)}>
      <i class="fa-solid fa-plus"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => zoom(-1)}>
      <i class="fa-solid fa-minus"></i>
    </button>
  </div>

  <div class="btn-group" role="group" aria-label="Pagination">
    <button type="button" class="btn btn-outline-dark" on:click={() => goto({ seq: 1 })}>
      <i class="fa-solid fa-chevron-left border-start border-3 border-dark"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => goto({ delta: -1 })}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => goto({ delta: 1 })}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => goto({ seq: manifest.totalSeq })}>
      <i class="fa-solid fa-chevron-right border-end border-3 border-dark"></i>
    </button>
  </div>

  <button type="button" class="btn btn-outline-dark">
    <i class="fa-solid fa-maximize"></i>
  </button>

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

</style>