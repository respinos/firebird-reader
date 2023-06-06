<script>
  import { getContext } from 'svelte';

  import Modal from '~firebird-common/src/js/components/Modal';
  import { messages } from '../../lib/messages';

  const manifest = getContext('manifest');

  export let code;
  export let seq;

  let show = manifest.messageList[seq] !== undefined;
  let modal;

  const showDetail = function(e) {
    modal.show(); 
  }

  const onClose = function() {
    delete manifest.messageList[seq];
    // show = false;
  }

  $: message = messages[code];
  $: guid = `div${seq}${code}`;

</script>

{#if show}
<div class="message w-100">
  <div class="alert alert-warning d-flex align-items-center flex-wrap justify-content-between gap-3 p-2 mx-4 fs-7">
    <span>{@html message.alert}</span>
    <button 
      class="btn btn-outline-dark btn-sm text-nowrap" 
      type="button"
      on:click|stopPropagation={showDetail}
      >More Information</button>
  </div>
  {#if message.detail}
  <Modal bind:this={modal} {onClose}>
    <!-- <svelte:fragment slot="title">{message.title}</svelte:fragment> -->
    <svelte:fragment slot="body">
      {@html message.detail}
    </svelte:fragment>
  </Modal>
  {/if}
</div>
{/if}

<style>
  .message {
    grid-row: 1/2;
    grid-column: 1/2;
    justify-self: center;
  }
</style>