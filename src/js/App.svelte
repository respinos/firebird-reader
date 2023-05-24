<script>
  import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';

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

	export let view = '1up';
	export let format = 'image';

	let lastView = '1up';
	const currentView = writable(view);
	const currentFormat = writable(format);
	const currentSeq = writable(manifest.currentSeq);
	manifest.currentView = currentView;
	manifest.currentFormat = currentFormat;
	manifest.currentSeq = currentSeq;

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

	function switchView(options) {
		console.log("-- switchView", options);
		let targetView = options.view || lastView;
		if ( $currentView != 'thumb' ) {
			lastView = $currentView;
		}
		if ( options.seq ) {
			$currentSeq = options.seq;
		}
		$currentView = targetView;
	}

	emitter.on('switch.view', switchView);

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
	<WebsiteHeader searchState="toggle" compact={true}></WebsiteHeader>
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
	<SplitPane class="reader" type="horizontal" min="0%" max="50%" pos="30%" snap="10%" expanded={expanded} maximized={maximized} --color="#fff" --thickness="64px">
	<aside slot="a" style="overflow: auto">
		<div class="accordion" id="controls">
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
