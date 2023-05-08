// @ts-nocheck
import '../scss/styles.scss'

import { setupHTEnv } from '~firebird-common/src/js/lib/utils';
// Import all of Bootstrap's JS
// these are made available globally
import * as bootstrap from 'bootstrap';
window.bootstrap = bootstrap;

new bootstrap.Tooltip('body', { 
  selector: '[data-bs-toggle="tooltip"]',
  title: function() { return this.getAttribute('aria-label'); }
});

import App from './App.svelte'

const toCamel = (s) => {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
};

const buildProps = (el) => {
  let propProperty = `data-prop-`;
  let props = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith(propProperty)) {
      let value = attr.value;
      try {
        value = JSON.parse(value);
      } catch (error) {}

      props[toCamel(attr.name.replace(propProperty, ''))] = value;
    }
  }
  return props;
};

// configure the HT global
setupHTEnv();

let app;

HT.postPingCallback = function () {
  let el = document.getElementById('root');
  let props = buildProps(el);
  props.featureList = HT.params.featureList;
  props.sectionList = HT.params.sectionList;

  app = new App({
    target: document.getElementById('root'),
    props: props
  })
  setTimeout(() => {
    document.body.dataset.initialized = true;
  });
};

let script = document.createElement('script');
script.async = true;
script.src = `//${
  HT.service_domain
}/cgi/ping?callback=HT.postPingCallback&_${new Date().getTime()}`;
document.head.appendChild(script);

console.log("AHOY WUT");
export default app
