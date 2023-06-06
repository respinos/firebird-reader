let url; let searchParams;
export function updateHistory(options) {
  if ( ! url ) {
    url = new URL(location.href.replace(/;/g, '&'));
    searchParams = new URLSearchParams(url.searchParams);
  }

  Object.keys(options).forEach((param) => {
    searchParams.set(param, options[param]);
  })

  if ( searchParams.get('format') == 'image') {
    searchParams.delete('format');
  }

  let title = document.title;
  if ( options.seq ) {
    // remove any ownerid parameters
    searchParams.delete('ownerid');
    title = `#${options.seq} - ${document.documentElement.dataset.originalTitle}`;
  }

  url.search = searchParams.toString();

  window.history.replaceState(title, document.title, url.toString());
  document.title = title;
}