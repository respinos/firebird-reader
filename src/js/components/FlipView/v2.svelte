<script>
  import { onMount, afterUpdate, onDestroy, getContext } from 'svelte';
	import { createObserver } from '../../lib/observer';
  import PQueue from "p-queue";

  import Page from '../Page/v2.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');
  export let container;
  export let startSeq = 1;

  const queue = new PQueue({
    concurrency: 5,
    interval: 500,
  });

  const unloadQueue = new PQueue({
    concurrency: 1,
    interval: 5000,
  })

  // -- if we were oriented horizontally: `0% 200% 0% 200%`
  const { observer, io }= createObserver({
    root: container,
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ],
    rootMargin: `200% 0% 200% 0%`
  })
  observer.observedIdx = 0;
  observer.totalIdx = manifest.totalSeq;

  export const currentLocation = function() {
    let location = {};
    if ( itemMap[$currentSeq] ) {
      let item = itemMap[$currentSeq];
      location[item.side] = item;
    }
    if ( itemMap[$currentSeq].side == 'verso' ) {
      let item = itemMap[$currentSeq + 1];
      if ( item ) {
        location[item.side] = item;
      }
    }
    return location;
  }

  const unloadPage = async function(pageDatum) {
    // console.log("!! unloading", pageDatum.seq, queue.size, "->", pageDatum);
    itemMap[pageDatum.seq].page.toggle(false);
    currentInView.delete(pageDatum.seq);
    pageDatum.loaded = pageDatum.inView = false;
    itemMap[pageDatum.seq].timeout = null;
  }

  const loadPage = async function(pageDatum, delta) {
    if (! pageDatum.loaded) {
      // console.log(":: loading", pageDatum.seq, queue.size, "->", pageDatum);
      pageDatum.loaded = true;
      pageDatum.page.toggle(true);
    } else {
      // console.log("$$ ignoring", pageDatum.seq, queue.size, "->", pageDatum);
    }
    pageDatum.enqueued = false;
    return pageDatum;
  }

  const queuePage = async function(pageDatum) {
    pageDatum.enqueued = true;
    let delta = Math.floor(Math.random() * 1000);
    return loadPage(pageDatum, delta);
  }

  const loadPages = function(targetSeq) {
    if (itemMap[targetSeq].timeout) {
      clearTimeout(itemMap[targetSeq].timeout);
      itemMap[targetSeq].timeout = null;
    }
    let previouslyInView = [];
    itemData.forEach((item) => {
      if ( item.inView ) {
        previouslyInView.push(item.seq);
      }
    })
    let newInView = [ targetSeq ];
    for (let seq = targetSeq - 1; seq >= targetSeq - 5; seq--) {
      if (seq > 0) {
        newInView.push(seq);
      }
    }
    for (let seq = targetSeq + 1; seq <= targetSeq + 5; seq++) {
      if (seq < manifest.totalSeq) {
        newInView.push(seq);
      }
    }

    let currentDiff = previouslyInView.filter(x => !newInView.includes(x));
    let newDiff = newInView.filter(x => !previouslyInView.includes(x));

    newDiff.forEach((seq) => {
      itemMap[seq].inView = true;
      queue.add(() => {
        return queuePage(itemMap[seq])
      }, 
      { 
        priority: seq == targetSeq ? Infinity : 0 
      })
    });
  }

  const handleIntersecting = (({detail}) => {
    let seq = parseInt(detail.target.dataset.seq);
    // console.log("$$ looking for currentSeq", seq);
    let pageDatum = itemMap[seq];
    if ( detail.isIntersecting ) {
      pageDatum.intersectionRatio = detail.intersectionRatio;
      if ( pageDatum.loaded ) {
        // console.log("# intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
      } else {
        // console.log("+ intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        if ( ! doAutoLoad ) { return ; }
        pageDatum.timeout = setTimeout(() => {
          console.log("$ intersecting", seq);
          loadPages(seq);
        }, 1000);
      }
    } else {
      // console.log("? intersecting", seq, detail.isIntersecting, detail.intersectionRatio, pageDatum.isVisible);
    }
    // console.log("!! currentInView", Array.from(currentInView));
    setCurrentSeq();
  })

  const handleUnintersecting = (({detail}) => {
    if ( observer.observedIdx < manifest.totalSeq ) { return ; }
    let seq = parseInt(detail.target.dataset.seq);
    // console.log("- un/intersecting", seq);
    itemMap[seq].intersectionRatio = undefined;
    if (itemMap[seq].timeout) {
      clearTimeout(itemMap[seq].timeout);
      itemMap[seq].timeout = null;
    }

    unloadQueue.add(() => {
      return unloadPage(itemMap[seq])
    });
  })

  const setCurrentSeq = function() {
    if ( ! isInitialized ) { return ; }
  }

  const currentSeq = manifest.currentSeq;
  const location = manifest.currentLocation;
  const currentFormat = manifest.currentFormat;

  let zoom = 1;
  let zoomIndex = 0;
  const zoomScales = [ 0.5, 1, 1.5, 1.75, 2, 2.5 ];

  
  const itemData = [];
  const spreadData = [];
  const itemMap = {};
  const currentInView = new Set;

  let left = 0;
  let inner;

  let innerHeight = container.clientHeight;
  let innerWidth = container.clientWidth;
  let baseHeight;

  baseHeight = Math.ceil(innerHeight * 0.9) * zoom;
  for(let seq = 1; seq <= manifest.totalSeq; seq++) {
    let item = {};
    item.id = manifest.id;
    item.seq = seq;
    item.originalHeight = item.height = manifest.meta(seq).height;
    item.originalWidth = item.width = manifest.meta(seq).width;

    item.useHeight = baseHeight;
    item.useWidth = Math.ceil(baseHeight * ( item.width / item.height ));

    item.inView = false;
    item.loaded = false;
    item.page = null;
    item.index = seq - 1;

    itemData.push(item);
    itemMap[item.seq] = item;
  }

  let seq = 1;
  while(seq <= manifest.totalSeq) {
    let spread = [false, false];
    let spreadIndex = spreadData.length;

    if ( seq == 1 && manifest.hasFrontCover() ) {
      spread[1] = itemMap[seq];
      itemMap[seq].side = 'recto';
      itemMap[seq].spreadIndex = spreadIndex;
      seq += 1;
    } else {
      spread[0] = itemMap[seq];
      itemMap[seq].side = 'verso';
      itemMap[seq].spreadIndex = spreadIndex;
      if ( seq + 1 < manifest.totalSeq ) {
        spread[1] = itemMap[seq + 1];
        itemMap[seq + 1].side = 'recto';
        itemMap[seq + 1].spreadIndex = spreadIndex;
      }
      seq += 2;
    }

    spreadData.push(spread);
  }

  console.log("-- spread", spreadData);

  let focusSpread;
  const focus = function() {
    if ( focusSpread ) {
      focusSpread.forEach((page) => {
        page.unfocus();
      })
    }
    focusSpread = [];
    if ( $location.verso ) { focusSpread.push($location.verso.page); }
    if ( $location.recto ) { focusSpread.push($location.recto.page); }
    focusSpread.forEach((page) => {
      page.focus();
    })
  }

  const handleKeyDown = function(event) {
    if ( event.target.closest('details') ) { return ; }
    if ( event.target.closest('button') ) { return ; }
    let pageDiv = event.target.closest('div.page');
    if ( ! pageDiv ) { return ; }
    if ( event.code == 'Enter' ) {
      let options = { delta: 1 };
      if ( pageDiv.classList.contains('verso') ) {
        options.delta = -1;
      }
      gotoPage(options);
    }
  }

  const handlePageClick = function(event) {
    if ( $currentFormat == 'plaintext' ) { return ; }
    if ( event.target.closest('details') ) { return ; }
    if ( event.target.closest('button') ) { return ; }
    let pageDiv = event.target.closest('div.page');
    if ( ! pageDiv ) { return ; }
    let options = { delta: 1 };
    if ( pageDiv.classList.contains('verso') ) {
      options.delta = -1;
    }
    gotoPage(options);
  }

  let doAutoLoad = true;
  const gotoPage = function(options, callback) {
    let target;
    let distance = 0;
    let currentSpread = itemMap[$currentSeq].spreadIndex;
    if ( options.delta !== undefined ) {
      target = currentSpread + options.delta;
      distance = Math.abs(target - currentSpread);
    } else if ( options.seq && ! isNaN(options.seq) ) {
      // target = Math.floor(options.seq / 2);
      target = itemMap[options.seq].spreadIndex;
      distance = Math.abs(target - currentSpread);
      // doAutoLoad = ( Math.abs(options.seq - $currentSeq) >= 5 );
    } else {
      // invalid option;
      return;
    }
    if ( target == currentSpread && isInitialized && options.delta != 0 ) { 
      if ( callback ) { callback(); }
      return ; 
    }
    if ( target < 0 ) { target = 0 ; }
    else if ( target > manifest.totalSeq ) {
      target = itemMap[manifest.totalSeq].spreadIndex;
    }

    const spreadEl = container.querySelector(`#spread${target}`);
    spreadEl.scrollIntoView({ behavior: 'instant', block: 'nearest'});
    console.log("-- spread", spreadEl);

    $currentSeq = spreadData[target].find(item => item).seq;
    manifest.currentLocation.set(currentLocation());

    focus();

    if ( callback ) {
      callback();
    }    
  }

  emitter.on('goto.page', gotoPage);

  const resetSpread = function() {
    if ( ! isInitialized ) { return ; }
    let currentSpread = itemMap[$currentSeq].spreadIndex;
    // container.querySelector(`#spread${target}`).scrollIntoView({ behavior: 'instant' });
    // inner.scrollLeft = ( ( innerWidth * currentSpread ) );
    // left = ( ( innerWidth * currentSpread ) ) * ( -1 );
  }

  // const handleAnimationEnd = function(event) {
  //   console.log("-- animationend", event.target);
  //   doAutoLoad = true;
  // }

  emitter.on('update.zoom', delta => {
    console.log('<< update.zoom', zoomIndex, delta, zoom);
    zoomIndex += delta;
    if ( zoomIndex < 0 ) { zoomIndex = 0; }
    else if ( zoomIndex >= zoomScales.length ) {
      zoomIndex = zoomScales.length - 1;
    }
    zoom = zoomScales[zoomIndex];

    emitter.emit('enable.zoom', {
      out: zoomIndex > 0,
      in: zoomIndex < zoomScales.length - 1
    });
  })

  $: if ( innerWidth ) { resetSpread() }
  $: columnWidth = ( zoom > 1 ) ? `${innerWidth / 2 * zoom}px` : null;

  let isInitialized = false;
  afterUpdate(() => {
    if ( itemMap[manifest.totalSeq].page ) {
      if ( ! isInitialized && observer.observedIdx == manifest.totalSeq ) {
        if ( startSeq > 1 ) {
          setTimeout(() => {
            console.log("-- initialize", startSeq);
            gotoPage({ seq: startSeq });
            isInitialized = true;

            emitter.emit('enable.zoom', {
              out: zoomIndex > 0,
              in: zoomIndex < zoomScales.length - 1
            });
          })
        } else {
          isInitialized = true;
        }
      }
    }
  })

  let resizeTimeout;
  function handleResize(entry) {
    innerWidth = entry.contentRect.width;
    innerHeight = entry.contentRect.height;
    console.log("-- resizeObserver", innerWidth, innerHeight);
    resizeTimeout = null;
  }

  onMount(() => {
    console.log("-- itemCount", manifest.totalSeq, container);

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries.at(0);
      if ( resizeTimeout ) { clearTimeout(resizeTimeout); }
      resizeTimeout = setTimeout(() => handleResize(entry), 100);
    })

    resizeObserver.observe(container);

    container.addEventListener('click', handlePageClick);
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('click', handlePageClick);
      container.removeEventListener('keydown', handleKeyDown);
      emitter.off('goto.page', gotoPage);
    }
  })

  onDestroy(() => {
    if ( io ) {
      io.disconnect();
    }
    // container.innerHTML = '';
  })
