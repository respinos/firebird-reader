<script>

  import { onMount, getContext } from 'svelte';
  import { afterUpdate } from 'svelte';
  import { get } from 'svelte/store';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  import PageText from '../PageText/index.svelte';
  import SearchHighlights from '../SearchHighlights/index.svelte';

  import { extractHighlights } from '../../lib/highlights';

  export let observer;
  export let handleIntersecting;
  export let handleUnintersecting;

  const view = manifest.currentView;

  export let seq;
  export let canvas;
  export let zoom;
  export let style = null;
  export let area = null;

  export let innerHeight = window.innerHeight;
  export let innerWidth = window.innerWidth;

  let pageZoom = 1;

  let scan;
  let image;
  let text;
  let matches;
  let page_coords;
  let objectUrl;
  let isLoaded = false;

  let timeout;

  // cgi/imgsrv/thumbnail?id={canvas.id}&seq={seq}
  let defaultThumbnailSrc = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
  export let thumbnailSrc = defaultThumbnailSrc;

  export function toggle(visible) {
    isVisible = visible;
    if (visible) {
      timeout = setTimeout(loadImage, 500);
      // loadImage();
    } else {
      unloadImage();
    }
  }

  const updateMatches = function(coords, values) {
    matches = [ ...values ];
    page_coords = [ ...coords ];
  }

  export const loadImage = function(reload=false) {
    timeout = null;
    if ( image.src != defaultThumbnailSrc || reload ) { console.log(":: not loading DUPE", image.src); return ; }
    let height = scanHeight * window.devicePixelRatio;
    let img_src = `/cgi/imgsrv/image?id=${canvas.id}&seq=${seq}&height=${height}`;
    fetch(img_src)
      .then((response) => {
        let size = response.headers.get('x-image-size');
        // console.log(...response.headers);
        let parts = size.split('x');
        let ratio = canvas.height / parseInt(parts[1], 10);
        let width = Math.ceil(parseInt(parts[0], 10) * ratio);
        canvas.width = width;
        canvas.useWidth = Math.ceil(canvas.useHeight * ( canvas.width / canvas.height ));
        console.log("--", seq, size, `${canvas.width}x${canvas.height}`);
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if ( image ) {
          console.log("-- page.mount", seq, canvas);
          image.src = objectUrl;
          isLoaded = true;
          loadPageText();
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

  export const loadPageText = function() {

    function parseCoords(value) {
      var values = value.split(' ')
      return values.map((v) => parseInt(v, 10));
    }

    // if ( pageText && pageText.querySelector('.ocr_page') ) { return ; }
    let text_src = `/cgi/imgsrv/html?id=${canvas.id}&seq=${seq}`;
    // need to deal with q1
    fetch(text_src)
      .then((response) => {
        return response.text();
      })
      .then(text => {
        // if ( ! pageText ) { return ; }
        // pageText = text.replace('<div class="ocr_page"', '<div class="ocr_page" data-words="[&quot;lowndes&quot;]"');
        const parser = new DOMParser();
        const ocr_div = parser.parseFromString(text, 'text/html').body.childNodes[0];

        page_coords = parseCoords(ocr_div.dataset.coords);
        ocr_div.dataset.words = `["lowndes"]`;
        ocr_div.classList.add('visually-hidden');
        // pageText.append(ocr_div);

        let words = JSON.parse(ocr_div.dataset.words || '[]');
        if ( ! words || ! words.length ) { return ; }

        if ( ! ocr_div.dataset.coords ) { return; }

        matches = extractHighlights(words, ocr_div);
      })
  }

  const imageOnLoad = function(event) {
    if ( rotateX != 0 ) { return ; }
    console.log("!", seq, rotateX, event.target.naturalWidth, event.target.naturalHeight);
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
    let width = window.innerWidth * 0.6;
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

  $: console.log(">> zoom", zoom, pageZoom, scanHeight, scanWidth);

  let testWidth, testHeight;

  onMount(() => {
    console.log("-- page.mount", seq, style);

    return () => { 
      console.log("-- page.unmount", seq);
      if(timeout) {
        clearTimeout(timeout);
        console.log("-- app.unmount", seq);
      }
      unloadImage(); 
    }
  })

</script>

<div class="page" {style} data-seq={seq}
  style:--height={Math.ceil(scanHeight)}
  style:--width={Math.ceil(scanWidth)}
  class:view-2up={$view == '2up'}
  class:view-1up={$view == '1up'}
  class:verso={area == 'verso'}
  class:recto={area == 'recto'}
  use:observer 
  id="id{seq}" 
  on:intersecting={handleIntersecting} 
  on:unintersecting={handleUnintersecting}>

  <details class="page-menu" class:sticky={get(manifest.currentView) == '1up'}>
    <summary class="bg-dark text-white">
      <div class="d-flex align-items-center justify-content-between shadow px-3 py-2 gap-2 rounded">
        <span class="seq">#{seq}</span>
        <span class="arrow">
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </span>
      </div>
    </summary>
    <div class="d-flex flex-column gap-1 align-items-center xxme-0 width-min-content xxbg-vaguely-white">
      <button type="button" class="btn btn-light border border-dark"><i class="fa-regular fa-square"></i></button>
      <button type="button" class="btn btn-light border border-dark" on:click={rotateScan}><i class="fa-solid fa-rotate-right"></i></button>
      <div class="btn-group-vertical" role="group">
        <button type="button" class="btn btn-light border border-dark" on:click={() => updateZoom(0.5)}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-light border border-dark" on:click={() => updateZoom(-0.5)}>
          <i class="fa-solid fa-minus" aria-hidden="true"></i>
        </button>
      </div>
      <!-- <button type="button" class="btn btn-light border border-dark" on:click={rotateScan}>
        <i class="fa-solid fa-download" aria-hidden="true"></i>
      </button> -->
    </div>
  </details>
  <figure class="frame" class:adjusted={canvas.width > canvas.height} data-orient={orient} style:--orient-margin={orientMargin}>
    {#if isVisible}
    <img bind:this={image} src={defaultThumbnailSrc} alt="" style:height={imgHeight} style:width={imgWidth} />
    {/if}
    <SearchHighlights image={image} page_coords={page_coords} matches={matches}></SearchHighlights>
    <figcaption class="visually-hidden">
      <PageText hidden={true} canvas={canvas} seq={seq}></PageText>
    </figcaption>
  </figure>
</div>

<style lang="scss">
  .page {
    width: 100%;
    /* background: #ddd;
    border-bottom: 4px solid #666; */

    display: flex;
    flex-direction: column;
    /* align-items: center; */

    flex-direction: row;

    /* overflow: hidden; */
    position: relative;

    &.verso {
      grid-area: verso;
    }

    &.recto {
      grid-area: recto;
    }
  }

  .frame {
    display: flex;
    align-items: center;
    /* justify-content: center; */
    /* border: 1px solid darkorange; */
    /* padding: 1rem; */

    height: calc(var(--height) * 0.9 * 1px);
    width: calc(var(--width) * 0.9 * 1px);
    max-width: 100%;
    max-height: 100%; // maybe?

    /* max-width: 400px; */

    margin: 0 auto;
    overflow: auto;

    position: relative;

    /* box-shadow: 0 2px 2px 0 rgba(0,0,0,.14),0 3px 1px -2px rgba(0,0,0,.2),0 1px 5px 0 rgba(0,0,0,.12); */
  }

  .frame:hover {
    border: 1px solid darkorange;
  }

  figure img {
    height: 99%;
    display: block;
    margin: 0 auto;

    background: #f9f8f5;
    box-shadow: 0px 10px 13px -7px #000000, 0px 6px 15px 5px rgba(0, 0, 0, 0);
    border: 1px solid #ddd;    
  }

  figure.adjusted {
    /* max-width: 100%; */
    margin: auto;
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

  .page-menu {
    order: 2;
    text-align: right;
    // width: 11ch;
    padding: 0;
    margin: 0;
    z-index: 50;
    align-self: flex-start;
    // margin-left: -5rem;
  }

  .page.view-1up {
    .page-menu {
      position: sticky;
      top: 0.5rem;
      right: 0.5rem;
      margin-left: -5rem;
    }
  }

  .page.view-2up {
    .page-menu {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
    }

    &.verso {
      .page-menu {
        left: 0.5rem;
        right: auto;
      }

      figure {
        margin-right: 0;

        img {
          margin-right: 0;
        }
      }
    }

    &.recto {
      figure {
        margin-left: 0;

        img {
          margin-left: 0;
        }
      }
    }

    figure {
      margin-top: 1rem;
    }
  }


  
  .page-menu

  .page-menu[open] .arrow i::before {
    content: "\F077";
  }


  .page-menu summary {
    list-style: none;
    /*   padding: 0.5rem 0.75rem; */
    background: #333;
    color: #eee;

    border: 2px solid #333;
    background: #fff;
    color: #333;

    border-radius: 4px;

    font-family: "Roboto Mono", monospace;
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
</style>
