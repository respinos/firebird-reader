<script>
  import { onMount, getContext } from 'svelte';
  
  import Panel from '../Panel';
  import SearchForm from '../SearchForm';

  const emitter = getContext('emitter');

  let start = 1;
  let sort = 'seq';
  let showHightlights = true;

  function onClick(event) {
    let seq = event.target.dataset.seq;
    console.log("onClick", event, event.target);
    emitter.emit('goto.page', { seq : seq });
  }

</script>

<Panel parent="#controls" expanded={true}>
  <i class="fa-solid fa-magnifying-glass" slot="icon"></i>
  <svelte:fragment slot="title">Search in This Text</svelte:fragment>
  <svelte:fragment slot="body">
    <SearchForm inPanel={true} {onClick}></SearchForm>
  </svelte:fragment>
</Panel>

<style>
</style>