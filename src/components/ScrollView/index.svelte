<script>
  import { onMount } from 'svelte';

  import VirtualList from '../VirtualList.svelte';
  import Page from '../Page/index.svelte';

  let container;
  let content;

  let virtualList;

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
        // loadImage(canvas, pageMap[i]);
      }
    }
    for(const item of inView) {
      manifest.items[item].inView = false;
      // pageMap[item].toggle(false);
      console.log("-- app.unmount", manifest.items[item].seq);
    }
    inView = new Set(tmp);
  }

  onMount(() => {
    console.log("-- itemCount", manifest.total_items);
  })
</script>

<div class="view--container" bind:this={container}>
  <VirtualList
      bind:this={virtualList}
      on:itemsUpdated={onItemsUpdated}
      width="100%"
      height="auto"
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