</script>

{#each spreadData as spread, spreadIdx}
  {#if true || spreadIdx <= 5}
  <div class="spread" 
    class:zoomed={zoom > 1} 
    style:--zoom={zoom}
    style:--width={zoom > 1 ? `${innerWidth}px` : null}
    style:--columnWidth={columnWidth}
    id="spread{spreadIdx}">
    <span class="spread-idx">{spreadIdx + 1}</span>
    {#each spread as canvas, canvasIdx}
      {#if canvas}
      <Page 
        bind:this={canvas.page}
        xxstyle="max-height: {innerHeight * 0.9 * zoom}px"
        area={canvas.side}
        {observer} 
        {canvas} 
        {handleIntersecting}
        {handleUnintersecting}
        {innerHeight}
        innerWidth={innerWidth / 2}
        format={$currentFormat}
        seq={canvas.seq} 
        bind:zoom={zoom}
        ></Page>
      {:else}
      <div 
        class="blank"
        class:verso={canvasIdx == 0}
        class:recto={canvasIdx == 1}
        style:--width={innerWidth * 0.125}
        ><i class="text-black-50 fa-solid fa-diamond fa-2xl opacity-25" aria-hidden="true"></i>
      </div>
      {/if}
    {/each}
  </div>
  {/if}
{/each}

<style lang="scss">

  .inner {
    overflow: hidden;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    /* gap: 1rem; */

    // position: absolute;
    // top: 0;
    // bottom: 0;
    // left: calc(var(--left) * 1px);
  }

  .spread {
    height: calc(100dvh - ( var(--stage-header-height) * 1px));
    width: var(--width, 100%);

    // // --- debug border
    // border: 8px solid darkgoldenrod;

    display: grid;
    grid-template-areas: "verso recto";
    grid-template-columns: var(--columnWidth, 50%) var(--columnWidth, 50%);
    grid-template-rows: minmax(0, 1fr);
    position: relative;
    overflow: hidden;

    // bottom padding keeps the spread from overlapping with
    // the view toolbar
    padding: 1rem;
    padding-bottom: 5.5rem;

    // // --- debug border
    // border: 8px solid yellow;

    scroll-snap-align: start;

    &.zoomed {
      overflow: auto;
    }
  }

  .spread-idx {
    // // -- displaying the spread-idx is useful for debugging spreads
    display: none;
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    padding: 0.5rem;
    font-size: 0.875rem;
    background: rgba(0,0,0,0.6);
    color: #eee;
    font-family: monospace;
    z-index: 500;
  }

  .blank {
    // border: 1px dotted #ddd;
    // background: #ddd;
    // clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    height: calc(var(--width) * 1px);
    width: calc(var(--width) * 1px);
    align-self: center;
    justify-self: center;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 2rem;

    &.verso {
      grid-area: verso;
    }

    &.recto {
      grid-area: recto;
    }
  }
  
</style>