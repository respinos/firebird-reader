<script>
  import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';

	import { Manifest } from './lib/manifest';

	import { Pane, Splitpanes } from 'svelte-splitpanes';
	
	import ViewerToolbar from './components/ViewerToolbar';
	import SearchView from './components/SearchView';
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

	const currentView = writable(view);
	const currentFormat = writable(format);
	manifest.currentView = currentView;
	manifest.currentFormat = currentFormat;

	$: viewClass = ( view == 'search' ) ? 'search' : 'reader';

	window.switchView = function(v) {
		view = v;
		$currentView = view;
	}

	onMount(() => {
		const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
		const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
	})
</script>

<hathi-website-header>
	<WebsiteHeader searchState="toggle"></WebsiteHeader>
</hathi-website-header>
<Splitpanes class="reader" vertical style="width: 100%">
	<Pane snapSize={14} maxSize={30} size={30} class="overflow-auto pb-5 pt-3 ps-2 pe-3 bg-white">
		<div class="accordion" id="controls">
			<MetadataPanel></MetadataPanel>
			<DownloadPanel></DownloadPanel>
			{#if view != 'search'}
			<SearchInItemPanel></SearchInItemPanel>
			<JumpToSectionPanel></JumpToSectionPanel>
			{/if}
			<GetThisItemPanel></GetThisItemPanel>
			<CollectionsPanel></CollectionsPanel>
			<SharePanel></SharePanel>
		</div>
		<VersionPanel></VersionPanel>
	</Pane>
	<Pane size={75} class="pane--{viewClass}">
		{#if view == 'search'}
		<SearchView></SearchView>
		{:else}
		<ViewerToolbar></ViewerToolbar>
		<svelte:component this={views[$currentView]}></svelte:component>
		{/if}
	</Pane>
</Splitpanes>

<style>
</style>
