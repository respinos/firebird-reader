<script>
  import { getContext } from 'svelte';

  import Panel from '../Panel';
  import Modal from '~firebird-common/src/js/components/Modal';

  const manifest = getContext('manifest');
  const emitter = getContext('emitter');

  let format = 'pdf';
  let range = manifest.allowFullDownload ? 'volume' : 'current-page';
  
  let tunnelForm;
  let tunnelFormAttempt = 0;
  let downloadInProgress = false;
  let trackerInterval;

  let targetPPI = '300';
  let sizeValue = ''
  let sizeAttr;

  let seq = manifest.currentSeq;

  let allowDownload = manifest.allowSinglePageDownload || manifest.allowFullDownload;

  function trackInterval() {
    let tracker = `D${tunnelFormAttempt}`;
    let value = HT.cookieJar.getItem('tracker');
    if ( value.indexOf(tracker) > -1 ) {
      HT.cookieJar.removeItem('tracker', { path: '/'});
      downloadInProgress = false;
      clearInterval(trackerInterval);
    }
  }

  function submitDownload() {
    // blah blah is this a short form or not
    // open the modal
    // return

    tunnelFormAttempt = tunnelFormAttempt + 1;
    downloadInProgress = true;
    
    setInterval(trackInterval, 100);
    
    tunnelForm.submit();
  }

  function buildAction(format) {
    let action = '/cgi/imgsrv/';
    if ( format.startsWith('image-') ) {
      action += 'image';
      sizeAttr = 'size';
      sizeValue = targetPPI == '0' ? 'full' : `ppi:${targetPPI}`
    } else {
      sizeAttr = 'target_ppi';
      sizeValue = targetPPI;
      action += 'download/' + (format.split('-'))[0];
    }
    return action;
  }


  $: action = buildAction(format);
  $: iframeName = `download-module-${tunnelFormAttempt}`;
  $: if ( ( format == 'plaintext-zip' || format == 'epub' ) && range != 'volume' ) { range = 'volume'; }

</script>

<Panel parent="#controls" expanded={true}>
  <i class="fa-solid fa-download" slot="icon"></i>
  <svelte:fragment slot="title">Download</svelte:fragment>
  <svelte:fragment slot="body">
    {#if allowDownload}
    <form>
      <fieldset class="mb-3">
        <legend class="fs-5">Format</legend>
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="pdf" id="format-pdf" bind:group={format}>
          <label class="form-check-label" for="format-pdf">
            Ebook (PDF)
          </label>
        </div>
        {#if manifest.allowFullDownload}
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="epub" id="format-epub" bind:group={format}>
          <label class="form-check-label" for="format-epub">
            Ebook (EPUB)
          </label>
        </div>
        {/if}
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="plaintext" id="format-plaintext" bind:group={format}>
          <label class="form-check-label" for="format-plaintext">
            Text (.txt)
          </label>
        </div>        
        {#if manifest.allowFullDownload}
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="plaintext-zip" id="format-archive" bind:group={format}>
          <label class="form-check-label" for="format-archive">
            Text (.zip)
          </label>
        </div>
        {/if}
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="image-jpeg" id="format-image-jpeg" bind:group={format}>
          <label class="form-check-label" for="format-image-jpeg">
            Image (JPEG)
          </label>
        </div>        
        <div class="form-check">
          <input name="format" class="form-check-input" type="radio" value="image-tiff" id="format-image-tiff" bind:group={format}>
          <label class="form-check-label" for="format-image-tiff">
            Image (TIFF)
          </label>
        </div>        
      </fieldset>

      {#if format.startsWith('image-')}
      <fieldset class="mb-3">
        <legend class="fs-5">Image Resolution</legend>
        <div class="form-check">
          <input name="target-ppi" class="form-check-input" type="radio" value="300" id="image-target-ppi-300" bind:group={targetPPI}>
          <label class="form-check-label" for="image-target-ppi-300">
            High / 300 dpi
          </label>
        </div>        
        <div class="form-check">
          <input name="target-ppi" class="form-check-input" type="radio" value="0" id="image-target-ppi-full" bind:group={targetPPI}>
          <label class="form-check-label" for="image-target-ppi-full">
            Full / 600 dpi
          </label>
        </div>        
      </fieldset>
      {/if}

      <fieldset class="mb-3">
        <legend class="fs-5">Range</legend>
        <div class="form-check">
          <input name="range" 
            class="form-check-input" 
            type="radio" 
            value="current-page" 
            id="range-current-page" 
            disabled={format == 'epub' || format == 'plaintext-zip'}
            bind:group={range}>
          <label class="form-check-label" for="range-current-page">
            Current page scan
          </label>
        </div>
        {#if manifest.allowFullDownload}
        <div class="form-check">
          <input name="range"  class="form-check-input" type="radio" value="volume" id="range-download-volume" bind:group={range}>
          <label class="form-check-label" for="range-download-volume">
            Whole item
          </label>
        </div>
        <div class="form-check">
          <input 
            name="range" 
            class="form-check-input" 
            type="radio" 
            value="selected-pages" 
            id="range-selected-pages" 
            disabled={format == 'epub' || format == 'plaintext-zip'}
            bind:group={range}>
          <label class="form-check-label" for="range-selected-pages">
            Selected page scans
          </label>
        </div>
        {/if}
      </fieldset>

      <p class="mb-3">
        <button 
          type="button" 
          class="btn btn-outline-dark" 
          disabled={downloadInProgress}
          on:click|preventDefault={submitDownload}>Download</button>
      </p>

      <p class="fs-7 mb-1">
        <a class="fs-7" target="_blank" href="https://www.hathitrust.org/help_digital_library#downloadhelp">Download Help</a>
      </p>
      {#if ! manifest.allowFullDownload && ! HT.login_status.logged_in}
      <p class="fs-7 mt-1 mb-1">
        Partner institution members: <strong>Log in</strong> to download this item.
      </p>
      <p class="fs-7 mt-1 fst-italic">
        If you are not a member of a partner institution, whole book download is not available. 
        (<a targt="_blank" href="https://www.hathitrust.org/help_digital_library#Download">Why not?</a>)
      </p>
      {/if}
    </form>
    {/if}
    <form class="d-none" bind:this={tunnelForm} method="GET" action="{action}" target="download-module-{tunnelFormAttempt}">
      <input type="hidden" name="id" value={manifest.id} />
      <input type="hidden" name="attachment" value="1" />
      <input type="hidden" name="tracker" value="D{tunnelFormAttempt}" />
      <input type="hidden" name="seq" value={seq} />
      {#if format == 'image-tiff' || format == 'image-jpeg'}
        <input type="hidden" name="format" value="image/{(format.split('-'))[1]}" />
        <input 
          type="hidden" 
          name={sizeAttr} 
          value={sizeValue} />
      {:else if format == 'plaintext-zip'}
        <!-- do something else -->
      {/if}
    </form>
    <iframe class="visually-hidden" style:opacity={0} aria-hidden="true" title="Tunnel Download Tracker" name="download-module-{tunnelFormAttempt}"></iframe>
  </svelte:fragment>
</Panel>

<style>

</style>