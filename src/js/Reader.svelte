<script>
  import { onMount, setContext } from 'svelte';
	import { writable, get } from 'svelte/store';

	import { Manifest } from './lib/manifest';
  import { updateHistory } from './lib/history';
	import Emittery from 'emittery';
  import { tooltip } from './lib/tooltip';

  // import { drag } from './lib/drag';
	import { constrain } from './components/SplitPane/utils.js';

  // components
  import WebsiteHeader from '~firebird-common/src/js/components/Header';
  import AcceptableUseBanner from '~firebird-common/src/js/components/AcceptableUseBanner';

  import ViewerToolbar from './components/ViewerToolbar';
	import Panel from './components/Panel';

	import MetadataPanel from './components/MetadataPanel/index.svelte';
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
	// import ScrollView from './components/ScrollView/v2.svelte';
	// import FlipView from './components/FlipView/v2.svelte';
	// import GridView from './components/GridView/v2.svelte';

  import OneUpView from './components/V04/OneUpView';
  import TwoUpView from './components/V04/TwoUpView';
  import GridView from './components/V04/GridView';
  import Loading from './components/V04/Loading';

  // set up context
	const emitter = new Emittery();
	setContext('emitter', emitter);

	const manifest = new Manifest(HT.params);
	setContext('manifest', manifest);

  document.documentElement.dataset.originalTitle = document.title;

  let isBuildingView = false;
  let showLoadingView = false;

  // build environment
	const views = {};
	views['1up'] = OneUpView;
	views['2up'] = TwoUpView;
	views['thumb'] = GridView;

	export let view = manifest.view;
	export let format = manifest.format || 'image';

	// && ! isEmbed
	if ( window.innerWidth < 800 && manifest.ui != 'embed' ) {
		view = '1up';
  } else if ( manifest.totalSeq == 1 && manifest.view == '2up' ) {
    view = '1up';
  }
	
  let isReaderView = views[view] != null;

	let lastView = '1up';
	const currentView = writable(view);
	const currentFormat = writable(format);
	const currentSeq = writable(manifest.currentSeq);
	
	let instance;
	manifest.instance = instance;

	manifest.currentView = currentView;
	manifest.currentFormat = currentFormat;
	manifest.currentSeq = currentSeq;
	manifest.q1 = writable(manifest.q1 || '');
	manifest.currentLocation = writable({});
	manifest.interfaceMode = writable(document.body.dataset.interface);
  const interfaceMode = manifest.interfaceMode;
	manifest.isFullscreen = writable(false);
	const isFullscreen = manifest.isFullscreen;

	const storedSelected = JSON.parse(sessionStorage.getItem(manifest.selectedKey) || '[]');
	manifest.selected = writable(new Set(storedSelected));

	window.manifest = manifest;
  window.emitter = emitter;

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
  
  let stage;

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
    document.body.style.setProperty('--aside-width', position);
		// dispatch('change');
	}

  let lastPosition;
  let asideExpanded = true;
  function togglePane() {
    asideExpanded = ! asideExpanded;
    document.body.style.setProperty(
      '--aside-collapsed-width', 
      asideExpanded ? null : '16px');
  }

  let optionsToggled = false;
  function toggleOptions() {
    optionsToggled = !optionsToggled;
    document.body.dataset.optionsToggled = optionsToggled;
  }

  let lightboxModal;
  let lightboxImg;
  function openLightbox(options) {
    lightboxImg.style.visibility = 'hidden';
    lightboxImg.addEventListener('load', () => lightboxImg.style.visibility = 'visible', { once: true });
    lightboxImg.src = options.src;
    lightboxImg.alt = options.alt;
    lightboxModal.showModal();
  }

  function closeLightbox(event) {
    event.stopPropagation();
    lightboxModal.close();
  }

  // emitter.on('switch.view', switchView);
  emitter.on('open.lightbox', openLightbox);

	let targetView;
	function switchView(options) {
		// console.log("-- switchView", options);
		targetView = options.view || lastView;
		if ( targetView == '2up' && window.innerWidth < 800 ) {
			targetView = '1up';
		}
    if ( targetView == $currentView ) { return ; }
		if ( $currentView != 'thumb' ) {
			lastView = $currentView;
		}
		if ( options.seq ) {
			$currentSeq = options.seq;
		}
		// $currentView = targetView;
    // updateHistory({ view: targetView, seq: $currentSeq });
    setupLoadingView();
    setTimeout(() => {
      $currentView = targetView;
      updateHistory({ view: targetView, seq: $currentSeq });
    }, 0);
	}

	function switchFormat(options) {
		// console.log("-- switchFormat", options);
		if ( $currentFormat != options.format ) {
			$currentFormat = options.format;
      updateHistory({ format: options.format });
		}
	}

  let loadingTimeout;
  function setupLoadingView() {
    if ( ! isReaderView ) { return ; }
    isBuildingView = true;
    loadingTimeout = setTimeout(() => {
      showLoadingView = true;
    }, 100);
  }

  function hideLoadingView() {
    clearTimeout(loadingTimeout);
    showLoadingView = false;
    setTimeout(() => {
      isBuildingView = false;
      document.querySelector('#root').scrollTop = 0; // always
    }, 500);
  }

	emitter.on('switch.view', switchView);
	emitter.on('switch.format', switchFormat);
  emitter.on('view.ready', hideLoadingView);

  console.log("-- startup.seq", $currentSeq);

  $: if ( stage ) { stage.style.setProperty('--stage-header-height', document.querySelector('hathi-website-header').clientHeight); }

  onMount(() => {
    // force this in case we're doing id=open/id=r, etc.
    updateHistory({ id: manifest.id });
    setupLoadingView();

    container = document.querySelector('#root');
    w = container.clientWidth;
    h = container.clientHeight;

		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			const contentBoxSize = entry.contentBoxSize[0];
      w = contentBoxSize.inlineSize;
      h = contentBoxSize.blockSize;
      stage.style.setProperty('--stage-header-height', document.querySelector('hathi-website-header').clientHeight);

      if ( window.innerHeight < 600 ) {
        manifest.interfaceMode.set('minimal');
        document.body.dataset.interface = 'minimal';
      }

      clampHeight = ( h <= 600 ) ? '600px' : '0px';
    })

		resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
			emitter.off('switch.view', switchView);
			emitter.off('switch.format', switchFormat);
			emitter.off('open.lightbox', openLightbox);
    }
  })

  let clampHeight = '0px';

	$: position = pos;
	$: if (container) {
		const size = type === 'horizontal' ? w : h;
		position = constrain(container, size, min, max, position, priority);
	}
  // $: console.log(":: position", position, w, h, min, max);
  $: if ( isReaderView && currentSeq ) { updateHistory({ seq: $currentSeq }); }

  onMount(() => {
    let resizeObserver = new ResizeObserver(entries => {
      const entry = entries.at(0);
      const height = entry.contentRect.height;
      if ( height < 600 ) {
        clampHeight = `600px`;
      } else {
        clampHeight = `0px`;
      }
    })
    resizeObserver.observe(container)
  })

