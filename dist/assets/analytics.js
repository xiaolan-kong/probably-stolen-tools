'use strict';
(() => {
  const page = document.currentScript.dataset.page;
  // Count production page loads only; never include URL, receipt token or form values.
  if (location.origin !== 'https://xiaolan-kong.github.io' || !['calculator','feedback'].includes(page)) return;
  feedbackRequest('/page-view', {method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'}, body:JSON.stringify({page})}).catch(() => {});
})();
