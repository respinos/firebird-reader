<script>
  import { onMount, afterUpdate, onDestroy, getContext } from 'svelte';
  import View from './View.svelte';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  export let container;
  export let startSeq = 1;

  const currentSeq = manifest.currentSeq;

  let view;
  let isInitialized = true;

  export const currentLocation = function() {
    let location = {};
    if ( view.item($currentSeq) ) {
      let item = view.item($currentSeq);
      location[item.side] = item;

      if ( view.item($currentSeq).side == 'verso' ) {
        let item = view.item($currentSeq + 1);
        if ( item ) {
          location[item.side] = item;
        }
      }
    }
    return location;
  }
  
  const gotoPage = function(options, callback) {
    let target;
    let distance = 0;
    let item = view.item($currentSeq);
    let currentSpread = item.spreadIndex;
    if ( options.delta !== undefined ) {
      target = currentSpread + options.delta;
    } else if ( options.seq && ! isNaN(options.seq) ) {
      target = view.item(options.seq).spreadIndex;
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
      target = view.item(manifest.totalSeq).spreadIndex;
    }

    const spread = view.spread(target);
    spread.el.scrollIntoView({ behavior: 'instant', block: 'nearest'});
    console.log("-- spread", spread);

    $currentSeq = spread.items.find(item => item).seq;
    manifest.currentLocation.set(currentLocation());

    // focus();

    if ( callback ) {
      callback();
    }    
  }

  function setCurrentSeq() {

  }

</script>

  <View
    {container}
    {startSeq}
    {currentLocation}
    {setCurrentSeq}
    {gotoPage}
    bind:this={view}
   />

<style>

</style>