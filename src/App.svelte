<script>
  import { onMount, setContext } from 'svelte';

	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import View from './components/ScrollView/index.svelte';
	import ViewToolbar from './components/ViewToolbar';
	import Panel from './components/Panel';
	import MetadataPanel from './components/MetadataPanel';

	import Emittery from 'emittery';
	const emitter = new Emittery();
	setContext('emitter', emitter);

	// onMount(() => {
	// 	const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
	// 	const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
	// })
</script>

<Splitpanes vertical style="width: 100%">
	<Pane snapSize={14} maxSize={30} size={30} class="overflow-auto pb-5 pt-3 bg-white">
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
						<div class="d-flex flex-nowrap  gap-1">
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
			<Panel parent="#controls">
				<i class="fa-solid fa-bars" slot="icon"></i>
				<slot:fragment slot="title">Jump to Section</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<i class="fa-solid fa-book" slot="icon"></i>
				<slot:fragment slot="title">Get This Item</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<i class="fa-solid fa-bookmark" slot="icon"></i>
				<slot:fragment slot="title">Lists</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<i class="fa-solid fa-share-nodes" slot="icon"></i>
				<slot:fragment slot="title">Share</slot:fragment>
				<slot:fragment slot="body">
					<p><em>Anywhere but Twitter.</em></p>
				</slot:fragment>
			</Panel>
		</div>
		<div class="alert alert-light mt-4" role="alert">
			<h3 class="fs-7">Version</h3>
			<p class="fs-7">
				<span>2019-03-27 08:10 UTC</span>
				<br />
				<button type="button" class="btn btn-sm btn-outline-dark" data-bs-toggle="popover" data-bs-title="About the version" data-bs-content="#version-information">About the version</button>
			</p>
			<div hidden id="version-information">
				<p>Does this actually work?</p>
			</div>
		</div>
	</Pane>
	<Pane size={75} class="pane--reader">
		<ViewToolbar></ViewToolbar>
		<View></View>
	</Pane>
</Splitpanes>

<style>
</style>
