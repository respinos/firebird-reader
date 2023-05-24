<script>
  import { onMount, onDestroy, getContext } from 'svelte';
	import { createObserver } from '../../lib/observer';
  import PQueue from "p-queue";

  // import Inner from './Inner.svelte';
  import Page from '../Page/index.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

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

  const { observer, io } = createObserver({
    root: null,
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ],
    rootMargin: `200% 0% 200% 0%`
  });

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
    // if (itemMap[currentSeq].peeked) { itemMap[currentSeq].peeked = false;}
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

  const setCurrentSeq = function() {
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

  
  const itemData = [];
  const itemMap = {};
  const currentInView = new Set;

  let baseHeight = Math.ceil(window.innerHeight * 0.90) * zoom;
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
    zoom = zoomScales[zoomIndex];
  })

  // emitter.on('update.zoom.page', ({ seq, delta }) => {
  //   let canvas = manifestMap[seq];
  //   canvas.zoom += delta;
  //   newHeights[canvas.index] = baseHeight * canvas.zoom + marginBottom;
  //   console.log("-- update.zoom.page", seq, delta, newHeights[canvas.index]);
  //   heights = newHeights;
  // })

  // const updateCurrentSeq = function(seq) {
  //   console.log("-- updateCurrentSeq", seq, currentSeq);
  //   if ( seq != currentSeq ) {
  //     currentSeq = seq;
  //     emitter.emit('update.seq', currentSeq);
  //   }
  // }

  onMount(() => {
    console.log("-- itemCount", manifest.totalSeq);

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
  {#each itemData as canvas}
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
    width: 100%;
  }

  /* .view--content {
    grid-area: 1/2;
    min-height: 0;
  } */
</style>