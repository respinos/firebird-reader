<svelte:options accessors={true} />
<script>

  import { onMount, getContext, onDestroy } from 'svelte';
  import { afterUpdate } from 'svelte';
  import { get } from 'svelte/store';

  import { tooltip } from '../../lib/tooltip';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');
  const q1 = manifest.q1;
  const selected = manifest.selected;

  import PageText from '../PageText/index.svelte';
  import SearchHighlights from '../SearchHighlights/index.svelte';

  import { extractHighlights } from '../../lib/highlights';

  export let observer;
  export let handleIntersecting;
  export let handleUnintersecting;
  export let format;

  let pageDiv;

  const view = manifest.currentView;
  const minimalInterface = manifest.minimalInterface;

  export let seq;
  export let canvas;
  export let zoom;
  export let style = null;
  export let area = null;
  export let mode = 'page';

  let focused = false;
  let invoked = false;

  let pageNum = manifest.pageNum(seq);

  export let innerHeight = window.innerHeight;
  export let innerWidth = window.innerWidth;

  export const scrollIntoView = function() {
    pageDiv.scrollIntoView({ behavior: 'instant'});
  }

  export const focus = function(invoke=false) {
    focused = true;
    invoked = invoke;
    // if ( invoke === true ) {
    //   setTimeout(() => {
    //     pageDiv.focus();
    //   }, 0);
    // }
  }

  export const unfocus = function() {
    focused = false;
    if ( pageDiv == document.activeElement ) { pageDiv.blur(); }
  }

  export const visible = function(viewport) {
    let top = pageDiv.offsetTop;
    let height = parseInt(pageDiv.dataset.height, 10);
    let bottom = top + height;

    let rootMargin = 0;

    let pageIsVisible = ( top >= ( viewport.top - rootMargin ) && bottom <= ( viewport.bottom + rootMargin ));
    let bottomIsVisible = ( top < ( viewport.top - rootMargin ) && viewport.top < ( bottom + rootMargin ) )
    let topIsVisible = ( top < ( viewport.bottom + rootMargin ) && viewport.bottom < ( bottom + rootMargin ));

    let percentage = 0; let test;
    if ( topIsVisible || bottomIsVisible || pageIsVisible ) {
      // now we're visible
      if ( pageIsVisible ) {
        percentage = 1.0;
        test = 'topIsVisible && bottomIsVisible';
      } else if ( topIsVisible ) {
        // only the top is visible
        let heightVisible = viewport.bottom - top;
        percentage = heightVisible / height;
        test = 'topIsVisible';
      } else if ( bottomIsVisible ) {
        let heightVisible = bottom - viewport.top;
        percentage = heightVisible / height;
        test = 'bottomIsVisible';
      }
    }

    // console.log("-- visible", seq, percentage, { top, bottom }, viewport );

    return percentage;
  }

  let pageZoom = 1;

  let scan;
  let image;
  let text;
  let matches;
  let page_coords;
  let pageText;
  let figCaption;
  let pageTextIsLoaded = false;
  let objectUrl;
  let isLoaded = false;
  let hasPageText = false;

  let timeout;

  // cgi/imgsrv/thumbnail?id={canvas.id}&seq={seq}
  let defaultThumbnailSrc = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
  export let thumbnailSrc = defaultThumbnailSrc;

  export function toggle(visible) {
    isVisible = visible;
    if (visible) {
      timeout = setTimeout(
        format == 'image' ? loadImage : loadPageText, 
        500)
      ;
    } else {
      if ( format == 'image' ) {
        unloadImage();
      }
      unloadPageText();
    }
  }

  const updateMatches = function(coords, values) {
    matches = [ ...values ];
    page_coords = [ ...coords ];
  }

  let imageSrc;
  export const loadImage = function(reload=false) {
    timeout = null;
    if ( image && image.src != defaultThumbnailSrc || reload ) { console.log(":: not loading DUPE", image.src); return ; }
    let height = scanHeight * window.devicePixelRatio;
    let action = ( $view == 'thumb' ) ? 'thumbnail' : 'image';
    imageSrc = `/cgi/imgsrv/${action}?id=${canvas.id}&seq=${seq}&height=${height}`;
    fetch(imageSrc)
      .then((response) => {
        let size = response.headers.get('x-image-size');
        // console.log(...response.headers);
        let parts = size.split('x');
        let ratio = canvas.height / parseInt(parts[1], 10);
        let width = Math.ceil(parseInt(parts[0], 10) * ratio);
        canvas.width = width;
        canvas.useWidth = Math.ceil(canvas.useHeight * ( canvas.width / canvas.height ));
        canvas = canvas;
        // console.log("--", seq, size, `${canvas.width}x${canvas.height}`);
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if ( image ) {
          // console.log("-- page.mount", seq, canvas);
          image.src = objectUrl;
          isLoaded = true;
          loadPageText();
          emitter.on('update.highlights', loadPageText);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })    
  }

  export const unloadImage = function() {
    URL.revokeObjectURL(objectUrl);
    if ( image ) {
      image.src = defaultThumbnailSrc;
    }
    // console.log("---- unload", seq, image);
  }

  const unloadPageText = function() {
    if ( figCaption ) { figCaption.innerHTML = ''; }
    emitter.off('update.highlights', loadPageText);
  }

  export const loadPageText = function() {

    if ( ! figCaption ) { return ; }

    if ( mode != 'page' ) { return ; }

    // console.log("-- loadPageText", mode, $q1);

    function parseCoords(value) {
      var values = value.split(' ')
      return values.map((v) => parseInt(v, 10));
    }

    // if ( pageText && pageText.querySelector('.ocr_page') ) { return ; }
    let text_src = `/cgi/imgsrv/html?id=${canvas.id}&seq=${seq}`;
    if ( $q1 ) { text_src += `&q1=${$q1}`; }
    // need to deal with q1
    fetch(text_src)
      .then((response) => {
        return response.text();
      })
      .then(text => {

        if ( ! figCaption ) { return ; }

        // if ( ! pageText ) { return ; }
        // pageText = text.replace('<div class="ocr_page"', '<div class="ocr_page" data-words="[&quot;lowndes&quot;]"');
        text = text.replace(/<span class="ocr_line"/g, '<span class="ocr_line" role="text"');
        const parser = new DOMParser();
        const ocr_div = parser.parseFromString(text, 'text/html').body.childNodes[0];

        if ( ocr_div.textContent.trim() == "" || ! ocr_div.textContent.trim().match(/\w+/) ) {
          ocr_div.innerHTML = `<div class="alert alert-block alert-secondary fs-1 fw-bold text-center">NO TEXT ON PAGE</div><p>This page does not contain any text recoverable by the OCR engine.</p>`;
        }

        page_coords = parseCoords(ocr_div.dataset.coords);
        // -- do we need this?
        // ocr_div.classList.add('visually-hidden');
        // console.log("loadPageText", seq, page_coords, ocr_div.dataset.words);

        // we have text so watch for updates
        figCaption.innerHTML = '';
        figCaption.dataset.loaded = true;
        figCaption.append(ocr_div);

        // if we have no page coordinates, there's no highlighting
        if ( ! ocr_div.dataset.coords ) { return; }

        // if no words match, there's no highlighting
        let words = JSON.parse(ocr_div.dataset.words || '[]');
        if ( ! words || ! words.length ) { return ; }


        matches = extractHighlights(words, ocr_div);
      })

      if ( format == 'plaintext' && figCaption.dataset.configured != 'true' ) {
        emitter.on('update.highlights', loadPageText);
        figCaption.dataset.configured = true;
      }
  }

  const imageOnLoad = function(event) {
    if ( rotateX != 0 ) { return ; }
    // console.log("!", seq, rotateX, event.target.naturalWidth, event.target.naturalHeight);
    // if ( event.target.naturalHeight != scanHeight ) {
    //   scanHeight = event.target.naturalHeight;
    //   scanAdjusted = true;
    // }
  }

  const rotateScan = function() {
    orient = ( orient + 90 ) % 360;
    if ( orient == 90 || orient == 270 ) {
      // we need to set the margins
      orientMargin = ( ( scanHeight * 0.80 ) / 2 / 2 ) * -1;
    } else {
      orientMargin = 0;
    }
  }

  const updateZoom = function(delta) {
    pageZoom += delta;
    loadImage(true);
    // emitter.emit('update.zoom.page', { seq, delta });
  };

  function calculateRatio(canvas) {
    if ( canvas.height > canvas.width ) {
      return innerHeight / canvas.height;
    }
    let width = innerWidth * 0.6;
    let ratio = width / canvas.width;
    return ratio;
  }

  function calculate(value, zoom) {
    // console.log("calculate", value, scanRatio, zoom);
    return Math.ceil(value * scanRatio * zoom);
  }

  function calculateZoom(zoom, pageZoom) {
    if ( pageZoom > 1 ) { return pageZoom; }
    return zoom;
  }

  function calculatePage(value, zoom) {
    if ( zoom == 1 ) { return null; }
    return `${Math.ceil(value * scanRatio * zoom)}px`;
  }

  function checkForFoldout() {
    if ( $view == 'thumb' || format != 'image' ) { return false; }
    if ( canvas.width < canvas.height ) { return false; }
    console.log("-- checkForFoldout", manifest.checkFeatures(seq, "FOLDOUT"));
    return (
      manifest.checkFeatures(seq, "FOLDOUT") && 
      ! manifest.checkFeatures(seq, "BLANK")
    ) || (
      ( canvas.width / canvas.height ) > ( 4 / 3 )
    );
  }

  $: isVisible = false;
  $: scanZoom = calculateZoom(zoom, 1);
  $: scanRatio = calculateRatio(canvas);
  $: scanHeight = calculate(canvas.height, scanZoom) || '99%';
  $: scanWidth = calculate(canvas.width, scanZoom) || 'auto';
  $: imgHeight = calculatePage(canvas.height, pageZoom);
  $: imgWidth = calculatePage(canvas.width, pageZoom);
  $: scanAdjusted = false;
  $: orient = 0;
  $: rotateX = 0;
  $: orientMargin = 0;
  $: isUnusual = checkForFoldout(canvas);

  $: if ( invoked && pageDiv ) { pageDiv.focus(); }
  $: if ( isVisible && format == 'image' && ! image ) { loadImage(); }
  $: if ( isVisible && format == 'plaintext' && ! figCaption ) { loadPageText(); }

  // $: console.log(">> zoom", zoom, pageZoom, scanHeight, scanWidth);

  let testWidth, testHeight;

  onMount(() => {
    // console.log("-- page.mount", seq, style);
    console.log("-- page.mount", seq, isVisible);

    return () => { 
      // console.log("-- page.unmount", seq);
      if(timeout) {
        clearTimeout(timeout);
        // console.log("-- app.unmount", seq);
      }
      unloadImage(); 
      emitter.off('update.highights', loadPageText);
    }
  })

  onDestroy(() => {
    console.log("-- Page DESTROY", seq);
  })

</script>

<!--   inert={!focused ? true : null} ??? -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div 
  class="page {format}" 
  {style} 
  data-seq={seq} 
  data-height={Math.ceil(scanHeight)}
  style:--pageWidth={zoom > 1 ? `${( innerWidth / 2 ) * zoom}px` : null}
  style:--pageHeight={zoom > 1 ? `${( innerHeight * zoom )}px` : null}
  style:--height={Math.ceil(scanHeight)}
  style:--width={Math.ceil(scanWidth)}
  style:--zoom={zoom != 1 ? zoom : pageZoom}
  class:view-2up={$view == '2up'}
  class:view-1up={$view == '1up'}
  class:verso={area == 'verso'}
  class:recto={area == 'recto'}
  class:view-thumb={area == 'thumb'}
  id="p{seq}" 
  aria-hidden={!focused}
  aria-label="Page scan {seq}"
  role="group"
  tabindex={focused ? 0 : -1}
  use:observer 
  on:intersecting={handleIntersecting} 
  on:unintersecting={handleUnintersecting}
  bind:this={pageDiv}>

  <details 
    class="page-menu" 
    class:sticky={get(manifest.currentView) == '1up'}
    class:invisible={$minimalInterface}
    open={$selected.has(seq) ? true : null}
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
      {#if manifest.allowFullDownload}
      <button 
        type="button" 
        class="btn btn-light border border-dark"
        use:tooltip
        on:click={(event) => manifest.select(seq, event)}
        aria-label={$selected.has(seq) ? `Page scan #${seq} is selected` : `Select page scan #${seq}`}
        aria-pressed={$selected.has(seq)}
        ><i 
          class="fa-regular"
          class:fa-square={!$selected.has(seq)}
          class:fa-square-check={$selected.has(seq)}></i>
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
      {#if $view == '1up' && format == 'image'}
      <button type="button" class="btn btn-light border border-dark" on:click={rotateScan}><i class="fa-solid fa-rotate-right"></i></button>
      {/if}
      {#if $view == '1up' || $view == '2up'}
      <div class="btn-group-vertical" role="group">
        <button type="button" class="btn btn-light border border-dark" on:click={() => updateZoom(0.5)}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-light border border-dark" on:click={() => updateZoom(-0.5)}>
          <i class="fa-solid fa-minus" aria-hidden="true"></i>
        </button>
      </div>
      {/if}
      <!-- <button type="button" class="btn btn-light border border-dark" on:click={rotateScan}>
        <i class="fa-solid fa-download" aria-hidden="true"></i>
      </button> -->
    </div>
  </details>

  <figure class="frame {format}" 
    class:adjusted={canvas.width > canvas.height}
    class:zoomed={pageZoom > 1}
    data-orient={orient}
    style:--orient-margin={orientMargin}>
    {#if isVisible}
      {#if format == 'image'}
        <div class="image">
        <img 
          bind:this={image} 
          src={defaultThumbnailSrc} 
          alt="" 
          style:height={imgHeight}
          style:width={imgWidth}
          class:zoomed={pageZoom > 1}
          />
        {#if area != 'thumb'}
        <SearchHighlights image={image} page_coords={page_coords} matches={matches} format="image"></SearchHighlights>
        {/if}
        </div>
        {#if area != 'thumb'}
        <figcaption class="visually-hidden" bind:this={figCaption}>
        </figcaption>
        {/if}
      {:else}
        <SearchHighlights page_coords={page_coords} matches={matches} format="plaintext"></SearchHighlights>
        <figcaption class="plaintext" bind:this={figCaption}></figcaption>
      {/if}
    {/if}
  </figure>
</div>

<style lang="scss">
  .page {
    width: var(--pageWidth, 100%);
    height: var(--pageHeight, 100%);

    // display: flex;
    // flex-direction: column;
    // flex-direction: row;

    display: grid;
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;

    /* overflow: hidden; */
    position: relative;

    &.verso {
      grid-area: verso;
    }

    &.recto {
      grid-area: recto;
    }

    &.view-thumb {
      width: auto;
      // flex-direction: column;
      gap: 0.5rem;
      grid-template-rows: min-content 1fr;

      .page-menu {
        grid-row: 1/2;
      }

      figure {
        grid-row: 2/3;
      }
    }

    &:focus-visible {
      outline: 0;

      .frame img {
        // outline: 4px solid darkorange;
        --bs-btn-focus-shadow-rgb: 66,70,73;
        outline: 0;
        box-shadow: 0 0 0 0.25rem rgba(var(--bs-btn-focus-shadow-rgb), .5);
      }
      
    }
  }

  .frame {
    display: flex;

    margin: 0 auto;
    overflow: auto;

    position: relative;

    background: darkkhaki;

    grid-row: 1/2;
    grid-column: 1/2;

    &.image {
      max-width: 100%;
      height: 100%;
      width: 100%; // maybe?
      max-height: 100%; // maybe?
      align-items: center;
      overflow: hidden;

      .image {
        // max-height: calc(var(--height) * 0.9 * 1px);
        // max-width: calc(var(--width) * 0.9 * 1px);

        height: 100%;
        width: auto;

        position: relative;
        margin: 0 auto;

        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    &.plaintext {
      align-items: flex-start;
      min-height: calc(var(--height) * 0.9 * 1px);
      width: 80%;
      max-width: 80rem;
      padding: 2rem 1rem;

      box-shadow: 0px 10px 13px -7px #000000, 0px 6px 15px 5px rgba(0, 0, 0, 0);
      border: 1px solid #ddd;    

      transition: height 100ms;
    }

  }

  .frame:hover {
    border: 1px solid darkorange;
  }

  figure img {
    // height: 99%;
    display: block;
    margin: auto;

    max-height: 99%;
    max-width: 100%;
    width: auto;
    height: auto;

    background: #f9f8f5;
    box-shadow: 0px 10px 13px -7px #000000, 0px 6px 15px 5px rgba(0, 0, 0, 0);
    border: 1px solid #ddd;    
  }

  figure.adjusted {
    /* max-width: 100%; */
    margin: auto;
  }

  figure.zoomed {
    overflow: auto !important;

    img {
      max-height: none;
      max-width: none;
    }
  }

  figure.adjusted img {
    height: auto;
    width: 100%;
    max-height: 100%;
  }

  .frame:is([data-orient="90"]) {
    /* max-width: 100%;
    height: auto; */
    transform: rotate(90deg) scale(0.8) !important;
    margin-top: calc(var(--orient-margin) * 1px) !important;
    margin-bottom: calc(var(--orient-margin) * 1px) !important;
  }

  .frame:is([data-orient="180"]) {
    /* max-width: 100%;
    max-height: 100%;
    width: 100%; */
    transform: rotate(180deg) !important;
  }

  .frame:is([data-orient="270"]) {
    /* max-width: 100%;
    height: auto; */

    transform: rotate(270deg) scale(0.8) !important;
    margin-top: calc(var(--orient-margin) * 1px) !important;
    margin-bottom: calc(var(--orient-margin) * 1px) !important;
  }

  figcaption.plaintext {
    --font-size: var(--page-text-font-size, 1.125rem);
    font-size: calc(var(--font-size) * var(--zoom));
    line-height: 1.25;
  }

  .page-menu {
    order: 2;
    text-align: right;
    padding: 0;
    margin: 0;
    z-index: 50;
    align-self: flex-start;
    // margin-left: -5rem;

    grid-row: 1/2;
    grid-column: 1/2;
    align-self: start;
    justify-self: end;
  }

  .page.view-1up {
    .page-menu {
      position: sticky;
      top: 0.5rem;
      right: 0.5rem;
      // margin-left: -5rem;
    }
  }

  .page.view-thumb {
    .page-menu {
      // align-self: flex-end;
      // order: 0;

      .menu-items {
        position: absolute;
        right: 0;
      }
    }
  }

  .page.view-2up {
    .page-menu {
      // position: absolute;
      // top: 0.5rem;
      // right: 0.5rem;
    }

    &.verso {
      .page-menu {
        // left: 0.5rem;
        // right: auto;
        justify-self: start;
      }

      figure {
        margin-right: 0px;

        .image, img {
          margin-right: 0px;
        }
      }
    }

    &.recto {
      figure {
        margin-left: 0px;

        .image, img {
          margin-left: 0px;
        }
      }
    }

    figure {
      margin-top: 1rem;
      
      &.plaintext {
        width: 85%;
      }
    }
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

  .page-menu.deux {
    width: auto;
    text-align: center;
  }

  .width-min-content {
    width: min-content;
  }

  .bg-vaguely-white {
    background-color: rgba(255,255,255,0.5) !important;
  }

  img.zoomed {
    align-self: flex-start;
  }
</style>