</script>

<hathi-website-header>
	<WebsiteHeader searchState="toggle" compact={true}></WebsiteHeader>
</hathi-website-header>
<div style="grid-area: options">
  <button 
    data-action="toggle-options" 
    style="grid-area: options" 
    class="btn btn-dark shadow rounded-0 w-100 d-flex justify-content-between align-items-center d-md-none" 
    class:d-none={$interfaceMode == 'minimal'}
    on:click={toggleOptions}>
    <span>Options</span>
    <i 
      class="fa-solid fa-angle-down" 
      class:fa-rotate-180={optionsToggled} 
      aria-hidden="true"></i>
  </button>
</div>
{#if isReaderView}
<ViewerToolbar></ViewerToolbar>
{/if}
<aside>
  <div 
    class="inner"
    class:invisible={!asideExpanded}
    >
    <div 
      class="accordion" 
      id="controls">
      <MetadataPanel></MetadataPanel>
      {#if manifest.ui != 'crms'}
      <DownloadPanel></DownloadPanel>
      {/if}
      {#if isReaderView }
      <SearchInItemPanel></SearchInItemPanel>
      <JumpToSectionPanel></JumpToSectionPanel>
      {/if}
      {#if manifest.ui != 'crms'}
      <GetThisItemPanel></GetThisItemPanel>
      <CollectionsPanel></CollectionsPanel>
      <SharePanel></SharePanel>
      {/if}
    </div>
    <VersionPanel></VersionPanel>
  </div>
</aside>
<div class="divider" use:drag={(e) => update(e.clientX, e.clientY, e)}>
  <button 
    type="button" 
    class="btn x-btn-lg btn-outline-dark shadow rounded-circle"
    use:tooltip
    aria-label="{asideExpanded ? 'Close sidebar' : 'Open sidebar'}"
    on:click={togglePane}>
    <i 
      class="fa-solid fa-arrow-right-from-bracket"  
      class:fa-flip-horizontal={asideExpanded}
      aria-hidden="true"></i>
  </button>
</div>
<main bind:this={stage} style:--clampHeight={clampHeight}>
  {#if stage}
    {#if view == 'search'}
    <SearchView></SearchView>
    {:else if view == 'restricted'}
    <RestrictedView></RestrictedView>
    {:else}
    <!-- <ViewerToolbar></ViewerToolbar> -->
    <svelte:component 
      this={views[$currentView]}
      startSeq={$currentSeq}
      container={stage}
      ></svelte:component>
    {/if}
  {/if}
</main>
{#if isBuildingView}
<Loading show={showLoadingView} />
{/if}

<AcceptableUseBanner></AcceptableUseBanner>

{#if dragging}
	<div class="mousecatcher" />
{/if}

<dialog 
  bind:this={lightboxModal} 
  class="lightbox border-0 rounded">
  <div class="d-flex align-items-center justify-content-center h-100 w-100 overflow-auto position-relative">
    <button
      type="button"
      class="btn btn-outline-dark text-uppercase shadow"
      style="position: absolute; top: 0; right: 0"
      aria-label="Close Modal"
      on:click={closeLightbox}>Close <i class="fa-solid fa-xmark" aria-hidden="true" /></button
    >
    <img 
      alt=""
      bind:this={lightboxImg} 
      class="h-auto w-auto mw-100 mh-100 border border-dark" />
  </div>
</dialog>

<style>
	.mousecatcher {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background: rgba(255, 255, 255, 0.0001);
	}

  .lightbox {
    width: 98dvw;
    height: 98dvh;
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    margin: 0 auto;

    background: #ddd;
    z-index: 5000;
  }

  .lightbox::backdrop {
    background: rgba(0,0,0,0.5);
  }

</style>