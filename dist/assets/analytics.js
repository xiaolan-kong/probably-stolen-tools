'use strict';
(() => {
  const page = document.currentScript.dataset.page;
  // Count production page loads only; never include URL, receipt token or form values.
  if (location.origin !== 'https://xiaolan-kong.github.io' || !['calculator','assembler','feedback','guides'].includes(page)) return;
  // Only an expiry timestamp is shared across tabs; admin credentials stay in memory.
  try { if (Number(localStorage.getItem('ps-tools-admin-pv-until')) > Date.now()) return; } catch {}
  feedbackRequest('/page-view', {method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'}, body:JSON.stringify({page})}).catch(() => {});
})();
