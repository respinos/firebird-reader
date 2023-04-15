<script>
  import { Pane, Splitpanes } from 'svelte-splitpanes';
	import View from './components/ScrollView/index.svelte';
	import ViewToolbar from './components/ViewToolbar';
	import Panel from './components/Panel';
	import MetadataPanel from './components/MetadataPanel';
</script>

<Splitpanes vertical style="width: 100%">
	<Pane snapSize={14} maxSize={30} size={30} class="overflow-auto pb-5">
		<div class="accordion" id="controls">
			<MetadataPanel></MetadataPanel>
			<Panel parent="#controls">
				<svelte:fragment slot="title">Download</svelte:fragment>
				<svelte:fragment slot="body">
					<p>This is a download form.</p>
				</svelte:fragment>
			</Panel>
			<Panel parent="#controls" expanded={true}>
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
				<slot:fragment slot="title">Jump to Section</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<slot:fragment slot="title">Get This Item</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<slot:fragment slot="title">Lists</slot:fragment>
				<slot:fragment slot="body"></slot:fragment>
			</Panel>
			<Panel parent="#controls">
				<slot:fragment slot="title">Share</slot:fragment>
				<slot:fragment slot="body">
					<p><em>Anywhere but Twitter.</em></p>
				</slot:fragment>
			</Panel>
		</div>
	</Pane>
	<Pane size={75} class="pane--reader">
		<ViewToolbar></ViewToolbar>
		<View></View>
	</Pane>
</Splitpanes>

<style>
</style>
