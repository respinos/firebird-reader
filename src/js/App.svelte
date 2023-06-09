<script>
  import { onMount, setContext } from 'svelte';
	import { writable, get } from 'svelte/store';

	import { Manifest } from './lib/manifest';

	// import { Pane, Splitpanes } from 'svelte-splitpanes';
	import SplitPane from './components/SplitPane';
	
	import ViewerToolbar from './components/ViewerToolbar';
	import SearchView from './components/SearchView';
	import RestrictedView from './components/RestrictedView';
	import ScrollView from './components/ScrollView/Outer.svelte';
	import FlipView from './components/FlipView';
	import GridView from './components/GridView';

	import Panel from './components/Panel';
	
	import MetadataPanel from './components/MetadataPanel';
	import VersionPanel from './components/VersionPanel';
	import JumpToSectionPanel from './components/JumpToSectionPanel';
	import GetThisItemPanel from './components/GetThisItemPanel';
	import SharePanel from './components/SharePanel';
	import CollectionsPanel from './components/CollectionsPanel';
	import SearchInItemPanel from './components/SearchInItemPanel';
	import DownloadPanel from './components/DownloadPanel';

	import WebsiteHeader from '~firebird-common/src/js/components/Header';

	import Emittery from 'emittery';
	const emitter = new Emittery();
	setContext('emitter', emitter);

	const manifest = new Manifest(HT.params);
	setContext('manifest', manifest);

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

	let stage;
	let maxStageWidth = 700;
	let expanded = false;
	let maximized = false;

	function toggleOptions() {
		expanded = ! expanded;
	}

	// $: viewClass = ( view == 'search' ) ? 'search' : 'reader';
	$: viewClass = ( views[view] ) ? 'reader' : view;

	let splitPane;
	let targetView;
	function switchView(options) {
		console.log("-- switchView", options);
		targetView = options.view || lastView;
		if ( targetView == '2up' && window.innerWidth < 800 ) {
			targetView = '1up';
		}
		if ( $currentView != 'thumb' ) {
			lastView = $currentView;
		}
		if ( options.seq ) {
			$currentSeq = options.seq;
		}
		$currentView = targetView;
	}

	function switchFormat(options) {
		console.log("-- switchFormat", options);
		if ( $currentFormat != options.format ) {
			$currentFormat = options.format;
		}
	}

	emitter.on('switch.view', switchView);
	emitter.on('switch.format', switchFormat);

	// $: if ( instance ) { manifest.instance = instance; manifest.currentLocation.set(manifest.instance.currentLocation()); }
	$: console.log("-- app", $minimalInterface, splitPane);
	$: if ( splitPane ) { if ( ! $isFullscreen ) { splitPane.togglePane($minimalInterface); } }
	$: if ( splitPane ) { splitPane.togglePane($isFullscreen); }

	onMount(() => {
		const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
		const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			const contentBoxSize = entry.contentBoxSize[0];
			console.log(contentBoxSize.inlineSize, maxStageWidth);
			if ( contentBoxSize.inlineSize <= maxStageWidth ) {
				maximized = true;
			} else {
				maximized = false;
			}
		})

		resizeObserver.observe(stage);

		return () => {
			emitter.off('switch.view', switchView);
			resizeObserver.disconnect();
		}
	})
</script>

<hathi-website-header>
	{#if !$minimalInterface}
	<WebsiteHeader searchState="toggle" compact={true}></WebsiteHeader>
	{/if}
</hathi-website-header>
<div class="stage" class:maximized={maximized} bind:this={stage}>
	{#if maximized}
	<button style="grid-area: options" class="btn btn-dark shadow rounded-0 w-100 d-flex justify-content-between align-items-center" on:click={toggleOptions}>
		<span>Options</span>
		<i class="fa-solid fa-angle-down" class:fa-rotate-180={expanded} aria-hidden="true"></i>
	</button>
	{/if}
	{#if ! maximized || ( maximized && ! expanded )}
	<ViewerToolbar></ViewerToolbar>
	{/if}
	<SplitPane 
		class="reader" 
		type="horizontal" 
		min="0%" max="50%" pos="30%" snap="10%" 
		expanded={expanded} 
		maximized={maximized} 
		bind:this={splitPane}
		--color="#fff" 
		--thickness="64px">
		<aside slot="a" style="overflow: auto">
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
		</aside>
		<section class="pane--{viewClass}" slot="b">
			{#if view == 'search'}
			<SearchView></SearchView>
			{:else if view == 'restricted'}
			<RestrictedView></RestrictedView>
			{:else}
			<!-- <ViewerToolbar></ViewerToolbar> -->
			<svelte:component 
				this={views[$currentView]}
				startSeq={$currentSeq}
				bind:this={instance}
				></svelte:component>
			{/if}
		</section>
</SplitPane>
</div>

<style lang="scss">
	.stage {
		grid-area: main;
		display: grid;

		position: relative;

		grid-template-rows: minmax(0, 1fr);
		grid-template-areas: "reader";

		&.maximized {
			grid-template-rows: min-content minmax(0, 1fr);
			grid-template-areas: "options" "reader";
		}
	}
</style>
