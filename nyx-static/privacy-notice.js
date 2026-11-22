// A first-visit informational notice. Acknowledgment is stored only in this browser.
(() => {
  const storageKey = 'cryalune-privacy-notice-v1';
  const dialog = document.getElementById('privacy-notice');
  const accept = document.getElementById('privacy-acknowledge');
  const close = document.getElementById('privacy-dismiss');
  if (!dialog || !accept || !close) return;

  const openPolicy = () => {
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
  };
  for (const id of ['privacy-open', 'privacy-footer']) {
    document.getElementById(id)?.addEventListener('click', openPolicy);
  }
  accept.addEventListener('click', () => {
    try { localStorage.setItem(storageKey, 'acknowledged'); } catch { /* Storage is optional. */ }
    dialog.close();
  });
  close.addEventListener('click', () => dialog.close());

  let acknowledged = false;
  try { acknowledged = localStorage.getItem(storageKey) === 'acknowledged'; }
  catch { /* Browsers that disable local storage can still read the notice. */ }
  if (!acknowledged) openPolicy();
})();
