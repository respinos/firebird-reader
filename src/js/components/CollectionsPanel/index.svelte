<script>
  import { onMount, getContext } from 'svelte';

  import Panel from '../Panel';
  import CollectionEditModal from '~firebird-common/src/js/components/CollectionEditModal';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let inCollectionsList = manifest.inCollectionsList;
  let featuredCollectionsList = manifest.featuredCollectionsList;
  let collectionsList = manifest.collectionsList;

  let userIsAnonymous = HT.login_status.logged_in === false;

  let modal;
  let c;
  let cn; 
  let desc;
  let contributorName;
  let shared;

  function submitAction(params) {

  }

  function openModal() {
    cn = desc = contributorName = '';
    shared = 0;
    modal.show();
  }

  function addItem() {
    if(c == '__NEW__') {
      openModal();
      return;
    }
    alert(`ADDING TO ${c}`);
  }

</script>

<Panel parent="#controls">
  <i class="fa-solid fa-bookmark" slot="icon"></i>
  <slot:fragment slot="title">Collections</slot:fragment>
  <slot:fragment slot="body">
    <div class="alert alert-info">
      Log in to make your personal collections permanent.
    </div>
    {#if featuredCollectionsList.length}
      <div class="mb-3">
        <p>In these featured collections:</p>
        <ul>
          {#each featuredCollectionsList as item}
            <li><a href={item.link}>{item.label}</a></li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="mb-3">
      <label for="select-collid" class="form-label">Add this item to a collection:</label>
      <div class="d-flex gap-2 align-items-center">
        <select class="form-select" bind:value={c}>
          <option value="__NEW__">New collection...</option>
          {#each collectionsList as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>
        <button type="button" class="btn btn-outline-dark" on:click={addItem}>Add</button>
      </div>
    </div>
    {#if inCollectionsList}
      <div class="mb-3">
        <p>In your collections:</p>
        <ul>
          {#each inCollectionsList as item}
            <li><a href={item.link}>{item.label}</a></li>
          {/each}
        </ul>
      </div>
    {/if}
  </slot:fragment>
</Panel>
<CollectionEditModal 
  bind:this={modal} 
  {userIsAnonymous}
  {c}
  {cn}
  {desc}
  {contributorName}
  {shared}
  {submitAction} />
