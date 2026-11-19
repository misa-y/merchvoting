// The public-preview build switches this flag; local prototype behavior stays unchanged.
window.MERCH_PUBLIC_DEMO = false;
if (window.MERCH_PUBLIC_DEMO) {
  document.documentElement.classList.add('public-demo');
  document.querySelectorAll('[data-public-preview]').forEach(el => { el.hidden = false; });
}
