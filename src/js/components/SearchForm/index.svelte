<script>
  import { onMount, beforeUpdate, tick, getContext } from 'svelte';
  import { get } from 'svelte/store';
  import { tooltip } from '../../lib/tooltip';

  const manifest = getContext('manifest');
  const emitter = getContext('emitter');
  
  export let inPanel = true;
  let hTag = inPanel ? 'h4' : 'h3';
  export let onClick = function(seq) { alert(seq); }

  let start = 1;
  let sz = 25;
  let sort = 'seq';
  let showHighlights = true;
  document.documentElement.dataset.showHighlights = showHighlights;

  let searchUrl = new URL(location.href);
  let searchParams = searchUrl.searchParams;

  let q1 = get(manifest.q1);
  let btnSubmit;
  let alert;
  let inFetch = false;
  let targetNewTab = HT.prefs.get()?.pt?.submitTarget || false;
  let blankTabForm;

  let payload = manifest.payload;
  let hasPreviousItem = false;
  let hasNextItem = false;
  let nextHref; let prevHref;
  let status = { class: null };
  if ( manifest.payload ) {
    q1 = manifest.payload.q1;
    configureNavigationLinks();
    summarizePayload();
  }

  function toggleHighlights() {
    showHighlights = ! showHighlights;
    document.documentElement.dataset.showHighlights = showHighlights;
  }

  function configureNavigationLinks() {
    hasNextItem = payload.next;
    hasPreviousItem = payload.prev;

    if ( hasNextItem ) {
      searchParams.set('start', payload.next);
      searchUrl.search = searchParams.toString();
      nextHref = searchUrl.toString();
    }

    if ( hasPreviousItem ) {
      searchParams.set('start', payload.prev);
      searchUrl.search = searchParams.toString();
      prevHref = searchUrl.toString();
    }
  }

  function argh(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  function summarizePayload() {
    let message;
    if ( payload.totalResults > 0) {
      message = `Showing ${payload.startRecord}-${payload.endRecord} of ${payload.totalResults} results for ${q1}`;
    } else {
      message = `No results found for ${q1}`;
    }
    updateStatus({ class: 'alert-primary', message: message});
  }

  function updateStatus(options) {
    status.class = options.class;
    status.message = options.message;
    status = status;
  }

  function onSubmit(event, args) {
    const params = Object.assign({}, args);
    let searchUrl = new URL(`${location.protocol}//${HT.service_domain}/cgi/pt/search`);
    let searchParams = new URLSearchParams();
    searchParams.set('id', manifest.id);
    searchParams.set('start', start);
    searchParams.set('sz', 25);
    searchParams.set('q1', q1);
    searchParams.set('sort', params.sort || sort);
    if ( ! showHighlights ) {
      searchParams.set('hl', 'false');
    }

    if ( ! targetNewTab ) {
      searchParams.set('format', 'json');
    }

    searchUrl.search = searchParams.toString();

    if ( targetNewTab ) {
      payload = null;
      updateStatus({ class: null, message: null });
      blankTabForm.submit();
      return;
    }

    updateStatus({ class: 'alert-primary', message: 'Searching...'});
    payload = null;

    fetch(searchUrl.toString(), { credentials: 'include' })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        inFetch = true;
        payload = data;

        configureNavigationLinks();
        summarizePayload();
        manifest.q1.set(q1);
        emitter.emit('update.highlights', q1);
      })
    }

    function clearSearchForm() {
      payload = null;
      status.class = null;
      q1 = '';
    }

    function jumpToPage(event) {
      onSubmit();
    }

    function gotoPage(page) {
      start = page;
      onSubmit();
    }

    beforeUpdate(async () => {
      if (inFetch) {
        await tick();
        alert.focus();
        inFetch = false;
      }
    })

</script>

