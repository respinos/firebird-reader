<script>
  import { onMount, getContext } from 'svelte';

  const manifest = getContext('manifest');

  onMount(() => {
    // console.log("EHHHHH", context);
  })
</script>

<h1 class="p-3" style="font-size: 1.2rem">{manifest.metadata.title}</h1>
<div class="accordion-item">
  <h2 class="accordion-header">
    <span class="accordion-button fixed">
      <div class="d-flex align-items-center gap-2">
        <i class="fa-solid fa-circle-info"></i>
        About this Item
      </div>
    </span>
  </h2>
  <div>
    <div class="accordion-body">
      <ul class="list-unstyled mb-0">
        <li>{manifest.totalSeq} page scans</li>
        <li><a href="//catalog.hathitrust.org/Record/{manifest.metadata.catalogRecordNo}">Catalog Record</a></li>
        {#if manifest.hasOcr}
        <li><a href="/cgi/ssd?id={manifest.id}">Text-Only View</a></li>
        {/if}
        <li>
          <h3 class="fs-7 mb-1 mt-2">Rights</h3>
          <p class="fs-7">
            <a href="{manifest.rights.useLink}">{manifest.rights.head}.</a>
            {#if manifest.metadata.format == 'BK' && manifest.rights.useAuxLink}
              <a class="visually-hidden" href={manifest.rights.useAuxLink} rel="license"></a>
            {/if}
            {#if manifest.rights.useIcon || manifest.rights.useAuxLink || manifest.rights.useAuxIcon}
              <br /><br />
            {/if}
            {#if manifest.rights.useIcon}
              <a target="_blank" href={manifest.rights.useLink} aria-hidden="true">
                <img alt="" src={manifest.rights.useIcon} />
              </a>
            {/if}
            {#if manifest.rights.useAuxIcon}
              <a target="_blank" href={manifest.rights.useAuxLink} aria-hidden="true">
                <img alt="" src={manifest.rights.useAuxIcon} />
              </a>
            {/if}
          </p>
        </li>
      </ul>
    </div>
  </div>
</div>
