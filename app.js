'use strict';
const catalog = window.DESIGN_CATALOG;
const $ = selector => document.querySelector(selector);
let statusTimer;
let state, currentIndex = 0, busy = true, dragStart = null;
let preferences = { color: null, fit: null, size: null };
const surface = $('#swipeSurface');
const picker = $('#productPicker');
const silhouettes = {
  pants: 'M24 8H76L85 94H57L50 42L43 94H15Z',
  hoodie: 'M35 24Q27 2 50 3Q73 2 65 24L80 31L96 68L79 76L69 54V94H31V54L21 76L4 68L20 31Z',
  tank: 'M29 7H40Q50 28 60 7H71L77 94H23Z',
  longsleeve: 'M33 13Q50 29 67 13L81 24L96 83L78 88L67 51V94H33V51L22 88L4 83L19 24Z',
  shirt: 'M33 13Q50 29 67 13L95 31L82 55L68 48V94H32V48L18 55L5 31Z',
};
function announce(message, error = false) {
  clearTimeout(statusTimer);
  $('#status').textContent = message;
  if (!error) statusTimer = setTimeout(() => { $('#status').textContent = ''; }, 6000);
  $('#status').classList.toggle('error', error);
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('button, select').forEach(el => { el.disabled = value; });
  surface.setAttribute('aria-busy', String(value));
}
function renderConcept() {
  const design = catalog[currentIndex];
  const color = window.MERCH_COLORS[preferences.color] || '#d8dbd3';
  $('#conceptShape').innerHTML = `<svg viewBox="0 0 100 100" width="54" height="58"><path d="${silhouettes[design.kind]}" fill="${color}" stroke="#777b73" stroke-width="1.5"/></svg>`;
  $('#conceptTitle').textContent = preferences.color ? `${preferences.color} · color concept` : 'Concept color preview';
  $('#conceptText').textContent = preferences.color ? 'A color direction for a future design.' : 'Choose a swatch to explore a color.';
}
function renderOptions() {
  const design = catalog[currentIndex];
  const container = $('#preferences');
  container.replaceChildren();
  for (const [key, values] of [['color', design.colors], ['fit', design.fits], ['size', design.sizes]]) {
    const field = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `${key[0].toUpperCase() + key.slice(1)} `;
    const selected = document.createElement('span');
    selected.textContent = preferences[key] || 'Not selected';
    legend.append(selected);
    const choices = document.createElement('div');
    choices.className = `choices ${key}`;
    for (const value of values) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'choice';
      button.setAttribute('aria-pressed', String(preferences[key] === value));
      button.setAttribute('aria-label', `${key}: ${value}`);
      if (key === 'color') {
        const swatch = document.createElement('span'); swatch.className = 'swatch';
        swatch.style.backgroundColor = window.MERCH_COLORS[value]; button.append(swatch);
      }
      button.append(document.createTextNode(value));
      button.addEventListener('click', () => {
        if (busy) return;
        preferences[key] = preferences[key] === value ? null : value;
        // Update in place to preserve keyboard focus while choosing options.
        legend.lastChild.textContent = preferences[key] || 'Not selected';
        [...choices.children].forEach((el, i) => el.setAttribute('aria-pressed', String(values[i] === preferences[key])));
        renderConcept();
      });
      choices.append(button);
    }
    field.append(legend, choices); container.append(field);
  }
  renderConcept();
}
function render() {
  const design = catalog[currentIndex];
  picker.value = design.id;
  $('#designName').textContent = design.name;
  $('#mockupImage').src = design.image;
  $('#mockupImage').alt = `${design.name}, original artwork`;
  $('#category').textContent = design.kind === 'pants' ? 'BOTTOMS' : 'TOPS';
  $('#cardPosition').textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${catalog.length} designs`;
  preferences = { color: null, fit: null, size: null };
  renderOptions();
}
async function vote(type) {
  if (busy || !['reject', 'like', 'love'].includes(type)) return;
  setBusy(true);
  const design = catalog[currentIndex];
  const nextIndex = (currentIndex + 1) % catalog.length;
  const selected = { ...preferences };
  try {
    state = await MerchStore.update(s => {
      s.votes.push({ id: crypto.randomUUID(), productId: design.id, type, preferences: selected,
        at: new Date().toISOString(), round: s.round + 1, source: 'prototype' });
      s.currentIndex = nextIndex;
      if (nextIndex === 0) s.round += 1;
    });
    $('#voteBadge').textContent = type;
    $('#voteBadge').className = `vote-badge show ${type}`;
    surface.classList.add(`voted-${type}`);
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240));
    currentIndex = nextIndex;
    surface.style.transform = '';
    surface.classList.remove('voted-reject', 'voted-like', 'voted-love');
    $('#voteBadge').className = 'vote-badge';
    render();
    announce(`${type[0].toUpperCase() + type.slice(1)} saved for ${design.name}${Object.values(selected).some(Boolean) ? ` · ${Object.values(selected).filter(Boolean).join(' / ')}` : ' · no preferences selected'}.`);
  } catch (error) {
    surface.style.transform = '';
    $('#voteBadge').className = 'vote-badge';
    announce(`Vote was not saved. ${error.message}`, true);
  } finally { setBusy(false); }
}
// Preserve the original direction and distance rules, including curved swipes.
function getSwipeIntent(dx, dy, threshold) {
  const x = Math.abs(dx), y = Math.abs(dy);
  if (dy < -threshold && y > x * 0.85) return 'love';
  if (dx > threshold && x > y * 0.75) return 'like';
  if (dx < -threshold && x > y * 0.75) return 'reject';
  return '';
}
function getSwipeResult() {
  const last = dragStart.points.at(-1);
  const direct = getSwipeIntent(last.x - dragStart.x, last.y - dragStart.y, 110);
  if (direct) return direct;
  const farthest = dragStart.points.reduce((max, point) => ({
    right: Math.max(max.right, point.x - dragStart.x), left: Math.min(max.left, point.x - dragStart.x),
    up: Math.min(max.up, point.y - dragStart.y),
  }), { right: 0, left: 0, up: 0 });
  const horizontal = Math.max(farthest.right, Math.abs(farthest.left));
  if (Math.abs(farthest.up) > 145 && Math.abs(farthest.up) > horizontal * 0.9) return 'love';
  if (farthest.right > 145 && farthest.right > Math.abs(farthest.left) * 1.25) return 'like';
  if (Math.abs(farthest.left) > 145 && Math.abs(farthest.left) > farthest.right * 1.25) return 'reject';
  return '';
}
surface.addEventListener('pointerdown', event => {
  if (busy || dragStart || !event.isPrimary || event.button !== 0) return;
  event.preventDefault(); surface.focus(); surface.setPointerCapture(event.pointerId);
  dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, points: [{ x: event.clientX, y: event.clientY }] };
  surface.classList.add('dragging');
});
surface.addEventListener('pointermove', event => {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  const dx = event.clientX - dragStart.x, dy = event.clientY - dragStart.y;
  dragStart.points.push({ x: event.clientX, y: event.clientY });
  surface.style.transform = `translate(${dx * 0.2}px, ${dy * 0.2}px) rotate(${dx / 50}deg)`;
  const intent = getSwipeIntent(dx, dy, 70);
  $('#voteBadge').textContent = intent;
  $('#voteBadge').className = `vote-badge ${intent ? `show ${intent}` : ''}`;
});
surface.addEventListener('pointerup', event => {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  dragStart.points.push({ x: event.clientX, y: event.clientY });
  const result = getSwipeResult();
  dragStart = null; surface.classList.remove('dragging');
  surface.style.transform = '';
  if (result) vote(result); else $('#voteBadge').className = 'vote-badge';
});
surface.addEventListener('pointercancel', () => { dragStart = null; surface.style.transform = ''; surface.classList.remove('dragging'); $('#voteBadge').className = 'vote-badge'; });
window.addEventListener('keydown', event => {
  if (dragStart || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button, select, input, textarea, a')) return;
  const type = { ArrowLeft: 'reject', ArrowRight: 'like', ArrowUp: 'love' }[event.key];
  if (type) { event.preventDefault(); vote(type); }
});
picker.addEventListener('change', () => {
  currentIndex = catalog.findIndex(d => d.id === picker.value); render();
});
document.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => vote(button.dataset.vote)));
catalog.forEach(design => { const option = document.createElement('option'); option.value = design.id; option.textContent = design.name; picker.append(option); });
window.merchVotingAdmin = {
  results: async () => MerchStore.summarize(await MerchStore.read(), catalog),
  resetVotes: async () => {
    if (!confirm('Reset prototype votes? Copied original records and production data will be kept.')) return;
    await MerchStore.reset(); currentIndex = 0; render(); announce('Prototype votes reset. Original records preserved.');
  },
};
MerchStore.read().then(saved => {
  state = saved; currentIndex = Math.max(0, saved.currentIndex % catalog.length); render(); setBusy(false);
}).catch(error => { render(); setBusy(true); announce(`Storage unavailable. Voting is disabled to avoid losing your votes. ${error.message}`, true); });
