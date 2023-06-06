<script>
  import { getContext } from 'svelte';

  const manifest = getContext('manifest');
  const metadata = manifest.metadata;

</script>

{#if manifest.ui == 'crms'}
<dl>
  {#if metadata.author}
  <div>
    <dt>Creator</dt>
    <dd>{metadata.author}</dd>
  </div>
  {/if}
  {#if metadata.publisher}
  <div>
    <dt>Publisher</dt>
    <dd>{metadata.publisher}</dd>
  </div>
  {/if}
  {#if metadata.description}
    <dt>Description</dt>
    <dd>{metadata.description}</dd>
  {/if}
</dl>
{:else}
  <!-- RDFa wrappers -->
  <p class="visually-hidden">
    {#if metadata.format == 'BK' && metadata.author}
      <span 
        property="cc:attributionName" 
        rel="cc:attributionURL"
        href="https://hdl.handle.net/2027/{manifest.id}">{metadata.author}</span>
    {:else if metadata.format == 'SE' && metadata.publisher}
      <span 
        property="cc:attributionName" 
        rel="cc:attributionURL"
        href="https://hdl.handle.net/2027/{manifest.id}">{metadata.publisher}</span>
    {/if}
    {#if metadata.author}
      <span property="dc:creator" content="{metadata.author}" />
    {/if}
    {#if metadata.publisher}
      <span property="dc:publisher" content="{metadata.publisher}" />
    {/if}
    {#if metadata.description}
      <span property="dc:description" content="{metadata.description}" />
    {/if}
  </p>
{/if}

<style>

</style>