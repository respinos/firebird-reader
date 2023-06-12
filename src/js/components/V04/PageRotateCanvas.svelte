<svelte:options accessors={true} />
<script>

  import { onMount, getContext, onDestroy, tick } from 'svelte';
  import { afterUpdate } from 'svelte';
  import { get } from 'svelte/store';

  import { tooltip } from '../../lib/tooltip';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  const q1 = manifest.q1;
  const selected = manifest.selected;

  import SearchHighlights from '../SearchHighlights/index.svelte';
  import PageMenu from './PageMenu';
  import PageMessage from './PageMessage';

  import { extractHighlights } from '../../lib/highlights';

  export let observer;
  export let handleIntersecting;
  export let handleUnintersecting;
  export let format;
  export let view;

  export let seq;
  export let canvas;
  export let zoom;
  export let style = null;
  export let side = null;
  
  export let innerHeight
  export let innerWidth;

  let pageDiv;
  let includePageText = ( view != 'thumb' );

  let focused = false;
  let invoked = false;

  let pageNum = manifest.pageNum(seq);

  let lastZoom = zoom;
  let pageZoom = 1;

  let scan;
  let image;
  let rotatedImage;
  let imageSrc;
  let text;
  let matches;
  let page_coords;
  let pageText;
  let figCaption;
  let pageTextIsLoaded = false;
  let objectUrl;
  let isLoaded = false;
  let isLoading = false;
  let hasPageText = false;

  let isRTL = manifest.direction() == 'rtl';

  let timeout;

  // cgi/imgsrv/thumbnail?id={canvas.id}&seq={seq}
  let defaultThumbnailSrc = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;

  export const scrollIntoView = function(params) {
    // pageDiv.scrollIntoView(params);
    pageDiv.scrollIntoView(false);
  }

  export const offsetTop = function() {
    return pageDiv.parentElement.offsetTop + pageDiv.offsetTop;
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
    // because we have spreads
    let top = pageDiv.parentElement.offsetTop + pageDiv.offsetTop;
    // let height = parseInt(pageDiv.dataset.height, 10);
    let height = pageDiv.clientHeight;
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
      clearTimeout(timeout);
      isLoaded = false;
    }
  }

  const updateMatches = function(coords, values) {
    matches = [ ...values ];
    page_coords = [ ...coords ];
  }

  let loadImageTimeout;
  let loadPageTextTimeout;
  export const loadImage = function(reload=false) {
    // console.log("-- page.loadImage", seq, isVisible, isLoaded);
    // return;
    clearTimeout(loadImageTimeout);
    const isDebugging = false;
    const delay = isDebugging ? 5 * 1000 : 500;
    loadImageTimeout = setTimeout(() => {
      loadImageActual(reload);
    }, delay);
  }
  export const loadImageActual = function(reload=false) {
    timeout = null;
    isLoading = true;
    // if ( image && image.src != defaultThumbnailSrc || reload ) { console.log(":: not loading DUPE", image.src); return ; }
    if ( ! image ) { console.log("-- page.loadImage - no image"); return ; }
    if ( image && image.src != defaultThumbnailSrc ) {
      if ( ! reload ) { 
        console.log("-- page.loadImage - not loading DUPE", seq, image.src)
        return ; 
      }
    }
    let height = ( view == 'thumb' ) ? 250 : Math.ceil(manifest.fit(scanHeight) * window.devicePixelRatio);
    let action = ( view == 'thumb' ) ? 'thumbnail' : 'image';
    imageSrc = `/cgi/imgsrv/${action}?id=${canvas.id}&seq=${seq}&height=${height}`;
    fetch(imageSrc)
      .then((response) => {
        let size = response.headers.get('x-image-size');
        // console.log(...response.headers);
        let parts = size.split('x');
        let naturalHeight = parseInt(parts[1], 10);
        let naturalWidth = parseInt(parts[0], 10) ;
        let ratio = canvas.height / naturalHeight;
        let width = Math.ceil(naturalWidth * ratio);

        canvas.width = width;
        canvas.useWidth = Math.ceil(canvas.useHeight * ( canvas.width / canvas.height ));
        canvas = canvas;
        let update = {
          height: canvas.height,
          width: width,
          size: {
            width: naturalWidth,
            height: naturalHeight
          }
        };

        let resolution = response.headers.get('x-image-resolution');
        if ( resolution ) {
          update.resolution = resolution.replace("/1", "").replace(/\.0+ /, ' ');
          const r = 300 / parseInt(update.resolution, 10);
          update.screenResolution = `${Math.ceil(update.size.width * r)}x${Math.ceil(update.size.height * r)}`
        }

        manifest.update(seq, update);
        canvas.ratio = manifest.meta(seq).ratio;
        return response.blob();
      })
      .then(blob => {
        if ( objectUrl ) {
          URL.revokeObjectURL(objectUrl);
        }
        objectUrl = URL.createObjectURL(blob);
        if ( image ) {
          image.src = objectUrl;
          isLoaded = true; isLoading = false;
          loadPageText();
          emitter.on('update.highlights', updatePageText);
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
    console.log("-- !! page.loadImage - unload", seq, image, orient);
  }

  const unloadPageText = function() {
    if ( figCaption ) { figCaption.innerHTML = ''; }
    emitter.off('update.highlights', updatePageText);
  }

  const updatePageText = function() {
    loadPageText(true);
  }

  let numPageTextLoaded = 0;
  export const loadPageText = function(reload=false) {
    // console.log("-- page.loadImage", seq, isVisible, isLoaded);
    // return;
    clearTimeout(loadPageTextTimeout);
    const isDebugging = false;
    const delay = isDebugging ? 5 * 1000 : 500;
    loadPageTextTimeout = setTimeout(() => {
      loadPageTextActual(reload);
    }, delay);
  }

  export const loadPageTextActual = function(reload=false) {
    // return;

    if ( ! isVisible ) { return ; }
    if ( ! figCaption ) { return ; }

    if ( ! includePageText ) { return ; }

    if ( figCaption && figCaption.dataset.loaded == 'true' && ! reload ) {
      return;
    }

    function parseCoords(value) {
      if ( ! value ) { return null; }
      var values = value.split(' ')
      return values.map((v) => parseInt(v, 10));
    }

    // if ( pageText && pageText.querySelector('.ocr_page') ) { return ; }
    let text_src = `/cgi/imgsrv/html?id=${canvas.id}&seq=${seq}`;
    if ( $q1 ) { text_src += `&q1=${$q1}`; }
    fetch(text_src)
      .then((response) => {
        return response.text();
      })
      .then(text => {

        numPageTextLoaded =+ 1;
        console.log("-- page.load.page.text #", seq, numPageTextLoaded);

        if ( ! figCaption ) { return ; }

        // if ( ! pageText ) { return ; }
        // pageText = text.replace('<div class="ocr_page"', '<div class="ocr_page" data-words="[&quot;lowndes&quot;]"');
        text = text.replace(/<span class="ocr_line"/g, '<span class="ocr_line" role="text"');
        const parser = new DOMParser();
        const ocr_div = parser.parseFromString(text, 'text/html').body.childNodes[0];

        if ( ocr_div.textContent.trim() == "" || ! ocr_div.textContent.trim().match(/\w+/) ) {
          ocr_div.innerHTML = `
            <div class="w-100 m-auto mt-3">
              <div class="alert alert-block alert-secondary fs-1 fw-bold text-center text-uppercase">
                No text on page
              </div>
              <p>This page does not contain any text recoverable by the OCR engine.</p>
            </div>`;
        }

        // -- do we need this?
        // ocr_div.classList.add('visually-hidden');
        // console.log("loadPageText", seq, page_coords, ocr_div.dataset.words);

        // we have text so watch for updates
        figCaption.innerHTML = '';
        figCaption.dataset.loaded = true;
        figCaption.append(ocr_div);

        // if no words match, there's no highlighting
        let words = JSON.parse(ocr_div.dataset.words || '[]');
        if ( ! words || ! words.length ) { return ; }

        page_coords = parseCoords(ocr_div.dataset.coords);

        matches = extractHighlights(words, ocr_div);
      })

      if ( format == 'plaintext' && figCaption.dataset.configured != 'true' ) {
        emitter.on('update.highlights', updatePageText);
        figCaption.dataset.configured = true;
        isLoaded = true;
      }
  }

  const rotateScan = async function() {
    orient = ( orient + 90 ) % 360;
    if ( orient == 0 ) { return ; }

    if ( ! rotatedImage ) {
      await tick();
    }
    console.log("-- page.rotateScan", seq, rotatedImage);
    drawRotatedImage();
  }

  const drawRotatedImage = async function() {
    // if ( ! rotatedImage ) {
    // }
    await tick();
    const context = rotatedImage.getContext('2d');
    rotatedImage.height = rotatedImage.width = 0;
    let imgWidth, imgHeight;
    if ( orient == 90 || orient == 270 ) {
      imgWidth = image.naturalWidth;
      imgHeight = image.naturalHeight;
    } else {
      imgWidth = image.naturalHeight;
      imgHeight = image.naturalWidth;
    }
console.log("-- page.drawRotatedImage", seq, image.naturalWidth, image.naturalHeight);
    rotatedImage.width = imgHeight;
    rotatedImage.height = imgWidth;
    context.save();
    context.translate(imgHeight / 2, imgWidth / 2);
    context.rotate((orient * Math.PI) / 180);
    if (orient == 90 || orient == 270) {
      context.drawImage(image, -(imgWidth / 2), -(imgHeight / 2));
    } else {
      context.drawImage(image, -(imgHeight / 2), -(imgWidth / 2));
    }
    context.restore();
    rotatedImage.dataset.ready = true;
  }

  const rotateScanXX = function() {
    let lastOrient = orient;
    let newOrient = ( orient + 90 ) % 360;
    let imageOrient = 90;

    if ( ! image ) { console.log("-- page.rotateScan - no image?", image); return ; }

    const scratch = document.createElement('canvas');
    const context = scratch.getContext('2d');
    scratch.height = scratch.width = 0;
    let imgWidth, imgHeight;
    if ( imageOrient == 90 || imageOrient == 270 ) {
      imgWidth = image.naturalWidth;
      imgHeight = image.naturalHeight;
    } else {
      imgWidth = image.naturalHeight;
      imgHeight = image.naturalWidth;
    }
    scratch.width = imgHeight;
    scratch.height = imgWidth;
    context.save();
    context.translate(imgHeight / 2, imgWidth / 2);
    context.rotate((imageOrient * Math.PI) / 180);
    if (imageOrient == 90 || imageOrient == 270) {
      context.drawImage(image, -(imgWidth / 2), -(imgHeight / 2));
    } else {
      context.drawImage(image, -(imgHeight / 2), -(imgWidth / 2));
    }
    context.restore();
    const dataURL = scratch.toDataURL('image/jpeg');
    scratch.remove();
    orient = newOrient;
    let oldDataURL = image.src;
    image.src = dataURL;
    // scratchImage.style.position = 'fixed';
    // scratchImage.style.top = '0px'; scratchImage.style.left = '0px';
    // document.body.append(scratchImage);
    // image = image;
    console.log("-- page.rotate.scan", imageOrient, orient, oldDataURL != dataURL, image.naturalWidth, image.naturalHeight);
  }

  const updateZoom = function(delta) {
    if ( zoom != 1 && pageZoom == 1 ) { pageZoom = zoom; }
    pageZoom += delta;
    loadImage(true);
  };

  function calculateRatio(innerHeight, canvas) {
    if ( canvas.height > canvas.width ) {
      return innerHeight / canvas.height;
    }
    let width = innerWidth * 0.6;
    let ratio = width / canvas.width;
    // console.log("calculateRatio", seq, innerWidth, width, canvas.height, canvas.width);
    return ratio;
  }

  function calculate(innerHeight, canvas, key, zoom, orient) {
    // console.log("calculate", seq, value, scanRatio, zoom, innerHeight);
    let altkey = ( key == 'height' ) ? 'width' : 'height';
    let value = ( orient % 180 == 0 ) ? canvas[key] : canvas[altkey];
    console.log("-- page.calculate", key, value, orient, orient % 180);
    return Math.ceil(value * scanRatio * zoom);
  }

  function calculateZoom(zoom, pageZoom) {
    if ( pageZoom > zoom ) { return pageZoom; }
    return zoom;
  }

  function calculatePage(innerHeight, value, zoom) {
    if ( zoom == 1 ) { return null; }
    // console.log("calculatePage", seq, value, scanRatio, zoom);
    return `${Math.ceil(value * scanRatio * zoom)}px`;
  }

  function checkForFoldout() {
    if ( view == 'thumb' || format != 'image' ) { return false; }
    let meta = manifest.meta(seq);
    if ( orient != 0 ) { console.log("-- page.checkForFoldout", seq, meta.width, meta.height); }
    if ( meta.width < meta.height ) { return false; }
    // console.log("-- checkForFoldout", manifest.checkFeatures(seq, "FOLDOUT"));
    return (
      manifest.checkFeatures(seq, "FOLDOUT") && 
      ! manifest.checkFeatures(seq, "BLANK")
    ) || (
      ( meta.width / meta.height ) > ( 4 / 3 )
    );
  }

  function openLightbox(event) {
    emitter.emit('open.lightbox', { src: imageSrc, alt: `Page scan #${seq}` });
  }

  function shouldLoadImage(image) {
    let retval = ! isLoaded;
    if ( ! image ) { retval = false; }
    if ( image && image.src != defaultThumbnailSrc ) { retval = false; }
    // console.log("-- page.loadImage - shouldLoadimage", seq, retval, isLoaded, isLoading);
    return retval;
  }

  $: isVisible = false;
  $: scanZoom = calculateZoom(zoom, pageZoom);
  $: scanRatio = calculateRatio(innerHeight, canvas);
  $: scanHeight = calculate(innerHeight, canvas, 'height', scanZoom, orient);
  $: scanWidth = calculate(innerHeight, canvas, 'width', scanZoom, orient);
  $: scanUseRatio = manifest.meta(canvas.seq).ratio;
  // $: imgHeight = calculatePage(innerHeight, canvas.height, pageZoom);
  // $: imgWidth = calculatePage(innerHeight, canvas.width, pageZoom);
  $: scanAdjusted = false;
  $: orient = 0;
  $: rotateX = 0;
  $: isUnusual = checkForFoldout(canvas);
  $: defaultPageHeight = null; // ( view == '2up' || view == '1up' ) ? null : `${scanHeight}px`;
  $: pageHeight = ( view == 'thumb' || zoom > 1 ) ? `${innerHeight * zoom}px` : null;
  $: pageWidth = ( view == 'thumb' || zoom > 1 ) ? `${innerWidth * zoom}px` : null;

  $: if ( invoked && pageDiv ) { pageDiv.focus(); }
  $: if ( isVisible && format == 'image' && shouldLoadImage(image) ) { loadImage(); }
  // $: if ( isVisible && format == 'image' && ! image ) { loadImage(); }
  // $: if ( zoom ) { console.log("-- zoom changed", zoom, lastZoom); }
  $: if ( zoom != lastZoom ) { loadImage(true); console.log("-- zoom reloading"); lastZoom = zoom; }
  $: if ( isVisible && format == 'image' && image && image.src == defaultThumbnailSrc ) { loadImage(true); }
  $: if ( isVisible && format == 'plaintext' && ( ! figCaption || figCaption.dataset.loaded == 'false' ) ) { loadPageText(); }
  $: if ( format ) { console.log("-- page.format", format); }

  const reloadPage = function(options) {
    if ( options.seq == seq ) {
      if ( options.visible === false ) {
        toggle(false);
        return;
      }
      if ( options.orient != null ) {
        orient = options.orient;
      }
      if ( image ) {
        loadImage(true);
      } else {
        toggle(true);
      }
    }
  }
  emitter.on('reload.page', reloadPage);

  onMount(() => {

    return () => { 
      // console.log("-- page.unmount", seq);
      if(timeout) {
        clearTimeout(timeout);
        // console.log("-- app.unmount", seq);
      }
      // unloadImage(); 
      emitter.off('update.highights', loadPageText);
      emitter.off('reload.page', reloadPage);
    }
  })

  // onDestroy(() => {
  //   console.log("-- Page DESTROY", seq);
  // })

</script>

<!--   inert={!focused ? true : null} ??? -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div 
  class="page {format}" 
  {style} 
  data-seq={seq} 
  data-xorient={orient}
  style:--zoom={zoom}
  style:--scanZoom={scanZoom}
  style:--ratio={scanUseRatio}
  style:--xxpaddingBottom={view == '2up' ? 5.5 * 16 : 0}
  style:--scanHeight={scanZoom != 1 ? `${scanHeight}px` : null}
  style:--scanWidth={scanZoom != 1 ? `${scanWidth}px` : null}
  class:view-2up={view == '2up'}
  class:view-1up={view == '1up'}
  class:view-thumb={view == 'thumb'}
  class:verso={side == 'verso'}
  class:recto={side == 'recto'}
  class:direction-rtl={isRTL}
  class:zoomed={pageZoom > 1 && pageZoom != zoom}
  id="p{seq}" 
  aria-hidden={!focused}
  aria-label="Page scan {seq}"
  role="group"
  tabindex={focused ? 0 : -1}
  use:observer 
  on:intersecting={handleIntersecting} 
  on:unintersecting={handleUnintersecting}
  bind:this={pageDiv}>

  {#if manifest.messageList[seq]}
  <PageMessage {view} seq={seq} code={manifest.messageList[seq]}></PageMessage>
  {/if}

  <PageMenu
    {seq}
    {pageNum}
    {focused}
    {isUnusual}
    {side}
    {view}
    {format}
    {pageZoom}
    {rotateScan}
    {updateZoom}
    {openLightbox}
    sticky={view == '1up' || view == '2up'}
    allowRotate={view == '1up'}
    allowPageZoom={view != 'thumb'}
    allowFullDownload={manifest.allowFullDownload}
    selected={$selected.has(seq)}
    togglePageSelection={(event) => manifest.select(seq, event)}
    />

  <figure class="frame format-{format}" 
    class:pending={!isLoaded}
    class:adjusted={canvas.width > canvas.height}
    class:zoomed={pageZoom > 1 && pageZoom != zoom}
    style:--xxframeHeight={zoom != 1 ? `${( scanHeight )}px` : defaultPageHeight}
    data-xorient={orient}
    >
    {#if format == 'image'}
      <div class="image">
        {#if !isLoaded}
          <div class="page-loader">
            <i 
              class="fa-solid fa-stroopwafel fa-2xl opacity-75"
              class:fa-spin={isVisible}
              aria-hidden="true"></i>
          </div>
        {/if}
        {#if isVisible}
        <img 
          bind:this={image} 
          class:d-none={orient != 0}
          src={defaultThumbnailSrc} 
          data-loaded={isLoaded}
          alt="" 
          class:zoomed={pageZoom > 1}
          on:load={() => { if ( orient != 0 ) { console.log("-- page.onload", seq, orient); drawRotatedImage(); }}}
          />
          {#if orient != 0}
            <canvas data-ready="false" bind:this={rotatedImage} />
          {/if}
          {#if side != 'thumb' && page_coords}
          <SearchHighlights {canvas} {seq} {orient} image={image} page_coords={page_coords} matches={matches} format="image"></SearchHighlights>
          {/if}
        {/if}
      </div>
      {#if side != 'thumb'}
      <figcaption class="visually-hidden" data-loaded="false" bind:this={figCaption}>
      </figcaption>
      {/if}
    {:else if format == 'plaintext'}
      {#if !isLoaded}
        <div class="page-loader">
          <i 
            class="fa-solid fa-stroopwafel fa-2xl opacity-75"
            class:fa-spin={isVisible}
            aria-hidden="true"></i>
        </div>
      {/if}
      {#if isVisible}
      <SearchHighlights page_coords={page_coords} matches={matches} format="plaintext"></SearchHighlights>
      <figcaption data-loaded="false" class="plaintext" bind:this={figCaption}></figcaption>
      {/if}
    {/if}
  </figure>
</div>

<style lang="scss">
  .page {
    --defaultPageHeight: calc(100dvh - ( ( var(--stage-header-height) + var(--paddingBottom, 0) ) * 1px) );
    --actualPageHeight: var(--scanHeight, var(--defaultPageHeight));
    --actualZoom: var(--zoom, 1);
    // height: clamp(var(--clampHeight), var(--actualPageHeight), var(--actualPageHeight));
    height: calc(clamp(var(--clampHeight), var(--defaultPageHeight), var(--defaultPageHeight)) * var(--actualZoom, 1));
    width: 100%;
    max-width: 100%;

    margin: auto;

    display: grid;
    grid-template-rows: min-content 1fr;
    grid-template-columns: minmax(0, 1fr) min-content;
    align-items: center;
    justify-content: center;

    position: relative;

    // overflow: hidden;

    // // -- debug border
    // border: 4px solid darkkhaki;

    &.view-2up {
      margin-bottom: calc(var(--paddingBottom) * 1px);
      height: calc(clamp(var(--clampHeight), var(--defaultPageHeight), var(--defaultPageHeight)) * var(--zoom, 1));

      &.zoomed {
        overflow: auto;
      }

      .format-image {
        height: 100%;
        // height: calc(var(--spreadHeight) - 5.5rem);
        // overflow: auto;
      }

      // .format-plaintext {
      //   height: 100%;
      // }

      .format-plaintext.frame {
        padding-top: 3rem;
        padding-bottom: 5rem;
        width: 100%;
        height: 100%;
      }

      .format-image .frame {
        // height: auto;
        // aspect-ratio: var(--ratio);
        &.zoomed {
          max-width: none;
        }
      }
    }

    &.view-2up.verso {
      grid-area: verso;
      z-index: 1;

      &.direction-rtl {
        .frame {
          margin-right: auto;
          margin-left: 0;

          .loader {
            transform: translateX(0) translateY(-50%);
            left: auto;
            right: 0;
          }
        }
      }

      .frame {
        margin-right: 0;

        .loader {
          transform: translateX(0) translateY(-50%);
          left: auto;
          right: 0;
        }

        .image {
          margin-right: 0;
        }
      }
    }

    &.view-2up.recto {
      grid-area: recto;

      &.direction-rtl {
        .frame {
          margin-right: 0;
          margin-left: auto;
        }
      }

      .frame {
        margin-left: 0;
        .loader {
          left: 0;
          transform: translateX(0) translateY(-50%);
        }
        .image {
          margin-left: 0;
        }
      }
    }

    &.view-thumb {
      --defaultPageHeight: 250px;

      height: auto;
      // width: auto;
      min-height: calc(var(--defaultPageHeight) * var(--actualZoom));
      max-width: var(--defaultPageHeight);

      // gap: 0.5rem;
      // grid-template-rows: min-content 1fr;

      margin: 0;
      margin-bottom: 1rem;

      // .page-menu {
      //   grid-row: 2/3;
      // }

      figure {
        --frameHeight: calc(250px * var(--actualZoom)); 
        // grid-row: 3/4;
        // height: var(--frameHeight, '250px');
        // height: 250px;
      }
    }

    &.view-1up {
      --actualZoom: var(--scanZoom, 1);
      margin-bottom: 2rem;

      &.plaintext {
        // min-height: var(--pageHeight, var(--defaultPageHeight));
        min-height: var(--defaultPageHeight);
        height: auto;
      }
    }

    &:focus-visible {
      outline: 0;

      .frame {
        --bs-btn-focus-shadow-rgb: 66,70,73;
        outline: 0;
        box-shadow: 0 0 0 0.25rem rgba(var(--bs-btn-focus-shadow-rgb), .5);
      }
    }
  }

  .frame {
    --defaultframeHeight: calc(100dvh * 0.99 - ( ( var(--stage-header-height) + var(--paddingBottom) ) * 1px) );
    --frameHeight: calc(clamp(var(--clampHeight), var(--defaultframeHeight), var(--defaultframeHeight)) * var(--scanZoom, 1));
    min-height: 0;
    height: 100%;
    width: 100%;
    // aspect-ratio: var(--ratio);
    // width: calc(var(--frameHeight) * var(--ratio));


    display: flex;

    margin: auto;
    overflow: auto;

    position: relative;

    // // --- debug background
    // background: darkkhaki;

    grid-row: 1/3;
    grid-column: 1/3;
    justify-self: center;

    // // squares
    // background-color: #fbfbfb;
    // background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='Artboard-5' fill='%239C92AC' fill-opacity='0.37' fill-rule='nonzero'%3E%3Cpath d='M6 18h12V6H6v12zM4 4h16v16H4V4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");

    // // circuit board
    // background-color: #DFDBE5;
    // background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 304 304' width='304' height='304'%3E%3Cpath fill='%239C92AC' fill-opacity='0.12' d='M44.1 224a5 5 0 1 1 0 2H0v-2h44.1zm160 48a5 5 0 1 1 0 2H82v-2h122.1zm57.8-46a5 5 0 1 1 0-2H304v2h-42.1zm0 16a5 5 0 1 1 0-2H304v2h-42.1zm6.2-114a5 5 0 1 1 0 2h-86.2a5 5 0 1 1 0-2h86.2zm-256-48a5 5 0 1 1 0 2H0v-2h12.1zm185.8 34a5 5 0 1 1 0-2h86.2a5 5 0 1 1 0 2h-86.2zM258 12.1a5 5 0 1 1-2 0V0h2v12.1zm-64 208a5 5 0 1 1-2 0v-54.2a5 5 0 1 1 2 0v54.2zm48-198.2V80h62v2h-64V21.9a5 5 0 1 1 2 0zm16 16V64h46v2h-48V37.9a5 5 0 1 1 2 0zm-128 96V208h16v12.1a5 5 0 1 1-2 0V210h-16v-76.1a5 5 0 1 1 2 0zm-5.9-21.9a5 5 0 1 1 0 2H114v48H85.9a5 5 0 1 1 0-2H112v-48h12.1zm-6.2 130a5 5 0 1 1 0-2H176v-74.1a5 5 0 1 1 2 0V242h-60.1zm-16-64a5 5 0 1 1 0-2H114v48h10.1a5 5 0 1 1 0 2H112v-48h-10.1zM66 284.1a5 5 0 1 1-2 0V274H50v30h-2v-32h18v12.1zM236.1 176a5 5 0 1 1 0 2H226v94h48v32h-2v-30h-48v-98h12.1zm25.8-30a5 5 0 1 1 0-2H274v44.1a5 5 0 1 1-2 0V146h-10.1zm-64 96a5 5 0 1 1 0-2H208v-80h16v-14h-42.1a5 5 0 1 1 0-2H226v18h-16v80h-12.1zm86.2-210a5 5 0 1 1 0 2H272V0h2v32h10.1zM98 101.9V146H53.9a5 5 0 1 1 0-2H96v-42.1a5 5 0 1 1 2 0zM53.9 34a5 5 0 1 1 0-2H80V0h2v34H53.9zm60.1 3.9V66H82v64H69.9a5 5 0 1 1 0-2H80V64h32V37.9a5 5 0 1 1 2 0zM101.9 82a5 5 0 1 1 0-2H128V37.9a5 5 0 1 1 2 0V82h-28.1zm16-64a5 5 0 1 1 0-2H146v44.1a5 5 0 1 1-2 0V18h-26.1zm102.2 270a5 5 0 1 1 0 2H98v14h-2v-16h124.1zM242 149.9V160h16v34h-16v62h48v48h-2v-46h-48v-66h16v-30h-16v-12.1a5 5 0 1 1 2 0zM53.9 18a5 5 0 1 1 0-2H64V2H48V0h18v18H53.9zm112 32a5 5 0 1 1 0-2H192V0h50v2h-48v48h-28.1zm-48-48a5 5 0 0 1-9.8-2h2.07a3 3 0 1 0 5.66 0H178v34h-18V21.9a5 5 0 1 1 2 0V32h14V2h-58.1zm0 96a5 5 0 1 1 0-2H137l32-32h39V21.9a5 5 0 1 1 2 0V66h-40.17l-32 32H117.9zm28.1 90.1a5 5 0 1 1-2 0v-76.51L175.59 80H224V21.9a5 5 0 1 1 2 0V82h-49.59L146 112.41v75.69zm16 32a5 5 0 1 1-2 0v-99.51L184.59 96H300.1a5 5 0 0 1 3.9-3.9v2.07a3 3 0 0 0 0 5.66v2.07a5 5 0 0 1-3.9-3.9H185.41L162 121.41v98.69zm-144-64a5 5 0 1 1-2 0v-3.51l48-48V48h32V0h2v50H66v55.41l-48 48v2.69zM50 53.9v43.51l-48 48V208h26.1a5 5 0 1 1 0 2H0v-65.41l48-48V53.9a5 5 0 1 1 2 0zm-16 16V89.41l-34 34v-2.82l32-32V69.9a5 5 0 1 1 2 0zM12.1 32a5 5 0 1 1 0 2H9.41L0 43.41V40.6L8.59 32h3.51zm265.8 18a5 5 0 1 1 0-2h18.69l7.41-7.41v2.82L297.41 50H277.9zm-16 160a5 5 0 1 1 0-2H288v-71.41l16-16v2.82l-14 14V210h-28.1zm-208 32a5 5 0 1 1 0-2H64v-22.59L40.59 194H21.9a5 5 0 1 1 0-2H41.41L66 216.59V242H53.9zm150.2 14a5 5 0 1 1 0 2H96v-56.6L56.6 162H37.9a5 5 0 1 1 0-2h19.5L98 200.6V256h106.1zm-150.2 2a5 5 0 1 1 0-2H80v-46.59L48.59 178H21.9a5 5 0 1 1 0-2H49.41L82 208.59V258H53.9zM34 39.8v1.61L9.41 66H0v-2h8.59L32 40.59V0h2v39.8zM2 300.1a5 5 0 0 1 3.9 3.9H3.83A3 3 0 0 0 0 302.17V256h18v48h-2v-46H2v42.1zM34 241v63h-2v-62H0v-2h34v1zM17 18H0v-2h16V0h2v18h-1zm273-2h14v2h-16V0h2v16zm-32 273v15h-2v-14h-14v14h-2v-16h18v1zM0 92.1A5.02 5.02 0 0 1 6 97a5 5 0 0 1-6 4.9v-2.07a3 3 0 1 0 0-5.66V92.1zM80 272h2v32h-2v-32zm37.9 32h-2.07a3 3 0 0 0-5.66 0h-2.07a5 5 0 0 1 9.8 0zM5.9 0A5.02 5.02 0 0 1 0 5.9V3.83A3 3 0 0 0 3.83 0H5.9zm294.2 0h2.07A3 3 0 0 0 304 3.83V5.9a5 5 0 0 1-3.9-5.9zm3.9 300.1v2.07a3 3 0 0 0-1.83 1.83h-2.07a5 5 0 0 1 3.9-3.9zM97 100a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-48 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 96a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-144a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM49 36a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM33 68a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 240a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm80-176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm112 176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 180a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 84a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'%3E%3C/path%3E%3C/svg%3E");

    // // dots
    // background-color: #DFDBE5;
    // background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E");

    &.pending {

      .page-loader {
        font-size: 3rem;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translateX(-50%) translateY(-50%);
        color: #9C92AC;
      }

      .image {

        position: relative;

        // // circuit board
        // background-color: #DFDBE5;
        // background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 304 304' width='304' height='304'%3E%3Cpath fill='%239C92AC' fill-opacity='0.12' d='M44.1 224a5 5 0 1 1 0 2H0v-2h44.1zm160 48a5 5 0 1 1 0 2H82v-2h122.1zm57.8-46a5 5 0 1 1 0-2H304v2h-42.1zm0 16a5 5 0 1 1 0-2H304v2h-42.1zm6.2-114a5 5 0 1 1 0 2h-86.2a5 5 0 1 1 0-2h86.2zm-256-48a5 5 0 1 1 0 2H0v-2h12.1zm185.8 34a5 5 0 1 1 0-2h86.2a5 5 0 1 1 0 2h-86.2zM258 12.1a5 5 0 1 1-2 0V0h2v12.1zm-64 208a5 5 0 1 1-2 0v-54.2a5 5 0 1 1 2 0v54.2zm48-198.2V80h62v2h-64V21.9a5 5 0 1 1 2 0zm16 16V64h46v2h-48V37.9a5 5 0 1 1 2 0zm-128 96V208h16v12.1a5 5 0 1 1-2 0V210h-16v-76.1a5 5 0 1 1 2 0zm-5.9-21.9a5 5 0 1 1 0 2H114v48H85.9a5 5 0 1 1 0-2H112v-48h12.1zm-6.2 130a5 5 0 1 1 0-2H176v-74.1a5 5 0 1 1 2 0V242h-60.1zm-16-64a5 5 0 1 1 0-2H114v48h10.1a5 5 0 1 1 0 2H112v-48h-10.1zM66 284.1a5 5 0 1 1-2 0V274H50v30h-2v-32h18v12.1zM236.1 176a5 5 0 1 1 0 2H226v94h48v32h-2v-30h-48v-98h12.1zm25.8-30a5 5 0 1 1 0-2H274v44.1a5 5 0 1 1-2 0V146h-10.1zm-64 96a5 5 0 1 1 0-2H208v-80h16v-14h-42.1a5 5 0 1 1 0-2H226v18h-16v80h-12.1zm86.2-210a5 5 0 1 1 0 2H272V0h2v32h10.1zM98 101.9V146H53.9a5 5 0 1 1 0-2H96v-42.1a5 5 0 1 1 2 0zM53.9 34a5 5 0 1 1 0-2H80V0h2v34H53.9zm60.1 3.9V66H82v64H69.9a5 5 0 1 1 0-2H80V64h32V37.9a5 5 0 1 1 2 0zM101.9 82a5 5 0 1 1 0-2H128V37.9a5 5 0 1 1 2 0V82h-28.1zm16-64a5 5 0 1 1 0-2H146v44.1a5 5 0 1 1-2 0V18h-26.1zm102.2 270a5 5 0 1 1 0 2H98v14h-2v-16h124.1zM242 149.9V160h16v34h-16v62h48v48h-2v-46h-48v-66h16v-30h-16v-12.1a5 5 0 1 1 2 0zM53.9 18a5 5 0 1 1 0-2H64V2H48V0h18v18H53.9zm112 32a5 5 0 1 1 0-2H192V0h50v2h-48v48h-28.1zm-48-48a5 5 0 0 1-9.8-2h2.07a3 3 0 1 0 5.66 0H178v34h-18V21.9a5 5 0 1 1 2 0V32h14V2h-58.1zm0 96a5 5 0 1 1 0-2H137l32-32h39V21.9a5 5 0 1 1 2 0V66h-40.17l-32 32H117.9zm28.1 90.1a5 5 0 1 1-2 0v-76.51L175.59 80H224V21.9a5 5 0 1 1 2 0V82h-49.59L146 112.41v75.69zm16 32a5 5 0 1 1-2 0v-99.51L184.59 96H300.1a5 5 0 0 1 3.9-3.9v2.07a3 3 0 0 0 0 5.66v2.07a5 5 0 0 1-3.9-3.9H185.41L162 121.41v98.69zm-144-64a5 5 0 1 1-2 0v-3.51l48-48V48h32V0h2v50H66v55.41l-48 48v2.69zM50 53.9v43.51l-48 48V208h26.1a5 5 0 1 1 0 2H0v-65.41l48-48V53.9a5 5 0 1 1 2 0zm-16 16V89.41l-34 34v-2.82l32-32V69.9a5 5 0 1 1 2 0zM12.1 32a5 5 0 1 1 0 2H9.41L0 43.41V40.6L8.59 32h3.51zm265.8 18a5 5 0 1 1 0-2h18.69l7.41-7.41v2.82L297.41 50H277.9zm-16 160a5 5 0 1 1 0-2H288v-71.41l16-16v2.82l-14 14V210h-28.1zm-208 32a5 5 0 1 1 0-2H64v-22.59L40.59 194H21.9a5 5 0 1 1 0-2H41.41L66 216.59V242H53.9zm150.2 14a5 5 0 1 1 0 2H96v-56.6L56.6 162H37.9a5 5 0 1 1 0-2h19.5L98 200.6V256h106.1zm-150.2 2a5 5 0 1 1 0-2H80v-46.59L48.59 178H21.9a5 5 0 1 1 0-2H49.41L82 208.59V258H53.9zM34 39.8v1.61L9.41 66H0v-2h8.59L32 40.59V0h2v39.8zM2 300.1a5 5 0 0 1 3.9 3.9H3.83A3 3 0 0 0 0 302.17V256h18v48h-2v-46H2v42.1zM34 241v63h-2v-62H0v-2h34v1zM17 18H0v-2h16V0h2v18h-1zm273-2h14v2h-16V0h2v16zm-32 273v15h-2v-14h-14v14h-2v-16h18v1zM0 92.1A5.02 5.02 0 0 1 6 97a5 5 0 0 1-6 4.9v-2.07a3 3 0 1 0 0-5.66V92.1zM80 272h2v32h-2v-32zm37.9 32h-2.07a3 3 0 0 0-5.66 0h-2.07a5 5 0 0 1 9.8 0zM5.9 0A5.02 5.02 0 0 1 0 5.9V3.83A3 3 0 0 0 3.83 0H5.9zm294.2 0h2.07A3 3 0 0 0 304 3.83V5.9a5 5 0 0 1-3.9-5.9zm3.9 300.1v2.07a3 3 0 0 0-1.83 1.83h-2.07a5 5 0 0 1 3.9-3.9zM97 100a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-48 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 96a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-144a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM49 36a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM33 68a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 240a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm80-176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm112 176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 180a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 84a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'%3E%3C/path%3E%3C/svg%3E");

        background-color: rgb(223, 219, 229, 0.125);

        // pixel dots, tweaked opacity
        // background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h16v2h-6v6h6v8H8v-6H2v6H0V0zm4 4h2v2H4V4zm8 8h2v2h-2v-2zm-8 0h2v2H4v-2zm8-8h2v2h-2V4z' fill='%239C92AC' fill-opacity='0.25' fill-rule='evenodd'/%3E%3C/svg%3E");

        // 4 point stars
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%239C92AC' fill-opacity='0.25'%3E%3Cpolygon fill-rule='evenodd' points='8 4 12 6 8 8 6 12 4 8 0 6 4 4 6 0 8 4'/%3E%3C/g%3E%3C/svg%3E");        
        img {
          opacity: 0;
        }
      }

      &.format-plaintext {
        // // circuit board
        // background-color: #DFDBE5;
        // background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 304 304' width='304' height='304'%3E%3Cpath fill='%239C92AC' fill-opacity='0.12' d='M44.1 224a5 5 0 1 1 0 2H0v-2h44.1zm160 48a5 5 0 1 1 0 2H82v-2h122.1zm57.8-46a5 5 0 1 1 0-2H304v2h-42.1zm0 16a5 5 0 1 1 0-2H304v2h-42.1zm6.2-114a5 5 0 1 1 0 2h-86.2a5 5 0 1 1 0-2h86.2zm-256-48a5 5 0 1 1 0 2H0v-2h12.1zm185.8 34a5 5 0 1 1 0-2h86.2a5 5 0 1 1 0 2h-86.2zM258 12.1a5 5 0 1 1-2 0V0h2v12.1zm-64 208a5 5 0 1 1-2 0v-54.2a5 5 0 1 1 2 0v54.2zm48-198.2V80h62v2h-64V21.9a5 5 0 1 1 2 0zm16 16V64h46v2h-48V37.9a5 5 0 1 1 2 0zm-128 96V208h16v12.1a5 5 0 1 1-2 0V210h-16v-76.1a5 5 0 1 1 2 0zm-5.9-21.9a5 5 0 1 1 0 2H114v48H85.9a5 5 0 1 1 0-2H112v-48h12.1zm-6.2 130a5 5 0 1 1 0-2H176v-74.1a5 5 0 1 1 2 0V242h-60.1zm-16-64a5 5 0 1 1 0-2H114v48h10.1a5 5 0 1 1 0 2H112v-48h-10.1zM66 284.1a5 5 0 1 1-2 0V274H50v30h-2v-32h18v12.1zM236.1 176a5 5 0 1 1 0 2H226v94h48v32h-2v-30h-48v-98h12.1zm25.8-30a5 5 0 1 1 0-2H274v44.1a5 5 0 1 1-2 0V146h-10.1zm-64 96a5 5 0 1 1 0-2H208v-80h16v-14h-42.1a5 5 0 1 1 0-2H226v18h-16v80h-12.1zm86.2-210a5 5 0 1 1 0 2H272V0h2v32h10.1zM98 101.9V146H53.9a5 5 0 1 1 0-2H96v-42.1a5 5 0 1 1 2 0zM53.9 34a5 5 0 1 1 0-2H80V0h2v34H53.9zm60.1 3.9V66H82v64H69.9a5 5 0 1 1 0-2H80V64h32V37.9a5 5 0 1 1 2 0zM101.9 82a5 5 0 1 1 0-2H128V37.9a5 5 0 1 1 2 0V82h-28.1zm16-64a5 5 0 1 1 0-2H146v44.1a5 5 0 1 1-2 0V18h-26.1zm102.2 270a5 5 0 1 1 0 2H98v14h-2v-16h124.1zM242 149.9V160h16v34h-16v62h48v48h-2v-46h-48v-66h16v-30h-16v-12.1a5 5 0 1 1 2 0zM53.9 18a5 5 0 1 1 0-2H64V2H48V0h18v18H53.9zm112 32a5 5 0 1 1 0-2H192V0h50v2h-48v48h-28.1zm-48-48a5 5 0 0 1-9.8-2h2.07a3 3 0 1 0 5.66 0H178v34h-18V21.9a5 5 0 1 1 2 0V32h14V2h-58.1zm0 96a5 5 0 1 1 0-2H137l32-32h39V21.9a5 5 0 1 1 2 0V66h-40.17l-32 32H117.9zm28.1 90.1a5 5 0 1 1-2 0v-76.51L175.59 80H224V21.9a5 5 0 1 1 2 0V82h-49.59L146 112.41v75.69zm16 32a5 5 0 1 1-2 0v-99.51L184.59 96H300.1a5 5 0 0 1 3.9-3.9v2.07a3 3 0 0 0 0 5.66v2.07a5 5 0 0 1-3.9-3.9H185.41L162 121.41v98.69zm-144-64a5 5 0 1 1-2 0v-3.51l48-48V48h32V0h2v50H66v55.41l-48 48v2.69zM50 53.9v43.51l-48 48V208h26.1a5 5 0 1 1 0 2H0v-65.41l48-48V53.9a5 5 0 1 1 2 0zm-16 16V89.41l-34 34v-2.82l32-32V69.9a5 5 0 1 1 2 0zM12.1 32a5 5 0 1 1 0 2H9.41L0 43.41V40.6L8.59 32h3.51zm265.8 18a5 5 0 1 1 0-2h18.69l7.41-7.41v2.82L297.41 50H277.9zm-16 160a5 5 0 1 1 0-2H288v-71.41l16-16v2.82l-14 14V210h-28.1zm-208 32a5 5 0 1 1 0-2H64v-22.59L40.59 194H21.9a5 5 0 1 1 0-2H41.41L66 216.59V242H53.9zm150.2 14a5 5 0 1 1 0 2H96v-56.6L56.6 162H37.9a5 5 0 1 1 0-2h19.5L98 200.6V256h106.1zm-150.2 2a5 5 0 1 1 0-2H80v-46.59L48.59 178H21.9a5 5 0 1 1 0-2H49.41L82 208.59V258H53.9zM34 39.8v1.61L9.41 66H0v-2h8.59L32 40.59V0h2v39.8zM2 300.1a5 5 0 0 1 3.9 3.9H3.83A3 3 0 0 0 0 302.17V256h18v48h-2v-46H2v42.1zM34 241v63h-2v-62H0v-2h34v1zM17 18H0v-2h16V0h2v18h-1zm273-2h14v2h-16V0h2v16zm-32 273v15h-2v-14h-14v14h-2v-16h18v1zM0 92.1A5.02 5.02 0 0 1 6 97a5 5 0 0 1-6 4.9v-2.07a3 3 0 1 0 0-5.66V92.1zM80 272h2v32h-2v-32zm37.9 32h-2.07a3 3 0 0 0-5.66 0h-2.07a5 5 0 0 1 9.8 0zM5.9 0A5.02 5.02 0 0 1 0 5.9V3.83A3 3 0 0 0 3.83 0H5.9zm294.2 0h2.07A3 3 0 0 0 304 3.83V5.9a5 5 0 0 1-3.9-5.9zm3.9 300.1v2.07a3 3 0 0 0-1.83 1.83h-2.07a5 5 0 0 1 3.9-3.9zM97 100a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-48 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 96a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-144a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM49 36a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM33 68a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 240a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm80-176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm112 176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 180a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 84a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'%3E%3C/path%3E%3C/svg%3E");

        // pixel dots
        background-color: rgb(223, 219, 229, 0.25);
        // background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h16v2h-6v6h6v8H8v-6H2v6H0V0zm4 4h2v2H4V4zm8 8h2v2h-2v-2zm-8 0h2v2H4v-2zm8-8h2v2h-2V4z' fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E");
        // 4 point stars
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%239C92AC' fill-opacity='0.25'%3E%3Cpolygon fill-rule='evenodd' points='8 4 12 6 8 8 6 12 4 8 0 6 4 4 6 0 8 4'/%3E%3C/g%3E%3C/svg%3E");        
      }
    }

    &.format-image {
      // overflow: hidden;

      .image {
        height: var(--frameHeight);
        width: auto;
        aspect-ratio: var(--ratio);
        margin: auto;

        max-height: 100%;

        position: relative;

        flex-shrink: 0;
        flex-grow: 0;

        // display: flex;
        // align-items: center;
        // justify-content: center;

        transition: opacity 0.125s linear;
      }
    }

    &.format-plaintext {
      align-items: flex-start;
      // min-height: calc(var(--height) * 0.9 * 1px);
      // height: auto;
      min-height: 100%;
      height: auto;
      width: 80%;
      max-width: 80rem;
      padding: 2rem 1rem;

      background: #fff;
      box-shadow: 0px 10px 13px -7px #000000, 0px 6px 15px 5px rgba(0, 0, 0, 0);
      border: 1px solid #ddd;    

      transition: height 100ms;

      .loader {
        width: 100% !important;
      }
    }

  }

  figure img, figure canvas {
    // height: 99%;
    display: block;
    margin: auto;

    max-height: 100%;
    max-width: 100%;
    width: auto;
    height: auto;

    background: #f9f8f5;
    box-shadow: 0px 10px 13px -7px #000000, 0px 6px 15px 5px rgba(0, 0, 0, 0);
    border: 1px solid #ddd;    
  }

  figure canvas[data-ready="false"] {
    visibility: hidden;
  }

  figure.adjusted {
    /* max-width: 100%; */
    margin: auto;
  }

  figure.zoomed {
    overflow: auto !important;
    align-items: start;
    // min-width: 80%;

    .image {
      // height: auto;
      max-height: none !important;
    }

    // img {
    //   max-height: none;
    //   max-width: none;
    // }
  }

  figure.adjusted img {
    height: auto;
    width: 100%;
    max-height: 100%;
  }

  .page:is([data-xorient="90"]),
  .page:is([data-xorient="270"]) {
    // width: calc(clamp(var(--clampHeight), var(--defaultPageHeight), var(--defaultPageHeight)) * var(--zoom, 1));
    // height: auto;
    // aspect-ratio: calc(1 / var(--ratio));
    // max-width: 100%;
    // overflow: auto;
    max-width: 100%;
    height: auto;
  }

  .frame:is([data-xorient="90"]),
  .frame:is([data-xorient="270"]) {
    // height: auto;
    // width: calc(clamp(var(--clampHeight), var(--defaultPageHeight), var(--defaultPageHeight)) * var(--actualZoom, 1));
    height: auto;
    width: 100%;
    max-width: 100%;
    max-height: 100%;

    padding: 2rem 6rem 2rem 1rem;

    & .image, & .loader {
      height: min-content;
      width: calc(clamp(var(--clampHeight), var(--defaultPageHeight), var(--defaultPageHeight)) * var(--actualZoom, 1)) !important;
      aspect-ratio: calc(1 / var(--ratio));
      margin: auto;
    }
  }

  figcaption.plaintext {
    --font-size: var(--page-text-font-size, 1.125rem);
    font-size: calc(var(--font-size) * var(--scanZoom));
    line-height: 1.25;
    width: 100%;
    padding: 0 1rem;
    max-width: 65ch;
  }

  img.zoomed {
    align-self: flex-start;
  }

  .message {
    align-self: start;
    margin: 0 auto;
  }

</style>
