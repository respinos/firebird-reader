<script>
  import { onMount, setContext } from 'svelte';

	import { Manifest } from './lib/manifest';

	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import View from './components/ScrollView/index.svelte';
	import ViewToolbar from './components/ViewToolbar';
	import Panel from './components/Panel';
	
	import MetadataPanel from './components/MetadataPanel';
	import VersionPanel from './components/VersionPanel';
	import JumpToSectionPanel from './components/JumpToSectionPanel';
	import GetThisItemPanel from './components/GetThisItemPanel';
	import SharePanel from './components/SharePanel';
	import CollectionsPanel from './components/CollectionsPanel';

	import WebsiteHeader from '~firebird-common/src/js/components/Header';

	import Emittery from 'emittery';
	const emitter = new Emittery();
	setContext('emitter', emitter);

	const manifest = new Manifest(HT.params);
	setContext('manifest', manifest);

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
			<Panel parent="#controls">
				<i class="fa-solid fa-download" slot="icon"></i>
				<svelte:fragment slot="title">Download</svelte:fragment>
				<svelte:fragment slot="body">
					<p>This is a download form.</p>
				</svelte:fragment>
			</Panel>
			<Panel parent="#controls" expanded={true}>
				<i class="fa-solid fa-magnifying-glass" slot="icon"></i>
				<svelte:fragment slot="title">Search in This Text</svelte:fragment>
				<svelte:fragment slot="body">
					<form>
						<div class="d-flex flex-nowrap gap-1">
							<div class="flex-grow-1">
								<input type="text" class="form-control" placeholder="..." />
							</div>
							<div class="d-flex flex-nowrap gap-1">
								<button class="btn btn-outline-secondary">
									<i class="fa-solid fa-magnifying-glass"></i>
								</button>
								<button class="btn btn-outline-secondary">
									<i class="fa-regular fa-circle-xmark"></i>
								</button>
							</div>
						</div>
					</form>
				</svelte:fragment>
			</Panel>
			<JumpToSectionPanel></JumpToSectionPanel>
			<GetThisItemPanel></GetThisItemPanel>
			<CollectionsPanel></CollectionsPanel>
			<SharePanel></SharePanel>
		</div>
		<VersionPanel></VersionPanel>
	</Pane>
	<Pane size={75} class="pane--reader">
		<ViewToolbar></ViewToolbar>
		<View></View>
	</Pane>
</Splitpanes>

<style>
</style>