<form on:submit|preventDefault={onSubmit}>
  {#if !inPanel}
  <div class="mb-1">
    <label class="form-label" for="q1">Search in this text:</label>
  </div>
  {/if}
  <div class="d-flex flex-nowrap gap-2">
    <div class="flex-grow-1 input-group">
      <input id="q1" type="text" class="form-control" bind:value={q1} />
      <button type="submit" class="btn btn-outline-secondary" aria-label="Submit search" bind:this={btnSubmit}>
        <i class="fa-solid fa-magnifying-glass"></i>
      </button>
    </div>
    {#if true || inPanel}
    <div class="d-flex flex-nowrap gap-1">
      <button class="btn btn-outline-secondary" 
        type="button"
        aria-label="Clear search" 
        data-bs-placement="right"
        disabled={payload == null}
        use:tooltip
        on:click={clearSearchForm}>
        <i class="fa-regular fa-circle-xmark"></i>
      </button>
    </div>
    {/if}
  </div>
  {#if inPanel}
  <div class="mt-2">
    <div class="form-check fs-7">
      <input 
        class="form-check-input" 
        type="checkbox" 
        bind:checked={targetNewTab} 
        on:change={() => HT.prefs.set({ pt: { submitTarget: targetNewTab }})}
        id="search-form-target">
      <label class="form-check-label" for="search-form-target">
        Open results in a new tab
      </label>
    </div>
  </div>
  {/if}
</form>
{#if status.class}
<div class="alert {status.class} mt-3" tabindex="-1" bind:this={alert}>
  {status.message}
</div>
{/if}
{#if payload && payload.totalResults > 0}
  <div class="d-flex align-items-center justify-content-between border rounded p-1 mb-3">
    <div class="btn-group" role="group" aria-label="Sort Results">
      <button 
        type="button" 
        class="btn btn-outline-secondary" 
        class:active={sort == 'score'} 
        use:tooltip 
        aria-label="Sort by relevance"
        on:click={(event) => { sort = 'score'; onSubmit() }}>
        <i class="fa-solid fa-arrow-down-wide-short" aria-hidden="true"></i>
      </button>
      <button 
        type="button" 
        class="btn btn-outline-secondary" 
        class:active={sort == 'seq'} 
        use:tooltip 
        aria-label="Sort by page scan"
        on:click={(event) => { sort = 'seq'; onSubmit() }}>
        <i class="fa-solid fa-arrow-up-1-9" aria-hidden="true"></i>
      </button>
    </div>
    {#if payload.finalAccessStatus == 'allow'}
    <button 
      type="button" 
      class="btn btn-outline-secondary" 
      class:active={showHighlights}
      on:click={toggleHighlights}
      use:tooltip
      aria-label={showHighlights ? 'Hide Highlights' : 'Show Highlights'}>
      <i class="fa-solid fa-sun" aria-hidden="true"></i>
    </button>
    {/if}
  </div>
  <div class="mb-3">
    {#each payload.results as item}
      <article class="mb-3">
        <svelte:element this={hTag} class="d-flex align-items-center gap-1">
          {#if payload.finalAccessStatus == 'allow'}
          <a 
            href="/cgi/pt?id={manifest.id}&seq={item.seq}&q1={q1}&start={payload.range.value}" 
            class="btn btn-link fw-bold p-0" 
            data-seq={item.seq}
            on:click|preventDefault={onClick}>
            #{item.seq}
            {#if item.pageNum}
              (p. #{item.pageNum})
            {/if}
          </a>
          {:else}
          <span>
          #{item.seq}
          {#if item.pageNum}
            (p. #{item.pageNum})
          {/if}
          </span>
          {/if}
          <span>
              - {item.termHitCount} matching 
            {#if item.termHitCount == 1}term{:else}terms{/if}
          </span>
        </svelte:element>
        {#each item.kwics as kwic}
          <p class="kwic mb-3" class:kwic-lg={!inPanel}>...{@html argh(kwic)}...</p>
        {/each}
      </article>
    {/each}
  </div>
  {#if payload.range && payload.totalResults > 0 && payload.range.max > 1}
  <nav aria-label="Result navigation" class="d-flex flex-column align-items-start justify-content-between flex-sm-row align-items-sm-center gap-3">
    <div>
      <ul class="list-unstyled d-flex gap-1 m-0">
        <li>
          <a 
            aria-hidden={!hasPreviousItem} 
            aria-disabled={!hasPreviousItem}
            role={!hasPreviousItem ? 'link' : undefined}
            disabled={!hasPreviousItem} 
            class:disabled={!hasPreviousItem} 
            href={hasPreviousItem ? prevHref : undefined}
            data-start={payload.prev}
            on:click|preventDefault={() => gotoPage(payload.prev)}
            class="btn btn-outline-secondary d-inline-flex align-items-center gap-1 text-decoration-none">
              <i aria-hidden="true" class="fa-solid fa-chevron-left"></i>
              <span class:visually-hidden={inPanel}>Previous</span>
          </a>
        </li>
        <li>
          <a 
            aria-hidden={!hasNextItem} 
            aria-disabled={!hasNextItem}
            role={!hasNextItem ? 'link' : undefined}
            disabled={!hasNextItem} 
            class:disabled={!hasNextItem} 
            href={hasNextItem ? nextHref : undefined}
            data-start={payload.next}
            on:click|preventDefault={() => gotoPage(payload.next)}
            class="btn btn-outline-secondary d-inline-flex align-items-center gap-1 text-decoration-none">
              <span class:visually-hidden={inPanel}>Next</span>
              <i aria-hidden="true" class="fa-solid fa-chevron-right"></i>
            </a>
        </li>
      </ul>
    </div>
    <form on:submit|preventDefault={jumpToPage}>
      <div class="d-flex gap-1 w-xxsm-50 align-items-center justify-content-end">
        <label for="results-pagination" class="form-label text-nowrap fw-normal m-0">Go to:</label>
        <input type="number" class="form-control" id="results-pagination" min={payload.range.min} max={payload.range.max} bind:value={start} />
        <span class="text-nowrap">of {payload.range.max}</span>
        <button type="submit" class="btn btn-secondary">Go</button>
      </div>
    </form>
  </nav>
  {/if}
{/if}
{#if targetNewTab}
<form bind:this={blankTabForm} target="_blank" class="d-none" action="/cgi/pt/search" method="GET">
  <input type="hidden" name="id" value={manifest.id} />
  <input type="hidden" name="q1" value={q1} />
  <input type="hidden" name="sz" value={sz} />
  <input type="hidden" name="start" value={start} />
  <input type="hidden" name="sort" value={sort} />
  <input type="hidden" name="hl" value={showHighlights} />
</form>
{/if}

<style>
  .input-group input[type="text"] {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
  }

  .kwic {
    font-size: 0.75rem;
  }

  .kwic.kwic-lg {
    font-size: 1rem;
    margin-left: 1rem;
  }
</style>