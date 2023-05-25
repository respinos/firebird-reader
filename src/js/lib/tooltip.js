import { Tooltip } from 'bootstrap';

export function tooltip(node) {

  node.bs = new Tooltip(
    node,
    { title: function() { return this.getAttribute('aria-label'); } }
  );

  const hide = function() { node.bs.hide(); }

  node.addEventListener('click', hide, { once: false });
  node.addEventListener('mouseleave', hide, { once: false });

  return { 
    destroy() {
      node.bs.dispose();
      node.removeEventListener('mouseleave', hide);
      node.removeEventListener('click', hide);
    }
  }
}