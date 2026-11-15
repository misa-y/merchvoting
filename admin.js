'use strict';
const catalog = window.DESIGN_CATALOG;
const $ = selector => document.querySelector(selector);
let statusTimer;
let state, demo = false, selectedId = catalog.find(d => d.kind === 'hoodie').id;
function announce(message, error = false) { clearTimeout(statusTimer); $('#status').textContent = message; $('#status').classList.toggle('error', error); if (!error) statusTimer = setTimeout(() => { $('#status').textContent = ''; }, 6000); }
function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function entries(counts) { return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
function percent(n, total) { return total ? `${Math.round(n / total * 100)}%` : '—'; }
function renderBars(target, counts, options = []) {
  const container = $(target); container.replaceChildren();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) { container.append(node('p', 'empty-chart', 'No positive votes with this preference yet.')); return; }
  const sorted = target === '#sizeChart' ? options.map(name => [name, counts[name] || 0]) : entries(counts);
  for (const [name, count] of sorted) {
    const row = node('div', 'bar-row');
    const label = node('div', 'bar-label');
    const nameEl = node('span', '', name);
    if (target === '#colorChart') { const dot = node('i', 'color-dot'); dot.style.backgroundColor = window.MERCH_COLORS[name] || '#888'; nameEl.prepend(dot); }
    label.append(nameEl, node('span', '', `${count} · ${percent(count, total)}`));
    const track = node('div', 'bar-track'); const fill = node('div', 'bar-fill'); fill.style.width = `${count / total * 100}%`;
    track.append(fill); row.append(label, track); container.append(row);
  }
}
function renderDetails(rows) {
  const product = rows.find(d => d.id === selectedId) || rows[0];
  selectedId = product.id;
  $('#selectedName').textContent = product.name;
  $('#productSummary').textContent = `${product.total} total votes · ${product.positive} likes + loves · ${product.detailed} with preferences${product.legacyTotal ? ` · ${product.legacyTotal} original votes without attribute details` : ''}`;
  renderBars('#colorChart', product.preferences.color);
  renderBars('#fitChart', product.preferences.fit);
  renderBars('#sizeChart', product.preferences.size, product.sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  const combos = entries(product.combinations);
  $('#combinations').replaceChildren();
  if (!combos.length) $('#combinations').append(node('p', 'empty-chart', 'Complete color + fit + size selections will appear here.'));
  combos.slice(0, 3).forEach(([name, count], index) => {
    const row = node('div', 'combo-row'); row.append(node('span', 'combo-number', String(index + 1).padStart(2, '0')), node('span', '', name), node('strong', '', `${count} ${count === 1 ? 'vote' : 'votes'}`)); $('#combinations').append(row);
  });
  const top = entries(product.preferences.color);
  const rank = rows.filter(d => d.total && d.score > product.score).length + 1;
  const lead = top[0];
  const tie = lead && top.filter(([, count]) => count === lead[1]).length > 1;
  $('#insightText').textContent = !product.total ? 'A vote tells us which product. A preference tells us what to make next. Start voting to see both sides of the story.'
    : !lead ? `${product.name} has a score of ${product.score}, but no color direction yet. Product popularity alone does not reveal which version students want.`
    : `${product.name} ranks #${rank} by score. ${lead[0]} ${tie ? 'is tied for the leading color' : 'leads its color selections'} with ${lead[1]} positive ${lead[1] === 1 ? 'vote' : 'votes'}. These are selections, not unique students or purchase commitments.`;
}
function render() {
  document.querySelectorAll('button').forEach(button => { button.disabled = false; });
  const rows = MerchStore.summarize(state, catalog, demo);
  const total = rows.reduce((sum, d) => sum + d.total, 0);
  const positives = rows.reduce((sum, d) => sum + d.positive, 0);
  const details = rows.reduce((sum, d) => sum + d.detailed, 0);
  $('#totalVotes').textContent = total;
  $('#positiveRate').textContent = percent(positives, total);
  $('#coverage').textContent = percent(details, positives);
  $('#coverageNote').textContent = `${details} of ${positives} positive votes with preferences`;
  const voted = rows.filter(d => d.total);
  const lead = voted[0];
  const tied = lead && voted.filter(d => d.score === lead.score).length > 1;
  $('#leadingDesign').textContent = lead ? `${lead.name}${tied ? ' (tied)' : ''}` : 'No votes yet';
  $('#leaderScore').textContent = lead ? `Score ${lead.score} · ${lead.total} ${lead.total === 1 ? 'vote' : 'votes'}` : 'Start in the design studio';
  $('#demoBanner').hidden = !demo;
  $('#datasetLabel').textContent = demo ? 'SIMULATED · NOT STUDENT RESPONSES' : 'LOCAL BROWSER DATA';
  $('#realData').setAttribute('aria-pressed', String(!demo)); $('#demoData').setAttribute('aria-pressed', String(demo));
  $('#roundStatus').textContent = `Prototype deck cycles: ${state.round} · Original completed rounds: ${state.originalSnapshot?.data?.round || 0}. Choosing products manually can skip parts of a cycle.`;
  $('#importStatus').textContent = state.originalSnapshot ? `Original snapshot preserved · copied ${new Date(state.originalSnapshot.importedAt).toLocaleDateString()}` : 'No original records copied yet.';
  $('#importOriginal').disabled = !!state.originalSnapshot;
  const list = $('#resultsList'); list.replaceChildren();
  const max = Math.max(1, ...rows.map(d => Math.abs(d.score)));
  rows.forEach((design, index) => {
    const button = node('button', `rank-row${design.id === selectedId ? ' selected' : ''}`); button.type = 'button';
    button.setAttribute('aria-pressed', String(design.id === selectedId));
    button.setAttribute('aria-label', `${design.name}, score ${design.score}, ${design.total} votes. Show preferences.`);
    const position = rows.filter(d => d.total && d.score > design.score).length + 1;
    const rank = node('span', 'rank-number', design.total ? String(position).padStart(2, '0') : '—');
    const info = node('div', 'rank-info'); info.append(node('strong', '', design.name));
    const breakdown = node('span', 'vote-breakdown', `${design.votes.like} like · ${design.votes.love} love · ${design.votes.reject} reject`);
    const track = node('div', 'bar-track'); const fill = node('div', `bar-fill${design.score < 0 ? ' negative' : ''}`); fill.style.width = `${Math.abs(design.score) / max * 100}%`; track.append(fill);
    info.append(breakdown, track); button.append(rank, info, node('strong', 'rank-score', `${design.score > 0 ? '+' : ''}${design.score}`));
    button.addEventListener('click', () => { selectedId = design.id; renderDetails(rows); list.querySelectorAll('button').forEach(el => { el.classList.toggle('selected', el === button); el.setAttribute('aria-pressed', String(el === button)); }); });
    list.append(button);
  });
  renderDetails(rows);
}
async function refresh() { try { state = await MerchStore.read(); render(); } catch (error) { announce(`Could not load results. ${error.message}`, true); } }
$('#realData').addEventListener('click', () => { demo = false; render(); });
$('#demoData').addEventListener('click', async () => {
  try { state = await MerchStore.update(s => { if (!s.demoVotes.length) s.demoVotes = MerchStore.makeDemo(catalog); }); demo = true; render(); announce('Showing simulated demonstration data. Your prototype votes are separate.'); }
  catch (error) { announce(`Could not load demonstration data. ${error.message}`, true); }
});
$('#importOriginal').addEventListener('click', async () => {
  try { state = await MerchStore.importOriginal(); demo = false; render(); announce('Original records copied. The production database was not changed.'); }
  catch (error) { announce(error.message, true); }
});
$('#resetPrototype').addEventListener('click', async () => {
  if (!confirm('Reset all new prototype votes and generated demonstration data? Copied original records and the production database will remain untouched. Export JSON first if you want to keep prototype votes.')) return;
  try { state = await MerchStore.reset(); demo = false; render(); announce('Prototype votes reset. Copied original records and production data preserved.'); }
  catch (error) { announce(`Reset failed. ${error.message}`, true); }
});
$('#exportResults').addEventListener('click', async () => {
  try {
    const current = await MerchStore.read();
    const payload = { exportedAt: new Date().toISOString(), schemaVersion: 2,
      displayedDataset: demo ? 'demonstration' : 'prototype',
      note: 'Demonstration votes are simulated and kept separate. Original snapshot is preserved verbatim. Preference charts count likes and loves only.',
      ...current, summary: MerchStore.summarize(current, catalog, demo) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `mustang-design-lab-${demo ? 'demonstration' : 'prototype'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Exported prototype votes, demonstration data, and any copied original records.');
  } catch (error) { announce(`Export failed. ${error.message}`, true); }
});
document.querySelectorAll('button').forEach(button => { button.disabled = true; });
MerchStore.subscribe(refresh);
window.addEventListener('focus', refresh);
refresh();
