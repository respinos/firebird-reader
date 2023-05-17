<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	import { createObserver } from 'svelte-use-io';
  import PQueue from "p-queue";

  import Page from '../Page/index.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');
  export let container;

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

  console.log("AHOY AHOY createObserver", container);

  const unloadPage = async function(pageDatum) {
    console.log("!! unloading", pageDatum.seq, queue.size, "->", pageDatum);
    itemMap[pageDatum.seq].page.toggle(false);
    currentInView.delete(pageDatum.seq);
    pageDatum.loaded = pageDatum.inView = false;
    itemMap[pageDatum.seq].timeout = null;
  }

  const loadPage = async function(pageDatum, delta) {
    if (! pageDatum.loaded) {
      console.log(":: loading", pageDatum.seq, queue.size, "->", pageDatum);
      // if ( ! pageDatum.peeked ) {
      //   pageDatum.loaded = true;
      // }
      pageDatum.loaded = true;
      pageDatum.page.toggle(true);
    } else {
      console.log("$$ ignoring", pageDatum.seq, queue.size, "->", pageDatum);
    }
    pageDatum.enqueued = false;
    return pageDatum;
  }

  const queuePage = async function(pageDatum) {
    pageDatum.enqueued = true;
    let delta = Math.floor(Math.random() * 1000);
    return loadPage(pageDatum, delta);
  }

  const loadPages = function(currentSeq) {
    if (itemMap[currentSeq].timeout) {
      clearTimeout(itemMap[currentSeq].timeout);
      itemMap[currentSeq].timeout = null;
    }
    let previouslyInView = [];
    itemData.forEach((item) => {
      if ( item.inView ) {
        previouslyInView.push(item.seq);
      }
    })
    let newInView = [ currentSeq ];
    for (let seq = currentSeq - 1; seq >= currentSeq - 5; seq--) {
      if (seq > 0) {
        newInView.push(seq);
      }
    }
    for (let seq = currentSeq + 1; seq <= currentSeq + 5; seq++) {
      if (seq < manifest.totalSeq) {
        newInView.push(seq);
      }
    }

    let currentDiff = previouslyInView.filter(x => !newInView.includes(x));
    let newDiff = newInView.filter(x => !previouslyInView.includes(x));

    // console.log("$$$ DIFF", currentSeq, currentDiff, newDiff);

    // currentDiff.forEach((seq) => {
    //   itemMap[seq].inView = false;
    //   // and push unto the unload stack
    //   unloadQueue.add(() => {
    //     return unloadPage(itemMap[seq])
    //   });
    // })

    newDiff.forEach((seq) => {
      itemMap[seq].inView = true;
      queue.add(() => {
        return queuePage(itemMap[seq])
      }, 
      { 
        priority: seq == currentSeq ? Infinity : 0 
      })
    });

    // currentInView.length = 0;
    // currentInView.push(...newInView);
  }

  const handleIntersecting = (({detail}) => {
    let seq = parseInt(detail.target.dataset.seq);
    // console.log("$$ looking for currentSeq", seq);
    let pageDatum = itemMap[seq];
    if ( detail.isIntersecting ) {
      pageDatum.intersectionRatio = detail.intersectionRatio;
      if ( pageDatum.loaded ) {
        console.log("# intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
      } else {
        console.log("+ intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        pageDatum.timeout = setTimeout(() => {
          console.log("$ intersecting", seq);
          loadPages(seq);
        }, 1000);
      }
      currentInView.add(seq);
    } else {
      console.log("? intersecting", seq, detail.isIntersecting, detail.intersectionRatio, pageDatum.isVisible);
    }
    console.log("!! currentInView", Array.from(currentInView));
    setCurrentSeq();
  })

  const handleUnintersecting = (({detail}) => {
    return;
    let seq = parseInt(detail.target.dataset.seq);
    console.log("- un/intersecting", seq);
    itemMap[seq].intersectionRatio = undefined;
    if (itemMap[seq].timeout) {
      clearTimeout(itemMap[seq].timeout);
      itemMap[seq].timeout = null;
    }

    unloadQueue.add(() => {
      return unloadPage(itemMap[seq])
    });
  })

  const peekPages = function(curentSeq, check) {
    let start, end, delta;
    start = currentSeq - 2; end = currentSeq + 2;
    console.log("$$ currentSeq PEEK", currentSeq, start, end);
    for(let seq = start; seq <= end; seq += 1) {
      if ( itemMap[seq] && itemMap[seq].inView == false ) {
        itemMap[seq].peeked = true;
        console.log("$$ currentSeq PEEK", check, "<-", seq);
        queue.add(() => {
          return queuePage(itemMap[seq])
        }, 
        { 
          priority: 0
        })    
      }
    }
  }

  const setCurrentSeq = function() {
    return;
    if ( currentInView.length == 0 ) { return; }
    let tmp = {intersectionRatio: 0, seq: 0};
    let possibles = Array.from(currentInView).sort((a,b) => a-b);
    possibles.forEach((seq) => {
      let pageDatum = itemMap[seq];
      if ( pageDatum.intersectionRatio === undefined ) { return ; }
      // console.log("/// ---", manifestMap[seq].intersectionRatio, manifestMap[seq].inView);
      if ( itemMap[seq].intersectionRatio > tmp.intersectionRatio ) {
        tmp.intersectionRatio = itemMap[seq].intersectionRatio;
        tmp.seq = seq;
      }
    })
    if ( currentSeq != tmp.seq && tmp.seq > 0 ) {
      currentSeq = tmp.seq;
      let check = possibles.indexOf(currentSeq) / possibles.length;
      console.log("$$ currentSeq =", currentSeq, check, possibles);
      // peekPages(currentSeq, check);
      emitter.emit('update.seq', currentSeq);
    }
    return tmp;
  }

  let content;

  let currentSeq = 1;

  let zoom = 1;
  let zoomIndex = 0;
  const zoomScales = [ 1, 1.5, 1.75, 2, 2.5 ];

  let pageMap = {};

  
  const itemData = [];
  const spreadData = [];
  const itemMap = {};
  const currentInView = new Set;

  let left = 0;

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

    item.area = ( seq % 2 == 0 ) ? 'recto' : 'verso';
    console.log("AHOY AREA", seq, item.area);

    itemData.push(item);
    itemMap[item.seq] = item;
  }

  for(let seq = 1; seq <= manifest.totalSeq; seq+=2) {
    let spread = [];
    spread.push(itemMap[seq]);
    spread.push(itemMap[seq + 1]);
    spreadData.push(spread);
  }

  console.log("-- spread", spreadData);

  const gotoPage = function(options) {
    let target;
    let currentSpread = Math.floor(currentSeq / 2);
    if ( options.delta ) {
      target = currentSpread + options.delta;
    } else if ( options.seq && ! isNaN(options.seq) ) {
      target = Math.floor(options.seq / 2);
    } else {
      // invalid option;
      return;
    }
    if ( target == currentSpread ) { return ; }
    if ( target < 0 ) { target = 0 ; }
    else if ( target > manifest.totalSeq ) {
      target = manifest.totalSeq;
    }

    let direction = -1;

    console.log("<< goto.page", options, ( ( innerWidth * target ) ) * ( direction ), target, currentSpread, direction, ":", currentSeq);
    currentSeq = spreadData[target][0].seq;
    setTimeout(() => {
      left = ( ( innerWidth * target ) ) * ( direction );
    })
  }

  emitter.on('goto.page', gotoPage);

  emitter.on('update.zoom', delta => {
    console.log('<< update.zoom', zoomIndex, delta, zoom);
    zoomIndex += delta;
    if ( zoomIndex < 0 ) { zoomIndex = 0; }
    else if ( zoomIndex >= zoomScales.length ) {
      zoomIndex = zoomScales.length - 1;
    }
    zoom = zoomScales[zoomIndex];
  })

  onMount(() => {
    console.log("-- itemCount", manifest.totalSeq, container);

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries.at(0);
      innerWidth = entry.contentRect.width;
      innerHeight = entry.contentRect.height;
      console.log("-- resizeObserver", innerWidth, innerHeight);
    })

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
      emitter.off('goto.page', gotoPage);
    }
  })

  onDestroy(() => {
    if ( io ) {
      io.disconnect();
    }
  })
</script>

<div 
  class="inner" 
  style:--width={innerWidth} 
  style:--left={left}
  style:--columnWidth={zoom > 1 ? ( `${( innerWidth / 2 ) * zoom}px` ) : null}
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
          {#if true && canvas}
          <Page 
            bind:this={canvas.page}
            style="max-height: {innerHeight * 0.9 * zoom}px"
            area={canvasIdx == 0 ? 'verso' : 'recto'}
            {observer} 
            {canvas} 
            {handleIntersecting}
            {handleUnintersecting}
            {innerHeight}
            {innerWidth}
            seq={canvas.seq} 
            bind:zoom={zoom}
            ></Page>
          {:else}
          <pre>{canvas.seq}</pre>
          {/if}
        {/each}
      </div>    
    {/each}
  {/if}
</div>

<style>

  .inner {
    overflow: hidden;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    /* gap: 1rem; */

    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--left) * 1px);
    transition: left 0.4s;
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

</style>