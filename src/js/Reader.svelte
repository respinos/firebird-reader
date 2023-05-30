<script>
  import { onMount, setContext } from 'svelte';
	import { writable, get } from 'svelte/store';

	import { Manifest } from './lib/manifest';
	import Emittery from 'emittery';

  // import { drag } from './lib/drag';
	import { constrain } from './components/SplitPane/utils.js';

  // components
  import WebsiteHeader from '~firebird-common/src/js/components/Header';

  import ViewerToolbar from './components/ViewerToolbar';
	import Panel from './components/Panel';

	import MetadataPanel from './components/MetadataPanel';
	import VersionPanel from './components/VersionPanel';
	import JumpToSectionPanel from './components/JumpToSectionPanel';
	import GetThisItemPanel from './components/GetThisItemPanel';
	import SharePanel from './components/SharePanel';
	import CollectionsPanel from './components/CollectionsPanel';
	import SearchInItemPanel from './components/SearchInItemPanel';
	import DownloadPanel from './components/DownloadPanel';

  // view components
	import SearchView from './components/SearchView';
	import RestrictedView from './components/RestrictedView';
	import ScrollView from './components/ScrollView/Outer.svelte';
	import FlipView from './components/FlipView';
	import GridView from './components/GridView';

  // set up context
	const emitter = new Emittery();
	setContext('emitter', emitter);

	const manifest = new Manifest(HT.params);
	setContext('manifest', manifest);

  // build environment
	const views = {};
	views['1up'] = ScrollView;
	views['2up'] = FlipView;
	views['thumb'] = GridView;

	export let view = '2up';
	export let format = 'image';

	// && ! isEmbed
	if ( window.innerWidth < 800 ) {
		view = '1up';
	}

	let lastView = '1up';
	const currentView = writable(view);
	const currentFormat = writable(format);
	const currentSeq = writable(manifest.currentSeq);
	
	let instance;
	manifest.instance = instance;

	manifest.currentView = currentView;
	manifest.currentFormat = currentFormat;
	manifest.currentSeq = currentSeq;
	manifest.q1 = writable('');
	manifest.currentLocation = writable({});
	manifest.minimalInterface = writable(false);
	const minimalInterface = manifest.minimalInterface;
	manifest.isFullscreen = writable(false);
	const isFullscreen = manifest.isFullscreen;

	const storedSelected = JSON.parse(sessionStorage.getItem(manifest.selectedKey) || '[]');
	manifest.selected = writable(new Set(storedSelected));

	window.manifest = manifest;

  // aside
	let priority = 'min';
  let disabled = false;
  let position = `${26 * 16}px`;
  let container;
  let type = 'horizontal';
  let dragging = false;
	let w = 0;
	let h = 0;
  let pos = `${26 * 16}px`; // '26rem';
  let min = `${10 * 16}px`; // '10rem';
  let max = '50%';

  let maximized = false;
  let expanded = false;

  /**
   * @param {HTMLElement} node
   * @param {(event: PointerEvent) => void} callback
   */
  function drag(node, callback) {
    /** @param {PointerEvent} event */
    const pointerdown = (event) => {
      
      if ( event.target.closest('button') ) {
        return;
      }

      if (
        (event.pointerType === 'mouse' && event.button === 2) ||
        (event.pointerType !== 'mouse' && !event.isPrimary)
      )
        return;

      node.setPointerCapture(event.pointerId);

      event.preventDefault();

      dragging = true;

      const onpointerup = () => {
        dragging = false;

        node.setPointerCapture(event.pointerId);

        window.removeEventListener('pointermove', callback, false);
        window.removeEventListener('pointerup', onpointerup, false);
        // snapPane();
      };

      window.addEventListener('pointermove', callback, false);
      window.addEventListener('pointerup', onpointerup, false);
    };

    node.addEventListener('pointerdown', pointerdown, { capture: true, passive: false });

    return {
      destroy() {
        node.removeEventListener('pointerdown', pointerdown);
      }
    };
  }

	function update(x, y) {
		if (disabled) return;

		const { top, left } = container.getBoundingClientRect();

		const pos_px = type === 'horizontal' ? x - left : y - top;
		const size = type === 'horizontal' ? w : h;

		position = pos.endsWith('%') ? `${(100 * pos_px) / size}%` : `${pos_px}px`;
    console.log("-- position", position);
    container.style.setProperty('--aside-width', position);
		// dispatch('change');
	}

  let lastPosition;
  let asideExpanded = true;
  function togglePane() {
    let minWidth;
    console.log("-- toggle.pane", lastPosition, position);
    asideExpanded = ! asideExpanded;
    container.style.setProperty(
      '--aside-collapsed-width', 
      asideExpanded ? null : '16px');
    container.style.setProperty(
      '--header-collapsed-height', 
      asideExpanded ? null : '0px');
  }

  function toggleOptions() {

  }

  onMount(() => {
    container = document.querySelector('#root');
    w = container.clientWidth;
    maximized = ( w <= 700 );
  })

	$: position = pos;
	$: if (container) {
		const size = type === 'horizontal' ? w : h;
		position = constrain(container, size, min, max, position, priority);
	}
  $: console.log(":: position", position, w, h, min, max);
  $: if ( w ) { maximized = ( w <= 700 ); }

</script>

<hathi-website-header></hathi-website-header>
<div style="grid-area: options">
  {#if maximized}
  <button style="grid-area: options" class="btn btn-dark shadow rounded-0 w-100 d-flex justify-content-between align-items-center" on:click={toggleOptions}>
    <span>Options</span>
    <i class="fa-solid fa-angle-down" class:fa-rotate-180={expanded} aria-hidden="true"></i>
  </button>
  {/if}
</div>
<ViewerToolbar></ViewerToolbar>
<aside>
  <div class="inner">
    <div 
      class="accordion" 
      id="controls">
      <MetadataPanel></MetadataPanel>
      <DownloadPanel></DownloadPanel>
      {#if view != 'search' && view != 'restricted' }
      <SearchInItemPanel></SearchInItemPanel>
      <JumpToSectionPanel></JumpToSectionPanel>
      {/if}
      <GetThisItemPanel></GetThisItemPanel>
      <CollectionsPanel></CollectionsPanel>
      <SharePanel></SharePanel>
    </div>
    <VersionPanel></VersionPanel>
  </div>
</aside>
<div class="divider" use:drag={(e) => update(e.clientX, e.clientY, e)}>
  <button 
    type="button" 
    class="btn x-btn-lg btn-outline-dark shadow rounded-circle"
    on:click={togglePane}>
    <i 
      class="fa-solid fa-arrow-right-from-bracket"  
      class:fa-flip-horizontal={asideExpanded}
      aria-hidden="true"></i>
  </button>
</div>
<main>
  <div class="page" style="width: 75dvw; height: 90dvh; margin: 1rem auto; border: 2px solid black;"></div>
</main>

{#if dragging}
	<div class="mousecatcher" />
{/if}

<style>
	.mousecatcher {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.0001);
	}
</style>