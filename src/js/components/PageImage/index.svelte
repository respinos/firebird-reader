<script>

  export let isLoaded = false;
  export let src;
  export let image;

</script>

<style>

  img {
    width: 100%;
    grid-area: 1/1;
  }

  .actual {
    opacity: 0;
    transition: opacity 1s;
  }

  .actual.loaded {
    opacity: 1.0;
  }

</style>

<img class="actual" alt="" class:loaded={isLoaded} src={src} bind:this={image} />
