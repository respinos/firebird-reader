<script>

  import { onMount } from 'svelte';
  import { afterUpdate } from 'svelte';

  import PageText from '../PageText/index.svelte';
  import SearchHighlights from '../SearchHighlights/index.svelte';

  import { extractHighlights } from '../../lib/highlights';

  export let seq;
  export let canvas;
  export let zoom;
  export let style;


  let scan;
  let image;
  let text;
  let matches;
  let page_coords;
  let objectUrl;
  let isLoaded = false;

  // cgi/imgsrv/thumbnail?id={canvas.id}&seq={seq}
  let defaultThumbnailSrc = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
  export let thumbnailSrc = defaultThumbnailSrc;

  export function toggle(visible) {
    isVisible = visible;
    if (visible) {
      loadImage();
    } else {
      unloadImage();
    }
  }

  const updateMatches = function(coords, values) {
    matches = [ ...values ];
    page_coords = [ ...coords ];
    console.log("UPDATE MATCHES", coords, values);
  }

  const loadImage = function() {
    if ( image.src != defaultThumbnailSrc ) { console.log("AHOY DUPE", image.src); return ; }
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
        console.log("--", seq, size, `${canvas.width}x${canvas.height}`);
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if ( image ) {
          image.src = objectUrl;
          isLoaded = true;
          loadPageText();
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })    
  }

  const unloadImage = function() {
    URL.revokeObjectURL(objectUrl);
    console.log("---- unload", seq, image);
  }

  const loadPageText = function() {

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

  function calculateRatio(canvas) {
    if ( canvas.height > canvas.width ) {
      return window.innerHeight / canvas.height;
    }
    let width = window.innerWidth * 0.6;
    let ratio = width / canvas.width;
    return ratio;
  }

  function calculate(value, zoom) {
    // console.log("calculate", value, scanRatio, zoom);
    return Math.ceil(value * scanRatio * zoom);
  }

  $: isVisible = false;
  $: scanRatio = calculateRatio(canvas);
  $: scanHeight = calculate(canvas.height, zoom);
  $: scanWidth = calculate(canvas.width, zoom);
  $: scanAdjusted = false;
  $: orient = 0;
  $: rotateX = 0;
  $: orientMargin = 0;

  let testWidth, testHeight;

  onMount(() => {
    console.log("-- page.mount", seq);

    return () => { console.log("-- page.unmount", seq); unloadImage(); }
  })

</script>

<div class="page" {style} data-seq={seq} 
  style:--height={canvas.useHeight}
  style:--width={canvas.useWidth}>
  <div class="page-toolbar">
    <button type="button" class="btn btn-outline-dark" on:click={rotateScan}><i class="bi bi-arrow-clockwise"></i></button>
    <span class="badge bg-secondary d-flex align-items-center p-2">#{seq}</span>
  </div>
  <figure class="frame">
    <img bind:this={image} src={defaultThumbnailSrc} alt="" />
    <SearchHighlights image={image} page_coords={page_coords} matches={matches}></SearchHighlights>
    <figcaption>
      <PageText hidden={true} image={image} canvas={canvas} seq={seq}></PageText>
    </figcaption>
  </figure>
</div>

<style>
  .page {
    width: 400px;
    background: #ddd;
    border-bottom: 4px solid #666;

    display: flex;
    flex-direction: column;
    align-items: center;

    /* overflow: hidden; */
    position: relative;
  }

  .frame {
    display: flex;
    align-items: center;
    /* justify-content: center; */
    border: 1px solid darkorange;
    /* padding: 1rem; */

    height: calc(var(--height) * 1px);
    width: calc(var(--width) * 1px);

    /* max-width: 400px; */

    margin: 0 auto;
    overflow: auto;

    position: relative;
  }

  .page-toolbar {
    background: black;
    color: white;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    padding: 0.5rem;
    width: calc(var(--width) * 1px);
    width: 80%;
    width: 300px;
    position: sticky;
    top: 0.5rem;
    z-index: 50;
    /* position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%); */
  }

  figure img {
    height: 100%;
    display: block;
    margin: 0 auto;
  }

  figure figcaption {
    display: none;
  }

</style>
