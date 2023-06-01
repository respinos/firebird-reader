<script>
  import { onMount, afterUpdate, onDestroy, getContext } from 'svelte';
  import { get } from 'svelte/store';
	import { createObserver } from '../../lib/observer';
  import PQueue from "p-queue";
  import { debounce } from '../../lib/debounce';

  import Page from '../Page/v2.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');
  const currentView = manifest.currentView;
  
  const currentSeq = manifest.currentSeq;
  const currentFormat = manifest.currentFormat;

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

  const { observer, io } = createObserver({
    root: container,
    threshold: [ 0, 0.25, 0.5, 0.75, 1.0 ],
    rootMargin: `200% 0% 200% 0%`
  });
  observer.observedIdx = 0;
  observer.totalIdx = manifest.totalSeq;

  export const currentLocation = function() {
    return { page: itemMap[$currentSeq] };
  }

  const unloadPage = async function(pageDatum) {
    let percentage = itemMap[pageDatum.seq].page.visible(viewport);    
    console.log("!! unloading", pageDatum.seq, percentage, isInitialized, "->", pageDatum);
    if ( pageDatum.intersectionRatio > 0 ) { return ; }
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
        priority: seq == $currentSeq ? Infinity : 0 
      })
    });

    // currentInView.length = 0;
    // currentInView.push(...newInView);
  }

  let seqTimeout;
  const handleIntersecting = (({detail}) => {
    let seq = parseInt(detail.target.dataset.seq);
    // console.log("$$ looking for currentSeq", seq);
    let pageDatum = itemMap[seq];
    if ( detail.isIntersecting ) {
      pageDatum.intersectionRatio = detail.intersectionRatio;
      if ( pageDatum.loaded ) {
        console.log("# scroll.intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        // but maybe we have pages that haven't been loaded!
        // if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        // pageDatum.timeout = setTimeout(() => {
        //   console.log("# intersecting", seq);
        //   loadPages(seq);
        // }, 1000);
      } else {
        console.log("+ scroll.intersecting", seq, detail.isIntersecting, detail.intersectionRatio);
        // pageDatum.page.toggle(true);
        // pageDatum.inView = true;
        if ( pageDatum.timeout ) { clearTimeout(pageDatum.timeout); }
        pageDatum.timeout = setTimeout(() => {
          // console.log("$ intersecting", seq);
          loadPages(seq);
        }, 1000);
      }
      currentInView.add(seq);
      // console.log("? scroll.intersecting", seq, Array.from(currentInView));
    } else {
      // console.log("? intersecting", seq, detail.isIntersecting, detail.intersectionRatio, pageDatum.isVisible);
    }
    // console.log("!! currentInView", Array.from(currentInView));
    if ( seqTimeout ) {
      clearTimeout(seqTimeout);
    }
    seqTimeout = setTimeout(setCurrentSeq, 100);
  })

  const handleUnintersecting = (({detail}) => {
    // observer.observedIdx += 1;
    // console.log("-- scroll.unintersecting", detail.target.dataset.seq, observer.observedIdx, isInitialized, detail.target.dataset.loaded);
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
  })

  let viewport = {};
  const updateViewport = function() {
    viewport.height = container.offsetHeight;
    viewport.top = container.scrollTop;
    viewport.bottom = viewport.top + viewport.height;
  }
  updateViewport();

  const setCurrentSeq = function() {
    if ( ! isInitialized ) { return ; }

    let max = { seq: -1, percentage: 0 };
    let possibles = Array.from(currentInView).sort((a,b) => a-b);
    possibles.forEach((seq) => {
      let percentage = itemMap[seq].page.visible(viewport);
      if ( percentage > max.percentage ) {
        max.seq = seq;
        max.percentage = percentage;
      }
    })
    // console.log("-- scroll.setCurrentSeq", max.seq, $currentSeq, possibles, Array.from(currentInView));
    if ( max.seq > 0 ) {
      $currentSeq = max.seq;
    }
    focus($currentSeq);
    manifest.currentLocation.set(currentLocation());
  }

  let focusSeq;
  const focus = function(seq) {
    if ( focusSeq ) {
      itemMap[focusSeq].page.unfocus();
    }
    itemMap[seq].page.focus();
    focusSeq = seq;
  }

  let content;

  let zoom = 1;
  let zoomIndex = 2;
  const zoomScales = [ 0.5, 0.75, 1, 1.5, 1.75, 2, 2.5 ];

  let pageMap = {};

  const itemData = [];
  const itemMap = {};
  const currentInView = new Set;

  let innerHeight = container.clientHeight;
  let innerWidth = container.clientWidth;

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
      target = $currentSeq + options.delta;
    } else if ( options.seq && ! isNaN(options.seq) ) {
      target = options.seq;
    } else {
      // invalid option;
      return;
    }
    if ( target == $currentSeq && ! options.force ) { return ; }
    if ( target < 1 ) { target = 1 ; }
    else if ( target > manifest.totalSeq ) {
      target = manifest.totalSeq;
    }

    console.log("<< goto.page", options, target, $currentSeq);
    setTimeout(() => {
      itemMap[target].page.scrollIntoView();
      if ( resizeSeq ) { resizeSeq = null; }
    })
  }

  emitter.on('goto.page', gotoPage);

  emitter.on('update.zoom', delta => {
    startSeq = $currentSeq;
    isInitialized = false;

    console.log('<< update.zoom', zoomIndex, delta, zoom);
    zoomIndex += delta;
    if ( zoomIndex < 0 ) { zoomIndex = 0; }
    else if ( zoomIndex >= zoomScales.length ) {
      zoomIndex = zoomScales.length - 1;
    }
    zoom = zoomScales[zoomIndex];

    emitter.emit('enable.zoom', {
      out: zoomIndex > 0,
      in: zoomIndex < ( zoomScales.length - 1 )
    });
  })

  let resizeTimeout; let resizeSeq;
  function handleResize(entry) {
    innerWidth = entry.contentRect.width;
    innerHeight = entry.contentRect.height;
    console.log("-- resizeObserver", innerWidth, innerHeight);
    setTimeout(() => { 
      console.log("-- scroll.resize", resizeSeq);
      gotoPage({ seq: resizeSeq, force: true }) 
    });
    resizeTimeout = null;
  }

  $: console.log("-- scroll", $currentView);

  let isInitialized = false;
  afterUpdate(() => {
    if ( itemMap[manifest.totalSeq].page ) {
      if ( ! isInitialized && observer.observedIdx == manifest.totalSeq ) {
        if ( startSeq > 1 ) {
          console.log("-- scroll.afterUpdate initializing", startSeq, observer.observedIdx);
          setTimeout(() => {
            itemMap[startSeq].page.scrollIntoView({ 
              behavior: 'instant',
              block: "start", 
              inline: "nearest"
            });
            isInitialized = true;

            $currentSeq = startSeq;

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

  onMount(() => {
    console.log("-- scrollView itemCount", manifest.totalSeq, isInitialized, startSeq, $currentSeq);

    const handleScroll = debounce((ev) => {
      updateViewport();
      setCurrentSeq();
    }, 100);

    container.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries.at(0);
      if ( resizeTimeout ) { clearTimeout(resizeTimeout); }
      if ( resizeSeq == null ) { 
        console.log("-- scroll.resizeObserver", $currentSeq);
        resizeSeq = $currentSeq; 
      }
      resizeTimeout = setTimeout(() => handleResize(entry), 100);
    })

    resizeObserver.observe(container);

    return () => {
      let t0 = (new Date).getTime();
      emitter.off('goto.page', gotoPage);
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      console.log("-- scroll.demount", (new Date).getTime() - t0);
    }
  })

  let inner;
  onDestroy(() => {
    console.log("-- ScrollView DESTROY");

    isInitialized = false;
    if ( io ) {
      io.disconnect();
    }
    // container.innerHTML = '';
  })
</script>

<div class="inner" bind:this={inner}>
{#each itemData as canvas (canvas.seq)}
<Page 
  bind:this={canvas.page}
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
{/each}
</div>

<style lang="scss">

  // :global(main) {
  //   display: flex;
  //   flex-direction: column;
  //   gap: 1rem;
  //   scroll-behavior: auto;
  //   width: 100%;
  // }

  // .inner {
  //   display: flex;
  //   flex-direction: column;
  //   gap: 1rem;
  //   scroll-behavior: auto;
  //   width: 100%;
  // }
</style>