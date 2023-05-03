<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	import { createObserver } from 'svelte-use-io';
  import PQueue from "p-queue";

  import Page from '../Page/index.svelte';

  const emitter = getContext('emitter');
  const queue = new PQueue({
    concurrency: 5,
    interval: 1000,
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

  const { observer, io } = createObserver({
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ]
  });

  const unloadPage = async function(pageDatum) {
    console.log("!! unloading", pageDatum.seq, queue.size, "->", pageDatum);
    manifestMap[pageDatum.seq].page.toggle(false);
    pageDatum.loaded = false;
  }

  const loadPage = async function(pageDatum, delta) {
    if (! pageDatum.loaded) {
      console.log(":: loading", pageDatum.seq, queue.size, "->", pageDatum);
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
    if (manifestMap[currentSeq].timeout) {
      clearTimeout(manifestMap[currentSeq].timeout);
      manifestMap[currentSeq].timeout = null;
    }
    let previouslyInView = [];
    manifest.items.forEach((item) => {
      if ( item.inView ) {
        previouslyInView.push(item.seq);
      }
    })
    let newInView = [ currentSeq ];
    // queue.add(() => { return queuePage(manifestMap[currentSeq]) }, Infinity);
    for (let seq = currentSeq - 1; seq >= currentSeq - 5; seq--) {
      if (seq > 0) {
        // queue.add(() => { return queuePage(manifestMap[seq]) });
        newInView.push(seq);
      }
    }
    for (let seq = currentSeq + 1; seq <= currentSeq + 5; seq++) {
      if (seq < manifest.total_items) {
        // queue.add(() => { return queuePage(manifestMap[seq]) });
        newInView.push(seq);
      }
    }

    let currentDiff = previouslyInView.filter(x => !newInView.includes(x));
    let newDiff = newInView.filter(x => !previouslyInView.includes(x));

    console.log("$$$ DIFF", currentSeq, currentDiff, newDiff);

    currentDiff.forEach((seq) => {
      manifestMap[seq].inView = false;
      // and push unto the unload stack
      unloadQueue.add(() => {
        return unloadPage(manifestMap[seq])
      });
    })

    newDiff.forEach((seq) => {
      manifestMap[seq].inView = true;
      queue.add(() => {
        return queuePage(manifestMap[seq])
      }, 
      { 
        priority: seq == currentSeq ? Infinity : 0 
      })
    });

    currentInView.length = 0;
    currentInView.push(...newInView);
  }

  const handleIntersecting = (({detail}) => {
    let seq = parseInt(detail.target.dataset.seq);
    let pageDatum = manifestMap[seq];
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
    } else {
      console.log("# intersecting", seq, detail.isIntersecting, detail.intersectionRatio, pageDatum.isVisible);
    }
    setCurrentSeq();
  })

  const handleUnintersecting = (({detail}) => {
    let seq = parseInt(detail.target.dataset.seq);
    console.log("- intersecting", seq);
    manifestMap[seq].intersectionRatio = undefined;
    if (manifestMap[seq].timeout) {
      clearTimeout(manifestMap[seq].timeout);
      manifestMap[seq].timeout = null;
    }
  })

  const peekPages = function(curentSeq, check) {
    let start, end, delta;
    if ( check > 0.7 ) {
      start = currentSeq + 1;
      end = currentSeq + 5;
    } else if ( check < 0.25 ) {
      start = currentSeq - 5;
      end = currentSeq - 1;
    } else {
      // no reason to peek
      return;
    }
    for(let seq = start; seq <= end; seq += 1) {
      if ( manifestMap[seq] && manifestMap[seq].inView == false ) {
        manifestMap[seq].inView = true;
        console.log("$$ currentSeq PEEK", check, "<-", seq);
        queue.add(() => {
          return queuePage(manifestMap[seq])
        }, 
        { 
          priority: 0
        })    
      }
    }
  }

  const setCurrentSeq = function() {
    if ( currentInView.length == 0 ) { return; }
    let tmp = {intersectionRatio: 0, seq: 0};
    currentInView.forEach((seq) => {
      let pageDatum = manifestMap[seq];
      if ( pageDatum.intersectionRatio === undefined ) { return ; }
      // console.log("/// ---", manifestMap[seq].intersectionRatio, manifestMap[seq].inView);
      if ( manifestMap[seq].intersectionRatio > tmp.intersectionRatio ) {
        tmp.intersectionRatio = manifestMap[seq].intersectionRatio;
        tmp.seq = seq;
      }
    })
    if ( currentSeq != tmp.seq ) {
      currentSeq = tmp.seq;
      let check = currentInView.indexOf(currentSeq) / currentInView.length;
      console.log("$$ currentSeq =", currentSeq, check);
      peekPages(currentSeq, check);
      emitter.emit('update.seq', currentSeq);
    }
    return tmp;
  }

  window.currentSeq = function() {
    return currentSeq;
  }

  let container;
  let content;

  let currentSeq = 1;

  let zoom = 1;
  let zoomIndex = 0;
  const zoomScales = [ 1, 1.5, 1.75, 2, 2.5 ];

  let pageMap = {};

  import manifest from '../../fixtures/manifest3.json';
  const manifestMap = {};
  const currentInView = [];

  let baseHeight = Math.ceil(window.innerHeight * 0.90) * zoom;
  manifest.items.forEach((item, index) => {
    item.originalHeight = item.height;
    item.originalWidth = item.width;
    item.inView = false;
    item.loaded = false;
    item.page = null;
    item.index = index;
    item.zoom = 1;
    manifestMap[item.seq] = item;
    item.useHeight = baseHeight;
    item.useWidth = Math.ceil(baseHeight * ( item.width / item.height ));
  })


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
    else if ( target > manifest.total_items ) {
      target = manifest.total_items;
    }

    console.log("<< goto.page", options, target, currentSeq);
    setTimeout(() => {
      container.querySelector(`#id${target}`).scrollIntoView({ behavior: 'instant'});
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

    let newHeights = [];
    manifest.items.forEach((item) => {
      newHeights.push(baseHeight * zoomScales[zoomIndex] + marginBottom);
    })
    // virtualList.scrollToBehaviour = 'instant';
    scrollToIndex = currentSeq - 1;
    heights = newHeights;
    // setTimeout(() => {
    //   virtualList.scrollToBehaviour = 'smooth';
    // })

    zoom = zoomScales[zoomIndex];
  })

  emitter.on('update.zoom.page', ({ seq, delta }) => {
    let canvas = manifestMap[seq];
    canvas.zoom += delta;
    let newHeights = [...heights];
    newHeights[canvas.index] = baseHeight * canvas.zoom + marginBottom;
    console.log("-- update.zoom.page", seq, delta, newHeights[canvas.index]);
    heights = newHeights;
  })

  // const updateCurrentSeq = function(seq) {
  //   console.log("-- updateCurrentSeq", seq, currentSeq);
  //   if ( seq != currentSeq ) {
  //     currentSeq = seq;
  //     emitter.emit('update.seq', currentSeq);
  //   }
  // }

  onMount(() => {
    console.log("-- itemCount", manifest.total_items);

    return () => {
      emitter.off('goto.page', gotoPage);
    }
  })

  onDestroy(() => {
    io.disconnect();
  })
</script>

<div class="view--container" bind:this={container}>
  <div class="inner">
  {#each manifest.items as canvas}
  <Page 
    bind:this={canvas.page}
    {observer} 
    {canvas} 
    {handleIntersecting}
    {handleUnintersecting}
    seq={canvas.seq} 
    bind:zoom={zoom}
    {thumbnailer}></Page>
  {/each}
  </div>
</div>

<style>

  .view--container {
    grid-row: 1/2;
    min-height: 0;
    overflow: auto;

    /* display: grid;
    grid-template-rows: minmax(0, 1fr); */

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    scroll-behavior: auto;
  }

  /* .view--content {
    grid-area: 1/2;
    min-height: 0;
  } */
</style>