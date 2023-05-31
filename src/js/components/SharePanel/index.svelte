<script>
  import { onMount, getContext } from 'svelte';
  import { tooltip } from '../../lib/tooltip';

  import Panel from '../Panel';
  import Modal from '~firebird-common/src/js/components/Modal';

  const emitter = getContext('emitter');
  const manifest = getContext('manifest');

  let shareHandle;
  let btnShareHandle;
  let shareHandleLink;
  let btnShareHandleLink;
  let btnCodeBlock;
  let modal;
  let modalBody;

  // initial seq
  let currentSeq = manifest.currentSeq;
  
  // function updateSeq(data) {
  //   if ( data ) { seq = data; }
  // }
  // emitter.on('update.seq', updateSeq);

  let codeBlock;
  let view = '1up';
  let codeBlockText = {};
  codeBlockText['1up'] = `<iframe width="450" heigh="700" src="https://hdl.handle.net/2027/${manifest.id}?urlappend=%3Bui=embed"></iframe>`;
  codeBlockText['2up'] = `<iframe width="700" heigh="450" src="https://hdl.handle.net/2027/${manifest.id}?urlappend=%3Bui=embed"></iframe>`;

  function getLabel(el) {
    return this.getAttribute('aria-label');
  }

  function copySelection(trigger, el) {
    el.select();
    document.execCommand('copy');
    let tooltip = bootstrap.Tooltip.getInstance(trigger);
    tooltip.setContent({ '.tooltip-inner': 'Copied' });
  }

  onMount(() => {
    // btnShareHandle.bs = new bootstrap.Tooltip(btnShareHandle, { title: getLabel });
    // btnShareHandleLink.bs = new bootstrap.Tooltip(btnShareHandleLink, { title: getLabel });
    // btnCodeBlock.bs = new bootstrap.Tooltip(btnCodeBlock, { title: getLabel, container: modalBody });

    [ btnShareHandle, btnShareHandleLink, btnCodeBlock ].forEach((el) => {
      el.addEventListener('hidden.bs.tooltip', () => {
        let tooltip = bootstrap.Tooltip.getInstance(el);
        tooltip.setContent({ '.tooltip-inner': el.getAttribute('aria-label') });
      })
    })

    return () => {
      // emitter.off('update.seq', updateSeq);
    }
  })

</script>

<Panel parent="#controls">
  <i class="fa-solid fa-share-nodes" slot="icon"></i>
  <slot:fragment slot="title">Share</slot:fragment>
  <slot:fragment slot="body">
    <div class="mb-3">
      <label for="share-handle" class="form-label">Permanent link to this item</label>
      <div class="d-flex align-items-center gap-1">
        <input 
          id="share-handle" 
          type="text" 
          class="form-control" 
          readonly 
          value="https://hdl.handle.net/2027/{manifest.id}"
          bind:this={shareHandle}
          on:click={() => shareHandle.select()} />
        <button 
          class="btn btn-outline-dark" 
          aria-label="Copy permanent link"
          data-bs-placement="right"
          use:tooltip
          bind:this={btnShareHandle}
          on:click={() => copySelection(btnShareHandle, shareHandle)}>
          <i class="fa-solid fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="mb-3">
      <label for="share-handle-seq" class="form-label">Link to this page scan</label>
      <div class="d-flex align-items-center gap-1">
        <input 
          id="share-handle-seq" 
          type="text" 
          class="form-control" 
          readonly 
          value="https://hdl.handle.net/2027/{manifest.id}?urlappend=%3Bseq={$currentSeq}"
          bind:this={shareHandleLink}
          on:click={() => shareHandleLink.select()} />
        <button 
          class="btn btn-outline-dark" 
          aria-label="Copy link to this page scan"
          data-bs-placement="right"
          use:tooltip
          bind:this={btnShareHandleLink}
          on:click={() => copySelection(btnShareHandleLink, shareHandleLink)}>
          <i class="fa-solid fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div>
      <button type="button" class="btn btn-outline-dark" on:click={() => modal.show()}>Embed this item</button>
    </div>
  </slot:fragment>
</Panel>
<Modal bind:this={modal}>
  <svelte:fragment slot="title">Embed this item</svelte:fragment>
  <svelte:fragment slot="body">
    <div class="mb-3" bind:this={modalBody}>
      <p id="embed-help-info">
        Copy the code below and paste it into the HTML of any website or blog.
      </p>
      <label for="embed-codeblock" class="visually-hidden">Code Block</label>
      <div class="d-flex align-items-start gap-2">
        <textarea 
          class="form-control" 
          id="embed-codeblock" 
          aria-describedby="embed-help-info" 
          rows="3"
          bind:this={codeBlock}
          bind:value={codeBlockText[view]}
          on:click={() => codeBlock.select()}></textarea>
        <button 
          class="btn btn-outline-dark" 
          aria-label="Copy iframe code"
          use:tooltip
          bind:this={btnCodeBlock}
          on:click={() => copySelection(codeBlock)}>
          <i class="fa-solid fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input id="embed-view-1up" class="form-check-input" type="radio" value="1up" bind:group={view} />
        <label class="form-check-label" for="embed-view-1up">
          <i class="fa-solid fa-up-down" aria-hidden="true"></i>
          Scroll View
        </label>
      </div>
      <div class="form-check form-check-inline">
        <input id="embed-view-2up" class="form-check-input" type="radio" value="2up" bind:group={view} />
        <label class="form-check-label" for="embed-view-2up">
          <i class="fa-solid fa-book-open" aria-hidden="true"></i>
          Flip View
        </label>
      </div>
    </div>
    <p>
      <a href="https://www.hathitrust.org/embed">More information</a>
    </p>
  </svelte:fragment>
</Modal>

<style>
  .alert:empty {
    display: none;
  }
</style>