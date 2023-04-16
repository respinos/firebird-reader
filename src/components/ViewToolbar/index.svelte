<script>
  import { getContext } from 'svelte';

  let inputSeq;

  const emitter = getContext('emitter');

  emitter.on('update.seq', seq => {
    inputSeq.value = seq;
  })

  const updateSeq = function() {
    let seq = parseInt(inputSeq.value, 10);
    console.log("-- goto.page", seq);
    emitter.emit('goto.page', seq);
  }

  const goto = function(target) {
    console.log("-- goto.page", target);
    emitter.emit('goto.page', target);
  }

  const zoom = function(delta) {
    emitter.emit('update.zoom', delta);
  }
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
      <input bind:this={inputSeq} type="number" class="form-control text-center" value="1" min="1" max="102" on:change={updateSeq} on:blur={updateSeq} />
      <span>/</span>
      <span>102</span>
    </div>
  </form>

  <div class="btn-group dropup">
    <button type="button" class="btn btn-outline-dark dropdown-toggle text-uppercase" data-bs-toggle="dropdown" aria-expanded="false">
      <i class="fa-solid fa-up-down"></i>
      View
    </button>
    <ul class="dropdown-menu">
      <li>
        <span class="dropdown-header">
          <span>Page Format</span>
        </span>
      </li>
      <li>
        <button type="button" class="dropdown-item" href="#plaintext">
          <i class="fa-regular fa-file-lines"></i>
          <span>Plain Text</span>
        </button>
      </li>
    </ul>
  </div>

  <div class="btn-group" role="group" aria-label="Zoom">
    <button type="button" class="btn btn-outline-dark" on:click={() => zoom(1)}>
      <i class="fa-solid fa-plus"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => zoom(-1)}>
      <i class="fa-solid fa-minus"></i>
    </button>
  </div>

  <div class="btn-group" role="group" aria-label="Pagination">
    <button type="button" class="btn btn-outline-dark">
      <i class="fa-solid fa-chevron-left border-start border-3 border-dark"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => goto('PREV')}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <button type="button" class="btn btn-outline-dark" on:click={() => goto('NEXT')}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
    <button type="button" class="btn btn-outline-dark">
      <i class="fa-solid fa-chevron-right border-end border-3 border-dark"></i>
    </button>
  </div>

  <button type="button" class="btn btn-outline-dark">
    <i class="fa-solid fa-maximize"></i>
  </button>

</div>

<style>
  .view--toolbar {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    padding: 0.25rem;
    background: #fff;
    justify-content: flex-end;
    z-index: 100;
    gap: 0.5rem;
  }

</style>