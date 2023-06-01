<script>
  import { onMount, afterUpdate, onDestroy, getContext } from 'svelte';
	import { createObserver } from '../../lib/observer';
  import PQueue from "p-queue";
  import { debounce } from '../../lib/debounce';

  import Page from '../Page/v2.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');
  export let container;
  export let startSeq = 1;

  let instance;

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

  export const currentLocation = function() {
    return { page: itemMap[$currentSeq] };
  }

  const { observer, io } = createObserver({
    root: container,
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ],
    rootMargin: `200% 0% 200% 0%`
  });
  observer.observedIdx = 0;
  observer.totalIdx = manifest.totalSeq;

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

  const loadPages = function(targetSeq) {
    if (itemMap[targetSeq].timeout) {
      clearTimeout(itemMap[targetSeq].timeout);
      itemMap[targetSeq].timeout = null;
    }
    // if (itemMap[currentSeq].peeked) { itemMap[currentSeq].peeked = false;}
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
    console.log("$$ looking for currentSeq", seq);
    if ( ! window.xyzRect ) { window.xyzRect = detail.boundingClientRect; }
    let pageDatum = itemMap[seq];
    if ( detail.isIntersecting ) {
      pageDatum.intersectionRatio = detail.intersectionRatio;
      if ( pageDatum.loaded ) {
        console.log("# intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        // but maybe we have pages that haven't been loaded!
        // if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        // pageDatum.timeout = setTimeout(() => {
        //   console.log("# intersecting", seq);
        //   loadPages(seq);
        // }, 1000);
      } else {
        console.log("+ intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        // pageDatum.page.toggle(true);
        // pageDatum.inView = true;
        if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        pageDatum.timeout = setTimeout(() => {
          console.log("$ intersecting", seq);
          loadPages(seq);
        }, 1000);
        // loadPages(seq);
      }
      // currentInView.push(seq);
      currentInView.add(seq);
    } else {
      console.log("? intersecting", seq, detail.isIntersecting, detail.intersectionRatio, pageDatum.isVisible);
    }
    console.log("!! currentInView", Array.from(currentInView));
    setCurrentSeq();
  })

  const handleUnintersecting = (({detail}) => {
    // observer.observedIdx += 1;
    // console.log("- un/intersecting", detail.target.dataset.seq);
    if ( observer.observedIdx < manifest.totalSeq ) { return ; }
    if ( detail.target.dataset.loaded != 'true' ) { return ; }

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

    // itemMap[seq].timeout = setTimeout(() => {
    //   unloadPage(itemMap[seq]);
    // })
  })

  const peekPages = function(curentSeq, check) {
    let start, end, delta;
    // if ( check > 0.7 ) {
    //   start = currentSeq + 1;
    //   end = currentSeq + 5;
    // } else if ( check < 0.25 ) {
    //   start = currentSeq - 5;
    //   end = currentSeq - 1;
    // } else {
    //   // no reason to peek
    //   return;
    // }
    start = currentSeq - 2; end = currentSeq + 2;
    // if ( itemMap[start] && itemMap[start].loaded ) { return ; }
    // if ( ! itemMap[start] ) { return; }
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

  let content;

  const currentSeq = manifest.currentSeq;

  let zoom = 1;
  let zoomIndex = 1;
  const zoomScales = [ 0.5, 1 ];

  let pageMap = {};

  
  const itemData = [];
  const itemMap = {};
  const currentInView = new Set;

  let innerHeight = 250;
  let innerWidth = innerHeight / manifest.defaultImage.ratio;

  let baseHeight = Math.ceil(innerHeight * 0.90) * zoom;
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

  const gotoPage = function(options) {
    let target;
    if ( options.delta ) {
      target = currentSeq + options.delta;
    } else if ( options.seq && ! isNaN(options.seq) ) {
      target = options.seq;
    } else {
      // invalid option;
      return;
    }
    if ( target == currentSeq ) { return ; }
    if ( target < 1 ) { target = 1 ; }
    else if ( target > manifest.totalSeq ) {
      target = manifest.totalSeq;
    }

    console.log("<< goto.page", options, target, currentSeq);
    setTimeout(() => {
      itemMap[target].page.scrollIntoView();
    })
  }

  let focusTimeout;
  const handleFocusIn = function(event) {
    console.log("handleFocusIn", event);
    if ( event.target.closest('details') ) { return ; }
    if ( event.target.closest('button') ) { return ; }
    let pageDiv = event.target.closest('div.page');
    if ( pageDiv ) {
      focusTimeout = setTimeout(() => {
        pageDiv.scrollIntoView();
      }, 100);
    }
  }

  const handleKeyDown = function(event) {
    if ( event.target.closest('details') ) { return; }
    if ( event.target.closest('button') ) { return ; }
    let pageDiv = event.target.closest('div.page');
    if ( ! pageDiv ) { return ; }
    if ( event.code == 'Enter' ) {
      clearTimeout(focusTimeout);
      emitter.emit('switch.view', { seq: pageDiv.dataset.seq });
    } else if ( event.code == 'Tab' ) {
      // let delta = event.shiftKey ? -1 : 1;
      // let targetSeq = parseInt(pageDiv.dataset.seq, 10) + delta;
      // if ( itemMap[targetSeq] ) {
      //   itemMap[targetSeq].page.focus(true);
      // }
    }
  }

  const handlePageClick = function(event) {
    console.log(event);
    if ( event.target.closest('details') ) { return ; }
    if ( event.target.closest('button') ) { return ; }
    event.stopPropagation();
    let pageDiv = event.target.closest('div.page');
    if ( ! pageDiv ) { return ; }
    clearTimeout(focusTimeout);
    console.log("-- thumb.handlePageClick", pageDiv.dataset.seq);
    emitter.emit('switch.view', { seq: pageDiv.dataset.seq });
  }

  let viewport = {};
  const updateViewport = function() {
    viewport.height = container.offsetHeight;
    viewport.top = container.scrollTop;
    viewport.bottom = viewport.top + viewport.height;
  }
  updateViewport();

  const setCurrentSeq = function() {
    if ( ! isInitialized ) { return ; }

    console.log("-- setCurrentSeq", viewport);
    let max = { seq: -1, percentage: 0 };
    let possibles = Array.from(currentInView).sort((a,b) => a-b);
    possibles.forEach((seq) => {
      let percentage = itemMap[seq].page.visible(viewport);
      if ( percentage ) {

      }
      if ( percentage > max.percentage ) {
        max.seq = seq;
        max.percentage = percentage;
      }
    })
    $currentSeq = max.seq;
    emitter.emit('update.seq', currentSeq);

    focus();
  }

  let lastCurrentInView = new Set();
  const focus = function() {
    currentInView.forEach((seq) => {
      console.log("++ focusing", seq);
      itemMap[seq].page.focus();
      lastCurrentInView.delete(seq);
    })
    lastCurrentInView.forEach((seq) => {
      console.log("-- unfocusing", seq);
      itemMap[seq].page.unfocus();
    })
    lastCurrentInView = new Set(currentInView);
  }

  emitter.on('goto.page', gotoPage);

  emitter.on('update.zoom', delta => {
    zoomIndex += delta;
    if ( zoomIndex < 0 ) { zoomIndex = 0; }
    else if ( zoomIndex >= zoomScales.length ) {
      zoomIndex = zoomScales.length - 1;
    }
    zoom = zoomScales[zoomIndex];

    console.log('<< update.zoom', zoomIndex, delta, zoom, zoomIndex > 0, zoomIndex < zoomScales.length);
    emitter.emit('enable.zoom', {
      out: zoomIndex > 0,
      in: zoomIndex < ( zoomScales.length - 1 )
    });

  })

  let isInitialized = false;
  afterUpdate(() => {
    if ( itemMap[manifest.totalSeq].page ) {
      console.log("-- thumb.afterUpdate", isInitialized, startSeq, observer.observedIdx, manifest.totalSeq);
      if ( ! isInitialized && observer.observedIdx == manifest.totalSeq ) {
        if ( startSeq > 1 ) {
          setTimeout(() => {
            console.log("--! initialize", startSeq);
            itemMap[startSeq].page.scrollIntoView({ behavior: 'instant'});
            isInitialized = true;

            $currentSeq = startSeq;

            emitter.emit('enable.zoom', {
              out: zoomIndex > 0,
              in: zoomIndex < zoomScales.length - 1
            });

          })
        } else {
          console.log("--: initialize", startSeq);
          isInitialized = true;
        }
      }
    }
  })

  onMount(() => {
    console.log("-- itemCount", manifest.totalSeq);

    const handleScroll = debounce((ev) => {
      updateViewport();
      setCurrentSeq();
    }, 100);

    container.addEventListener('scroll', handleScroll);

    return () => {
      emitter.off('goto.page', gotoPage);
      container.removeEventListener('scroll', handleScroll);
    }
  })

  let inner;
  onDestroy(() => {
    if ( io ) {
      io.disconnect();
    }
    // container.innerHTML = ''; 
    inner.innerHTML = '';
  })
</script>

<!-- on:focusin={handleFocusIn} -->
<div 
  class="inner" 
  on:click={handlePageClick} 
  on:keydown={handleKeyDown} 
  on:focusin={handleFocusIn}
  bind:this={inner}>
  {#each itemData as canvas}
  <Page 
    bind:this={canvas.page}
    {observer} 
    {canvas} 
    {handleIntersecting}
    {handleUnintersecting}
    {innerHeight}
    {innerWidth}
    area="thumb"
    format="image"
    seq={canvas.seq}
    bind:zoom={zoom}
    {thumbnailer}></Page>
  {/each}
</div>

<style>

  .inner {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem;

    scroll-behavior: auto;
    padding: 2rem 1rem;
    /* padding: 1rem;
    padding-top: 4rem; */
    width: 100%;
    height: 100%;
  }
</style>