<script>
  import { getContext } from 'svelte';
  import { tooltip } from '../../lib/tooltip';
  
  const emitter = getContext('emitter');

  export let sticky = false;
  export let selected = false;
  export let focused = true;
  export let seq;
  export let pageNum;
  export let allowFullDownload = false;
  export let isUnusual = false;
  export let area = null;
  export let pageZoom = 1;

  let imageSrc;

  function rotateScan() { }
  function updateZoom() { }
  function selectPageScan() { }
</script>

<details 
  class="page-menu" 
  class:sticky={sticky}
  open={selected || null}
  >
  <summary 
    class="btn-dark"
    aria-hidden={!focused}
    tabindex={focused ? 0 : -1}
    >
    <div class="d-flex align-items-center justify-content-between shadow px-2 py-1 gap-2 rounded">
      <span class="seq">
        #{seq}
        {#if pageNum}
          ({pageNum})
        {/if}
      </span>
      <span class="arrow">
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </span>
    </div>
  </summary>
  <div class="d-flex flex-column gap-1 align-items-center width-min-content menu-items">
    {#if allowFullDownload}
    <button 
      type="button" 
      class="btn btn-light border border-dark"
      use:tooltip
      on:click={selectPageScan}
      aria-label={selected ? `Page scan #${seq} is selected` : `Select page scan #${seq}`}
      aria-pressed={selected}
      ><i 
        class="fa-regular"
        class:fa-square={selected}
        class:fa-square-check={selected}></i>
    </button>
    {/if}
    {#if isUnusual}
    <button 
      type="button"
      class="btn btn-light border border-dark"
      use:tooltip
      on:click={(event) => emitter.emit('open.lightbox', { src: imageSrc, alt: `Page scan #${seq}` })}
      data-bs-placement={area == 'verso' ? 'right' : 'left'}
      aria-label="Open foldout for page scan #{seq}"><i 
        aria-hidden="true"
        class="fa-solid fa-up-right-from-square fa-flip-horizontal"></i>
      </button>
    {/if}
    {#if true}
    <button type="button" class="btn btn-light border border-dark" on:click={rotateScan}><i class="fa-solid fa-rotate-right"></i></button>
    {/if}
    {#if true}
    <div class="btn-group-vertical" role="group">
      <button 
        type="button" 
        class="btn btn-light border border-dark" 
        disabled={pageZoom == 2.5}
        use:tooltip
        aria-label="Zoom in #{seq}"
        on:click={() => updateZoom(0.5)}>
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
      </button>
      <button 
        type="button" 
        class="btn btn-light border border-dark" 
        disabled={pageZoom == 1}
        use:tooltip
        aria-label="Zoom out #{seq}"
        on:click={() => updateZoom(-0.5)}>
        <i class="fa-solid fa-minus" aria-hidden="true"></i>
      </button>
    </div>
    {/if}
  </div>
</details>

<style>
  .page-menu {
    order: 2;
    text-align: right;
    padding: 0;
    margin: 0;
    z-index: 50;
    align-self: flex-start;

    grid-row: 1/2;
    grid-column: 1/2;
    align-self: start;
    justify-self: end;
  }

  .page-menu[open] .arrow i::before {
    content: "\F077";
  }

  .page-menu summary {
    --bs-btn-focus-box-shadow: 0 0 0 0.25rem rgba(var(--bs-btn-focus-shadow-rgb), .5);
    list-style: none;

    font-size: 0.875rem;

    color: var(--bs-btn-color);
    background-color: var(--bs-btn-bg);
    margin: 0.25rem;

    border: 2px solid var(--bs-btn-border-color);

    border-radius: 4px;

    font-family: "Roboto Mono", monospace;

    &:hover {
      background-color: var(--bs-btn-hover-bg);
      border-color: var(--bs-btn-hover-border-color);
      color: var(--bs-btn-hover-color);
    }

    &:focus-visible {
      color: var(--bs-btn-hover-color);
      background-color: var(--bs-btn-hover-bg);
      border-color: var(--bs-btn-hover-border-color);
      outline: 0;
      box-shadow: var(--bs-btn-focus-box-shadow);
    }
  }

  .page-menu > div {
    margin-top: 0.5rem;
    margin: 0.5rem auto;
    font-size: 1.5rem;
    --bs-btn-font-size: 1.5rem !important;
  }

  .page-menu .btn {
    --bs-btn-font-size: 1.5rem;
  }

  .page-menu summary {list-style: none}
  .page-menu summary::-webkit-details-marker {display: none; }

</style>