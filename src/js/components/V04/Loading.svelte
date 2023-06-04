<script>
  // do we really need this?
  export let show = false;
  let spin = true;
</script>

<div class="loading-reader" class:opacity-0={!show} class:opacity-100={show}>
  <i 
    class="fa-solid fa-stroopwafel fa-2xl opacity-75"
    class:fa-spin={spin}
    aria-hidden="true"></i>

</div>

<style>
  .loading-reader {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    width: 100%;

    /* position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    height: 100%;
    width: 100%; */

    backdrop-filter: blur(10px);
    background-color: rgb(238, 238, 238, 0.25);

    z-index: 1000;

    transition: opacity 0.125s linear;
  }
</style>