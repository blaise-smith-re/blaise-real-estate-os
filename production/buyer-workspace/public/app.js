'use strict';
const $ = id => document.getElementById(id);
let status, brief, draft, proposal, loading = false, generation = 0;
const time = value => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' CT' : 'Not retrieved';
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
function notice(text, error = false) { $('notice').textContent = text; $('notice').className = `notice${error ? ' error' : ''}`; $('notice').hidden = !text; }
function step(n) { for (let i = 1; i <= 3; i++) { if (i === n) $(`step${i}`).setAttribute('aria-current', 'step'); else $(`step${i}`).removeAttribute('aria-current'); } }
async function api(route, data = {}) {
  const r = await fetch(`/api/${route}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Workspace-CSRF': status.csrf }, body: JSON.stringify(data) });
  const value = await r.json(); if (!r.ok) throw new Error(value.error || 'The request could not be completed.'); return value;
}
async function run(fn) {
  if (loading) return;
  loading = true; document.querySelectorAll('button, #buyer').forEach(b => b.disabled = true); notice('Working…');
  try { await fn(); if ($('notice').textContent === 'Working…') notice(''); }
  catch (e) { notice(e.message, true); }
  finally { loading = false; document.querySelectorAll('button, #buyer').forEach(b => b.disabled = false); }
}
function scrollTo(id) { $(id).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function clearBuyer() { generation++; brief = draft = proposal = null; $('buyer-work').hidden = true; document.querySelector('.capture-grid').hidden = false; $('edit').hidden = true; $('review-panel').hidden = true; $('capture').hidden = false; $('property').value = ''; $('feedback').value = ''; step(1); }
async function loadBuyers() {
  const r = await api('buyers'); clearBuyer(); $('buyer').replaceChildren(node('option', 'Select a buyer')); $('buyer').firstChild.value = '';
  r.buyers.forEach(b => { const o = node('option', `${b.name} · ${b.stage}`); o.value = b.id; $('buyer').append(o); });
  $('list-source').textContent = `${r.buyers.length} ${r.buyers.length === 1 ? 'buyer' : 'buyers'} · Retrieved ${time(r.retrievedAt)}${r.partial ? ' · Partial list' : ''}`;
  if (!r.buyers.length) notice('No buyers returned in the supported active stages. This does not establish that there are no active buyers in other stages.');
}
async function loadBrief() {
  const id = $('buyer').value; clearBuyer(); if (!id) return;
  const g = generation; const b = await api('brief', { id }); if (g !== generation) return; brief = b;
  $('buyer-work').hidden = false; $('buyer-name').textContent = b.buyer.name; $('buyer-stage').textContent = `${b.buyer.stage} · ${b.buyer.assignedTo || 'Blaise Smith'}`;
  $('context').replaceChildren();
  [['CRM price', b.context.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(b.context.price) : 'Not recorded'], ['Lender in CRM', b.context.lender || 'Not recorded'], ['Financing', 'Not verified']].forEach(([k, v]) => $('context').append(node('dt', k), node('dd', v)));
  $('background').textContent = b.context.background || (b.context.latestNote ? `${b.context.latestNote.subject || 'Latest CRM note'} · ${time(b.context.latestNote.recordedAt)}\n${b.context.latestNote.excerpt}` : 'No background or meaningful recent note returned.');
  $('tasks').replaceChildren(); if (!b.tasks.length) $('tasks').append(node('li', 'No open commitments returned; check source coverage below.'));
  b.tasks.forEach(t => $('tasks').append(node('li', `${t.name}${t.due ? ` · ${String(t.due).slice(0, 10)}` : ''}`)));
  $('notes').replaceChildren(); b.notes.forEach(n => { const e = node('article', null, 'note'); e.append(node('strong', n.subject || 'CRM note'), node('p', n.recordedAt ? time(n.recordedAt) : 'Date not returned', 'small'), node('p', n.body, 'note-body')); $('notes').append(e); });
  if (!b.notes.length) $('notes').append(node('p', 'No notes returned in this bounded read.', 'small'));
  $('source-list').replaceChildren(); b.sources.forEach(s => $('source-list').append(node('p', `${s.name} · ${time(s.retrievedAt)}`, 'small source-row')));
  $('gaps').replaceChildren(); b.gaps.forEach(gap => $('gaps').append(node('li', gap)));
  step(2);
}
function choice(options, value, change, label) {
  const s = node('select'); s.setAttribute('aria-label', label);
  options.forEach(x => { const o = node('option', typeof x === 'string' ? x : x.text); o.value = typeof x === 'string' ? x : x.value; s.append(o); });
  s.value = value; s.addEventListener('change', () => change(s.value)); return s;
}
function renderDraft() {
  $('edit').hidden = false; $('review-panel').hidden = true; $('capture').hidden = true; $('parser').textContent = draft.parser;
  $('claims').replaceChildren();
  draft.claims.forEach(c => {
    const row = node('div', null, `claim${c.basis === 'Unclassified' ? ' warning' : ''}`);
    const include = document.createElement('input'); include.type = 'checkbox'; include.checked = c.include; include.setAttribute('aria-label', `Include feedback ${c.id}`); include.onchange = () => { c.include = include.checked; };
    row.append(include, node('p', c.quote), choice(['Client statement', 'Blaise observation', 'Reported context', 'Inference', 'Unclassified'], c.basis, value => { c.basis = value; row.classList.toggle('warning', value === 'Unclassified'); renderPreferences(); }, `Speaker for ${c.id}`)); $('claims').append(row);
  });
  renderPreferences(); $('next-action').value = draft.nextAction; $('create-task').checked = draft.createTask; $('due-date').value = draft.dueDate; $('date-label').hidden = !draft.createTask; $('client-text').value = draft.clientText;
  let target = $('task-target');
  if (target) target.parentElement.remove();
  const targetLabel = node('label', 'Task destination');
  target = choice([{ value: '', text: 'Create a new task' }, ...brief.tasks.map(t => ({ value: String(t.id), text: `Update: ${t.name}` }))], draft.existingTaskId || '', value => { draft.existingTaskId = value; const t = brief.tasks.find(t => String(t.id) === value); if (t?.due) $('due-date').value = String(t.due).slice(0, 10); }, 'Task destination');
  target.id = 'task-target'; targetLabel.append(target); $('date-label').prepend(targetLabel);
}
function renderPreferences() {
  $('preferences').replaceChildren();
  if (!draft.preferences.length) $('preferences').append(node('p', 'No clear preference changes extracted. Add only what the buyer actually stated.', 'small'));
  draft.preferences.forEach((p, i) => {
    const row = node('div', null, 'preference');
    const fieldLabel = node('label', 'Preference'); const field = node('input'); field.value = p.field; field.maxLength = 90; field.oninput = () => p.field = field.value; fieldLabel.append(field);
    const valueLabel = node('label', 'Proposed change'); const value = node('textarea'); value.rows = 2; value.maxLength = 600; value.value = p.after; value.oninput = () => p.after = value.value; valueLabel.append(value);
    const evidence = choice([{ value: '', text: 'Choose the supporting client statement' }, ...draft.claims.filter(c => c.basis === 'Client statement' && c.include).map(c => ({ value: c.id, text: c.quote }))], p.evidence, v => p.evidence = v, `Evidence for preference ${i + 1}`);
    const strength = choice(['Confirmed requirement', 'Soft preference', 'Preference to confirm'], p.treatment, v => p.treatment = v, `Strength of preference ${i + 1}`);
    const remove = node('button', 'Remove preference', 'quiet'); remove.onclick = () => { draft.preferences.splice(i, 1); renderPreferences(); };
    row.append(fieldLabel, valueLabel, node('label', 'Source statement'), evidence, node('label', 'How to treat it'), strength, remove); $('preferences').append(row);
  });
}
function captureDraft() { draft.nextAction = $('next-action').value; draft.createTask = $('create-task').checked; draft.dueDate = $('due-date').value; draft.clientText = $('client-text').value; }
function renderProposal(p) {
  proposal = p; $('edit').hidden = true; $('review-panel').hidden = false; step(3);
  $('review-title').textContent = p.state === 'VERIFIED' ? (status.mode === 'demo' ? 'Demo workflow verified.' : 'Saved and checked in FUB.') : 'Ready for your review.';
  $('review-source').textContent = `${p.buyer.name} · CRM context retrieved ${time(p.sourceRetrievedAt)}`;
  $('note-subject').textContent = p.note.subject; $('note-body').textContent = p.note.body;
  $('review-preferences').replaceChildren();
  if (!p.preferences.length) $('review-preferences').append(node('p', 'No preference changes proposed.'));
  p.preferences.forEach(x => { const e = node('div', null, 'preference'); e.append(node('strong', x.field), node('p', `Before: ${x.before}`, 'small'), node('p', x.after), node('p', x.treatment, 'small'), node('p', `Source: “${x.evidence}”`, 'small')); $('review-preferences').append(e); });
  $('review-action').textContent = p.nextAction; $('review-task').textContent = p.task ? `${p.task.existingId ? `Update task #${p.task.existingId} (was: ${p.task.previousName})` : 'Create one FUB task'} · due ${p.task.due_date} · America/Chicago` : 'Record in the note. No dated task will be created.';
  $('review-text').textContent = p.clientText; $('save-buyer').textContent = p.buyer.name;
  $('save').textContent = status.mode === 'demo' ? 'Approve & simulate save' : 'Approve & save to FUB';
  $('save-controls').hidden = p.state !== 'REVIEW'; $('edit-proposal').hidden = p.state !== 'REVIEW'; $('results').hidden = p.state === 'REVIEW'; $('results').replaceChildren();
  if (p.state !== 'REVIEW') {
    $('results').append(node('h3', p.state === 'VERIFIED' ? (status.mode === 'demo' ? 'Synthetic read-back complete' : 'Independent FUB read-back complete') : 'The workflow needs attention'), node('p', p.error || 'The saved records match the exact approved content. Client text remains unsent.'));
    p.results.forEach(r => { const row = node('div', null, 'result-row'); row.append(node('strong', `${r.kind === 'note' ? 'Note' : 'Task'} #${r.recordId} · ${r.status}`), node('p', `Read back ${time(r.retrievedAt)}`, 'small'), node('pre', r.body || `${r.name}\nDue ${r.dueDate}`)); $('results').append(row); });
    if (p.state === 'NEEDS_RECONCILIATION') { const b = node('button', 'Check FUB again · reads only', 'secondary'); b.onclick = () => run(async () => renderProposal(await api('reconcile', { id: p.id }))); $('results').append(b); }
  }
}
$('connect').onclick = () => run(async () => { const r = await api('connect'); location.assign(r.url); });
$('logout').onclick = () => run(async () => { await api('logout'); location.reload(); });
$('refresh').onclick = () => run(loadBuyers);
$('buyer').onchange = () => run(loadBrief);
$('refresh-brief').onclick = () => run(loadBrief);
$('draft').onclick = () => run(async () => { draft = await api('draft', { briefToken: brief.token, property: $('property').value, feedback: $('feedback').value }); renderDraft(); scrollTo('edit'); });
$('back-capture').onclick = () => { $('edit').hidden = true; $('capture').hidden = false; draft = null; scrollTo('capture'); };
$('add-preference').onclick = () => { draft.preferences.push({ field: '', after: '', before: 'Not confirmed in this brief', evidence: '', treatment: 'Preference to confirm', include: true }); renderPreferences(); };
$('create-task').onchange = () => $('date-label').hidden = !$('create-task').checked;
$('review').onclick = () => run(async () => { captureDraft(); renderProposal(await api('review', draft)); scrollTo('review-panel'); });
$('edit-proposal').onclick = () => { renderDraft(); step(2); scrollTo('edit'); };
$('save').onclick = () => run(async () => { const p = proposal; $('save-controls').hidden = true; try { renderProposal(await api('save', { id: p.id, digest: p.digest, approved: true })); } catch (e) { p.state = 'NEEDS_RECONCILIATION'; p.error = 'Connection interrupted after approval. Use read-back; do not submit the save again.'; renderProposal(p); throw e; } scrollTo('results'); });
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(proposal.clientText); $('copy-status').textContent = 'Copied. Nothing sent.'; } catch { const range = document.createRange(); range.selectNodeContents($('review-text')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('copy-status').textContent = 'Text selected. Use your browser’s Copy action.'; } };
async function start() {
  const r = await fetch('/api/status', { cache: 'no-store' }); status = await r.json();
  $('mode').textContent = status.mode === 'demo' ? 'FICTIONAL DEMO' : status.connected ? 'FUB CONNECTED' : 'FUB SIGN-IN NEEDED'; $('mode').classList.toggle('demo', status.mode === 'demo');
  $('connect-panel').hidden = status.connected; $('workspace').hidden = !status.connected; $('logout').hidden = !status.connected;
  $('privacy').textContent = status.privacy;
  $('mobile-gap').textContent = status.mobileGap; $('governance').textContent = `Business instructions last checked ${time(status.governanceReviewedAt)}. ${status.governanceNote}`;
  status.sources.forEach(s => { const li = node('li'), a = node('a', s.title); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); $('governing-sources').append(li); });
  const remaining = new Date(status.expiresAt).getTime() - Date.now();
  setTimeout(() => { clearBuyer(); $('recovery-list').replaceChildren(); $('workspace').hidden = true; $('connect-panel').hidden = false; notice('This private view expired. Reload to resume your sign-in and retrieve current context.'); }, Math.max(0, Math.min(1800000, remaining)));
  if (status.connected) await loadBuyers();
  $('recovery').hidden = !status.recovery?.length;
  (status.recovery || []).forEach(p => { const b = node('button', `${p.buyer.name} · ${p.state === 'VERIFIED' ? 'Verified receipt' : 'Check interrupted save'} · ${time(p.createdAt)}`, 'secondary'); b.onclick = () => { clearBuyer(); $('buyer-work').hidden = false; document.querySelector('.capture-grid').hidden = true; renderProposal(p); scrollTo('review-panel'); }; $('recovery-list').append(b); });
}
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
run(start);
