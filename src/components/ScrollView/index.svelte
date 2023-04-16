<script>
  import { onMount, getContext } from 'svelte';

  import VirtualList from '../VirtualList.svelte';
  import Page from '../Page/index.svelte';

  const emitter = getContext('emitter');

  let container;
  let content;

  let virtualList;
  let scrollToIndex = 0;
  let currentSeq = 1;

  let pageMap = {};

  import manifest from '../../fixtures/manifest3.json';
  let manifestMap = {}; let heights = [];
  let baseHeight = Math.ceil(window.innerHeight * 0.90);
  manifest.items.forEach((item) => {
    item.originalHeight = item.height;
    item.originalWidth = item.width;
    item.inView = false;
    item.loaded = false;
    item.page = null;
    manifestMap[item.seq] = item;
    item.useHeight = baseHeight;
    item.useWidth = Math.ceil(baseHeight * ( item.width / item.height ));
    heights.push(baseHeight);
  })

  let inView = new Set();
  const onItemsUpdated = function(event) {
    // console.log("--", event.detail.start, event.detail.end, pageMap, imageMap);
    let tmp = [];
    for(let i=event.detail.start; i <= event.detail.end; i++) {
      let seq = i + 1;
      let canvas = manifest.items[i];
      inView.delete(i);
      tmp.push(i);
      if ( ! canvas.inView ) {
        canvas.inView = true;
        console.log("-- app.mount", seq, canvas);
        if ( pageMap[i] ){
          pageMap[i].toggle(true)
        } else {
          console.log("-- app.missing.mount", seq, canvas);
        }
      }
    }
    // console.log("-- app.updated", tmpSeq);
    for(const item of inView) {
      manifest.items[item].inView = false;
      // pageMap[item].toggle(false);
      console.log("-- app.unmount", manifest.items[item].seq);
    }
    inView = new Set(tmp);
  }

  const onAfterScroll = function(event) {

    let tmpSeq; let percentage = -1;
    let stats = event.detail.stats;
    stats.forEach((stat) => {
      if ( stat.percentage > percentage ) {
        percentage = stat.percentage;
        tmpSeq = manifest.items[stat.index].seq;
      }
      console.log("-- update.percentage", stat.index, stat.percentage, percentage, tmpSeq);
    })
    updateCurrentSeq(tmpSeq);
  }

  emitter.on('goto.page', data => {
    let target;
    if ( data == 'PREV' && currentSeq > 0 ) {
      target = scrollToIndex - 1;
    } else if ( data == 'NEXT' && currentSeq <= manifest.total_items - 1 ) {
      target = scrollToIndex + 1;
    } else if ( ! isNaN(data) ) {
      target = data - 1;
    }
    console.log("<< goto.page", data, target);
    scrollToIndex = target;
  });

  const updateCurrentSeq = function(seq) {
    console.log("-- updateCurrentSeq", seq, currentSeq);
    if ( seq != currentSeq ) {
      currentSeq = seq;
      emitter.emit('update.seq', currentSeq);
    }
  }

  onMount(() => {
    console.log("-- itemCount", manifest.total_items);
  })
</script>

<div class="view--container" bind:this={container}>
  <VirtualList
      bind:this={virtualList}
      on:itemsUpdated={onItemsUpdated}
      on:afterScroll={onAfterScroll}
      width="100%"
      height="auto"
      {scrollToIndex}
      scrollToBehaviour="smooth"
      itemCount={manifest.total_items}
      itemSize={heights}>
    <Page slot="item" let:index seq={index + 1} let:style {style} canvas={manifest.items[index]} bind:this={pageMap[index]}></Page>
  </VirtualList>
</div>

<style>

  .view--container {
    grid-row: 1/2;
    min-height: 0;
    overflow: hidden;

    display: grid;
    grid-template-rows: minmax(0, 1fr);
  }

  /* .view--content {
    grid-area: 1/2;
    min-height: 0;
  } */
</style>