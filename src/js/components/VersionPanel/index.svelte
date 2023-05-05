<script>
  import { onMount, getContext } from 'svelte';

  const context = getContext('context');
  const manifest = getContext('manifest');

  let button;
  let popover;
  let popoverContent = `This is the date when this item was last updated. 
  Version dates are updated when improvements such as 
  higher quality scans or more complete scans have been made.`;

  let ownerId;

  onMount(() => {
    popover = new bootstrap.Popover(button);
    return () => {
      popover.dispose();
    }
  })
  
</script>

{#if manifest.versionLabel}
<div class="alert alert-light mt-4" role="alert">
  <h3 class="fs-7">Version</h3>
  <p class="fs-7">
    <span>{manifest.versionLabel}</span>
    {#if ownerId}
      <span>{ownerId}</span>
    {/if}
    <br />
    <button 
      bind:this={button}
      type="button" 
      class="btn btn-sm btn-outline-dark mt-2" 
      data-bs-toggle="popover" 
      data-bs-title="About the version" 
      data-bs-content="{popoverContent}">About the version</button>
  </p>
</div>
{/if}