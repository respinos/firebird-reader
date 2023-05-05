<script>

  import { onMount } from 'svelte';

  export let page_coords = [];
  export let matches = [];
  export let image;

  let highlights = [];

  const buildHighlights = function() {

    function parseCoords(value) {
      var values = value.split(' ')
      return values.map((v) => parseInt(v, 10));
    }

    var timestamp = (new Date).getTime();

    var scaling = {};
    if ( image.hasAttribute('width') ) {
      scaling.width = parseInt(image.getAttribute('width'), 10); 
      scaling.height = parseInt(image.getAttribute('height'), 10);
    } else {
      scaling.width = image.width;
      scaling.height = image.height;
    }

    scaling.width = image.offsetWidth;
    scaling.height = image.offsetHeight;

    scaling.ratio = scaling.width / page_coords[2];
    scaling.ratioY = scaling.height / page_coords[3];
    scaling.padding = 0; // parseInt(window.getComputedStyle(page).marginTop) / 2;
    scaling.ratioZ = 1.0;
    scaling.ratio *= scaling.ratioZ;

    function textNodesUnder(el){
      var n, a=[], walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false);
      while(n=walk.nextNode()) a.push(n);
      return a;
    }

    for(let i = 0; i < matches.length; i++) {

      // var span = text.parentNode;
      var span = matches[i];

      if ( true ) {
        var coords = parseCoords(span.dataset.coords);
        coords[0] *= scaling.ratio;
        coords[2] *= scaling.ratio;
        coords[1] *= scaling.ratio;
        coords[3] *= scaling.ratio;

        var highlight_w0 = ( coords[2] - coords[0] );
        var highlight_h0 = ( coords[3] - coords[1] );
        var highlight_w = highlight_w0 * 1.25;
        var highlight_h = highlight_h0 * 1.25;

        var highlight = {};
        highlight.word = span.dataset.innerHTML;
        highlight.timestamp = timestamp;
        // highlight.top = coords[1];
        highlight.padding = scaling.padding;
        highlight.width = `${highlight_w / scaling.width * 100.0}%`;
        highlight.height = `${highlight_h / scaling.height * 100.0}%`;
        highlight.top = `${( coords[1] - ( ( highlight_h - highlight_h0 ) / 2 ) ) / scaling.height * 100.0}%`;
        highlight.left = `${( coords[0] - ( ( highlight_w - highlight_w0 ) / 2 ) ) / scaling.width * 100.0}%`;

        // var highlight = document.createElement('mark');
        // highlight.classList.add('highlight');
        // // highlight.classList.add(`highlight_${highlight_idx}`);
        // highlight.dataset.word = innerHTML;
        // highlight.dataset.timestamp = timestamp;

        // highlight.dataset.top = coords[1];
        // highlight.dataset.padding = scaling.padding;

        // highlight.style.width = `${highlight_w / scaling.width * 100.0}%`;
        // highlight.style.height = `${highlight_h / scaling.height * 100.0}%`;
        // highlight.style.top = `${( coords[1] - ( ( highlight_h - highlight_h0 ) / 2 ) ) / scaling.height * 100.0}%`;
        // highlight.style.left = `${( coords[0] - ( ( highlight_w - highlight_w0 ) / 2 ) ) / scaling.width * 100.0}%`;

        // if ( self.name == '2up' ) {
        //   var prefix = page.classList.contains('recto') ? -1 : 1;
        //   highlight.style.left = `${( coords[0] - ( ( highlight_w - highlight_w0 ) / 2 ) ) / image_frame.offsetWidth * 100.0}%`;
        // }

        // scan.appendChild(highlight);
        highlights.push(highlight);

      } else {
        // span.classList.add('highlight--plaintext', `highlight_${highlight_idx}`);
        const mark = document.createElement('mark');
        mark.innerText = span.innerText;
        mark.setAttribute('class', span.getAttribute('class'));
        mark.dataset.class = mark.getAttribute('class');
        mark.classList.add('highlight--plaintext', `highlight_${highlight_idx}`);
        mark.dataset.coords = span.dataset.coords;
        span.parentElement.replaceChild(mark, span);
      }
    }

    highlights = highlights
  }

  $: if (matches && matches.length) { console.log("AHOY building matches"); buildHighlights() }

</script>

<style>

  :global(mark.highlight) {
    position: absolute;
    background: greenyellow;
    opacity: 0.2;
  }

</style>

{#each highlights as highlight}
  <mark class="highlight"
        data-word={highlight.word} 
        style:width={highlight.width}
        style:height={highlight.height}
        style:top={highlight.top}
        style:left={highlight.left}></mark>
{/each}

