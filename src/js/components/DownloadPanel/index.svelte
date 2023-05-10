<script>
  import { onMount, getContext } from 'svelte';
	import { writable } from 'svelte/store';

  import Panel from '../Panel';
  import Modal from '~firebird-common/src/js/components/Modal';

  const manifest = getContext('manifest');
  const emitter = getContext('emitter');

  const updateSeq = function(data) {
    if ( data ) { currentSeq = data; }
  }

  emitter.on('update.seq', updateSeq);

  let currentView = manifest.currentView;
  let currentSeq = manifest.currentSeq;
  let format = 'pdf';
  let range = manifest.allowFullDownload ? 'volume' : 'current-page';
  
  let modal;
  let tunnelFrame;
  let tunnelWindow;
  let tunnelForm;
  let tunnelFormAttempt = 0;
  let downloadInProgress = false;
  let trackerInterval;
  let progressUrl, downloadUrl, totalPages;
  let lastPercent;
  let status = { done: false, percent: -1 };
  let numAttempts = 0;
  let numProcessed = 0;

  let targetPPI = '300';
  let sizeValue = ''
  let sizeAttr;

  let HT = globalThis.HT;

  let allowDownload = manifest.allowSinglePageDownload || manifest.allowFullDownload;

  function callback(argv) {
    if(downloadInProgress) {
      [progressUrl, downloadUrl, totalPages] = argv;
      if (trackerInterval) {
        console.log("download: already polling");
        return;
      }

      trackerInterval = setInterval(checkStatusInterval, 2500);
      checkStatusInterval();
      modal.show();
    } else {
      clearInterval(trackerInterval); trackerInterval = null;
      modal.hide();
    }
  }

  function checkStatusInterval() {
    fetch(progressUrl, { include: 'credentials' })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        numProcessed += 1;
        updateProgress(data);
        if ( status.done ) {
          clearInterval(trackerInterval); trackerInterval = null;
        }
        // error handling
      })
  }

  function updateProgress(data) {
    let percent;
    let current = data.status;
    if ( current == 'EOT' || current == 'DONE' ) {
      status.done = true;
      percent = 100;
      downloadInProgress = false;
    } else {
      current = data.current_page;
      percent = 100 * ( current / totalPages );
    }

    if ( lastPercent != percent ) {
      lastPercent = percent;
      numAttempts = 0;
    } else {
      numAttempts += 1;
    }

    if ( numAttempts > 100 ) {
      status.error = true;
    }

    status.percent = percent;
    status = status;
  }

  function trackInterval() {
    let tracker = `D${tunnelFormAttempt}`;
    let value = HT.cookieJar.getItem('tracker');
    if ( value.indexOf(tracker) > -1 ) {
      HT.cookieJar.removeItem('tracker', { path: '/'});
      downloadInProgress = false;
      clearInterval(trackerInterval);
      trackerInterval = null;
    }
  }

  function finalizeDownload() {
    location.href = downloadUrl;
    setTimeout(() => {
      modal.hide();
    }, 1500);
  }

  function cancelDownload() {
    let cancelUrl = new URL(`${location.protocol}//${HT.service_domain}${action}`);
    let params = new URLSearchParams();
    params.set('id', manifest.id);
    params.set('callback', 'callback');
    params.set('stop', '1');
    params.set('_', (new Date).getTime());
    cancelUrl.search = params.toString();

    let scriptEl = tunnelWindow.document.createElement('script');
    scriptEl.type = 'module';
    scriptEl.src = cancelUrl.toString();
    downloadInProgress = false;
    tunnelWindow.document.body.appendChild(scriptEl);
  }

  function submitDownload() {
    // blah blah is this a short form or not
    numAttempts = 0;
    numProcessed = 0;

    let selection = { pages: [] };
    if ( range == 'selected-pages' ) {
      selection.pages = [ 1, 10, 15 ];
      selection.isSelection = true;
      if (select.pages.legnth == 0) {
        return;
      }
    } else if ( range.startsWith('current-page') ) {
      let page;
      switch(range) {
        case 'current-page':
          page = currentSeq;
          break;
        case 'current-page-verso':
          page = currentSeq;
          break;
        case 'current-page-recto':
          page = currentSeq;
          break;
      }
      if ( ! page ) {
        // possibly impossible
      }
      selection.pages = [ page ];
    }

    if ( selection.pages.length > 0 ) {
      selection.seq = selection.pages;
    }

    let partialUpperLimit = format == 'image-tiff' ? 1 : 10;
    if ( isPartialDownload() && selection.pages.length <= partialUpperLimit ) {
      // use the tunnel
      tunnelFormAttempt = tunnelFormAttempt + 1;
      downloadInProgress = true;
      
      setInterval(trackInterval, 100);
      tunnelForm.submit();

    } else {

      // start the download in the iframe
      let scriptEl = tunnelWindow.document.createElement('script');
      scriptEl.type = 'module';

      let requestUrl = new URL(`${location.protocol}//${HT.service_domain}${action}`);
      let params = new URLSearchParams();
      params.set('id', manifest.id);

      if ( selection.seq ) {
        selection.seq.forEach((_seq) => {
          params.append('seq', _seq);
        });
      }
      switch (format) {
        case 'image-jpeg':
        case 'image-tiff':
          params.seq('format', format == 'image-tiff' ? 'image/tiff' : 'image/jpeg');
          params.set('target_ppi', targetPPI);
          params.set('bundle_format', 'zip');
          break;
        case 'plaintext-zip':
          params.set('bundle_format', 'zip');
          break;
        case 'plaintext':
          params.set('bundle_format', 'text');
          break;
      }
      params.set('callback', 'callback');
      params.set('_', (new Date).getTime());
      
      requestUrl.search = params.toString();
      console.log("AHOY DOWNLOADING", requestUrl.toString());
      scriptEl.src = requestUrl.toString();

      downloadInProgress = true;
      tunnelWindow.document.body.appendChild(scriptEl);
    }
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

  function isPartialDownload() {
    return ( range == 'selected-pages' || range == 'current-page' );
  }


  $: action = buildAction(format);
  $: iframeName = `download-module-${tunnelFormAttempt}`;
  $: if ( ( format == 'plaintext-zip' || format == 'epub' ) && range != 'volume' ) { range = 'volume'; }

  onMount(() => {
    // this will be the log tracking
    tunnelWindow = tunnelFrame.contentWindow;

    // assign global callback
    tunnelWindow.callback = function() {
      callback(arguments);
    };

    return () => {
      emitter.off('update.seq', updateSeq);
    }
  })

</script>

<Panel parent="#controls">
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
        {#if $currentView == '1up'}
        <div class="form-check">
          <input name="range" 
            class="form-check-input" 
            type="radio" 
            value="current-page" 
            id="range-current-page" 
            disabled={format == 'epub' || format == 'plaintext-zip'}
            bind:group={range}>
          <label class="form-check-label" for="range-current-page">
            Current page scan (#{currentSeq})
          </label>
        </div>
        {:else if $currentView == '2up'}
        <div class="form-check">
          <input name="range" 
            class="form-check-input" 
            type="radio" 
            value="current-page" 
            id="range-current-verso-page" 
            disabled={format == 'epub' || format == 'plaintext-zip'}
            bind:group={range}>
          <label class="form-check-label" for="range-current-verso-page">
            Current verso page scan (#{currentSeq})
          </label>
        </div>
        <div class="form-check">
          <input name="range" 
            class="form-check-input" 
            type="radio" 
            value="current-page" 
            id="range-current-recto-page" 
            disabled={format == 'epub' || format == 'plaintext-zip'}
            bind:group={range}>
          <label class="form-check-label" for="range-current-recto-page">
            Current recto page scan (#{currentSeq+1})
          </label>
        </div>
        {/if}
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
          on:click|preventDefault={submitDownload}>
          Download
        {#if downloadInProgress}
          <span
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <span class="visually-hidden">Loading...</span>
        {/if}
        </button>
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
      <input type="hidden" name="seq" value={currentSeq} />
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
    <iframe 
      bind:this={tunnelFrame}
      class="visually-hidden" 
      style:opacity={0} 
      aria-hidden="true" 
      title="Tunnel Download Tracker" 
      name="download-module-{tunnelFormAttempt}"></iframe>
  </svelte:fragment>
</Panel>
<Modal bind:this={modal}>
  <svelte:fragment slot="modal-title">
    Download {format}
  </svelte:fragment>
  <svelte:fragment slot="modal-body">
    <div style="width: 30rem">
      {#if status.percent < 100}
      <p>Please wait while we build your {format}.</p>
      <div class="progress">
        <div 
          class="progress-bar progress-bar-striped progress-bar-animated" 
          role="progressbar" 
          aria-label="Download Progress" 
          aria-valuenow={status.percent} 
          aria-valuemin="0" 
          aria-valuemax="100" 
          style:width={`${status.percent}%`}></div>
      </div>
      {:else}
      <p>All done! Your {format} is ready for download.</p>
      {/if}
    </div>
  </svelte:fragment>
  <svelte:fragment slot="modal-footer">
    <div class="d-flex gap-1 align-items-center justify-content-end">
      <button type="button" class="btn btn-secondary" on:click={cancelDownload}>Cancel</button>
      <!-- <button 
        type="button" 
        class="btn btn-primary"
        disabled={downloadInProgress}
        on:click={finalizeDownload}>Download</button> -->
      <a
        class="btn btn-primary"
        role={downloadInProgress ? 'link' : undefined}
        disabled={downloadInProgress}
        on:click={() => modal.hide()}
        href={downloadUrl}>Download</a>
    </div>
  </svelte:fragment>
</Modal>

<style>

</style>