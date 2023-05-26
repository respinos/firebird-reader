<script>
  import { onMount, afterUpdate, onDestroy, getContext } from 'svelte';
	import { createObserver } from '../../lib/observer';
  import PQueue from "p-queue";

  import Page from '../Page/index.svelte';

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

  const thumbnailer = new PQueue({
    concurrency: 1,
    intervalCap: 1,
    interval: 1500,
  })

  const { observer, io }= createObserver({
    root: container,
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ],
    rootMargin: `0% 200% 0% 200%`
  })

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
    return;
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
  const zoomScales = [ 1, 1.5, 1.75, 2, 2.5 ];

  
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

    let direction = -1;

    console.log("<< goto.page", options, ( ( innerWidth * target ) ) * ( direction ), target, currentSpread, spreadData[target], ":", $currentSeq);
    $currentSeq = spreadData[target].find(item => item).seq;
    manifest.currentLocation.set(currentLocation());

    focus();

    // default smooth behavior is still ridiculously slow
    if ( false && distance <= 2 ) {
      let scrollDelta = ( innerWidth * target ) - inner.scrollLeft;
      inner.scrollBy({ left: scrollDelta, behavior: 'smooth' });
    } else {
      inner.scrollLeft = ( ( innerWidth * target ) );
    }

    if ( callback ) {
      callback();
    }

    // left = ( ( innerWidth * target ) ) * ( direction );
    // container.querySelector(`#spread${target}`).scrollIntoView({ behavior: 'instant' });
    
  }

  emitter.on('goto.page', gotoPage);

  const resetSpread = function() {
    if ( ! isInitialized ) { return ; }
    let currentSpread = itemMap[$currentSeq].spreadIndex;
    // container.querySelector(`#spread${target}`).scrollIntoView({ behavior: 'instant' });
    inner.scrollLeft = ( ( innerWidth * currentSpread ) );
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
  })

  $: if ( innerWidth ) { resetSpread() }

  let isInitialized = false;
  afterUpdate(() => {
    if ( itemMap[manifest.totalSeq].page ) {
      if ( ! isInitialized ) {
        if ( startSeq > 1 ) {
          setTimeout(() => {
            console.log("-- initialize", startSeq);
            gotoPage({ seq: startSeq });
            isInitialized = true;
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

    return () => {
      resizeObserver.disconnect();
      emitter.off('goto.page', gotoPage);
    }
  })

  onDestroy(() => {
    if ( io ) {
      io.disconnect();
    }
    inner.innerHTML = '';
  })
</script>

<div 
  class="inner" 
  style:--width={innerWidth} 
  style:--left={left}
  style:--columnWidth={zoom > 1 ? ( `${( innerWidth / 2 ) * zoom}px` ) : null}
  on:click={handlePageClick}
  on:keydown={handleKeyDown}
  bind:this={inner}
  >
  {#if container == null}
    <pre>LOADING : {innerHeight}</pre>
  {:else}
    {#each spreadData as spread, spreadIdx}
      <div class="spread" 
        class:zoomed={zoom > 1} 
        id="spread{spreadIdx}">
        <span class="spread-idx">{spreadIdx + 1}</span>
        {#each spread as canvas, canvasIdx}
          {#if canvas}
          <Page 
            bind:this={canvas.page}
            style="max-height: {innerHeight * 0.9 * zoom}px"
            area={canvas.side}
            {observer} 
            {canvas} 
            {handleIntersecting}
            {handleUnintersecting}
            {innerHeight}
            {innerWidth}
            format={$currentFormat}
            seq={canvas.seq} 
            bind:zoom={zoom}
            ></Page>
          {:else}
          <div 
            class="placeholder"
            class:verso={canvasIdx == 0}
            class:recto={canvasIdx == 1}
            style:--width={innerWidth * 0.125}
            ></div>
          {/if}
        {/each}
      </div>    
    {/each}
  {/if}
</div>

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
    height: 100%;
    min-width: calc(var(--width) * 1px);
    width: calc(var(--width) * 1px);
    display: grid;
    grid-template-areas: "verso recto";
    grid-template-columns: var(--columnWidth, 50%) var(--columnWidth, 50%);
    grid-template-rows: 1fr;
    position: relative;

    &.zoomed {
      overflow: auto;
    }
  }

  .spread-idx {
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

  .placeholder {
    border: 1px dotted #ddd;
    background: #ddd;
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    height: calc(var(--width) * 1px);
    width: calc(var(--width) * 1px);
    align-self: center;
    justify-self: center;

    &.verso {
      grid-area: verso;
    }

    &.recto {
      grid-area: recto;
    }
  }
  
</style>