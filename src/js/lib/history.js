let url; let searchParams;
export function updateHistory(options) {
  if ( ! url ) {
    url = new URL(location.href);
    searchParams = new URLSearchParams(url.searchParams);
  }

  Object.keys(options).forEach((param) => {
    searchParams.set(param, options[param]);
  })

  if ( searchParams.get('format') == 'image') {
    searchParams.delete('format');
  }

  url.search = searchParams.toString();

  let title = document.title;
  if ( options.seq ) {
    title = `#${options.seq} - ${document.documentElement.dataset.originalTitle}`;
  }

  window.history.replaceState(title, document.title, url.toString());
  document.title = title;
}