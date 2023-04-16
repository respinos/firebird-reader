<script>
  export let parent;
  export let expanded = false;

  let id = `${(new Date).getTime()}-${Math.ceil(Math.random() * 1000)}`;
</script>

<div class="accordion-item">
  <h2 class="accordion-header" id="h{id}">
    <button class="accordion-button" class:collapsed={!expanded} type="button" data-bs-toggle="collapse" data-bs-target="#c{id}" aria-expanded={expanded} aria-controls="c{id}">
      <div class="d-flex gap-2 align-items-center">
        <slot name="icon"></slot>
        <slot name="title"></slot>
      </div>
    </button>
  </h2>
  <div id="c{id}" class="accordion-collapse collapse" class:show={expanded} aria-labelledby="h{id}" data-bs-parent="{parent}">
    <div class="accordion-body">
      <slot name="body"></slot>
    </div>
  </div>
</div>

<style>
  .accordion-button {
    font-weight: bold;
  }
</style>