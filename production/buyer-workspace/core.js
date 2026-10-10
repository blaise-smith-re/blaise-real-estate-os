'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { scanForCredentialMaterial } = require('../../runtime/contract');
const { FubWriteAdapter } = require('../../runtime/adapters/fub-write');

const LABELS = ['Client statement', 'Blaise observation', 'Reported context', 'Inference', 'Unclassified'];
const BUYER_STAGES = ['Showing homes', 'Submitting offers'];
const TOOLS = ['get_users', 'get_stages', 'find_contact', 'get_contact', 'get_contact_notes', 'get_open_tasks', 'create_contact_note', 'create_contact_task', 'update_contact_task'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nameOf = p => [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const clean = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
function contactKind(person) {
  if (person.stage === 'Trash') return 'excluded';
  const tags = (person.tags || []).map(t => String(t).trim());
  if (BUYER_STAGES.includes(person.stage) || tags.some(t => /^(Buyer|B|B\/S|I|Investor)$/i.test(t))) return 'buyer';
  if (['Listing agreement', 'Active listing', 'Renter'].includes(person.stage) || tags.some(t => /^(Seller|S|Renter|Tenant)$/i.test(t))) return 'excluded';
  return 'unclassified';
}

function privateCheck(value) {
  scanForCredentialMaterial(value);
  requireValue(!/\b(?:\d{3}-\d{2}-\d{4}|lockbox|alarm code|door code|access code|social security|account number|routing number|password|wire instructions)\b/i.test(JSON.stringify(value)), 'Remove sensitive financial information or access instructions. Keep them in the authorized source.');
}

function unwrap(response) {
  requireValue(response && !response.isError, 'FUB could not complete the request. Reconnect or refresh before continuing.');
  let result = response.structuredContent ?? response.result;
  if (result === undefined && response.content) {
    try { result = JSON.parse(response.content.filter(x => x.type === 'text').map(x => x.text).join('\n')); }
    catch { throw new Error('FUB returned an unreadable response. Nothing is verified.'); }
  }
  result ??= response;
  return result.result ?? result;
}

function parseFeedback(text, firstName = '') {
  privateCheck(text);
  requireValue(typeof text === 'string' && text.trim().length >= 5 && text.length <= 8000, 'Add showing feedback (up to 8,000 characters).');
  return text.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean).map((quote, i) => {
    let basis = 'Unclassified';
    if (/^(?:client|buyer)(?: statement)?\s*:|^(?:the (?:buyer|client)|they|he|she) (?:said|told me|mentioned|asked)|^client said|^buyer said/i.test(quote)) basis = 'Client statement';
    else if (firstName && quote.toLowerCase().startsWith(firstName.toLowerCase() + ' ') && /\b(?:said|liked|wants?|needs?|prefers?|asked)\b/i.test(quote)) basis = 'Client statement';
    else if (/^(?:observation|blaise(?: observation)?)\s*:|^I (?:noticed|observed|saw|heard)/i.test(quote)) basis = 'Blaise observation';
    else if (/^The listing agent\b|^We (?:agreed|haven.t|have not)|^No (?:offer|showing|closing) date|^(?:Next step|Next action)\s*:/i.test(quote)) basis = 'Reported context';
    else if (/^(?:inference|hypothesis)\s*:|^I (?:think|suspect|wonder)/i.test(quote)) basis = 'Inference';
    return { id: `e${i + 1}`, quote, basis, include: true };
  });
}

// Deliberately conservative: complete attributed sentences, never inferred hard filters.
// This is an assistive first-pass parser, not an AI service or semantic verification.
function preferenceCandidates(claims) {
  const fields = [
    ['Budget', /\bbudget|\bunder \$|\bup to \$|\bmaximum price|\bcomfortable.*(?:price|payment)/i],
    ['Bedrooms', /\bbedrooms?\b|\bbeds?\b/i], ['Bathrooms', /\bbath(?:room)?s?\b/i],
    ['Location', /\barea\b|\bneighborhood\b|\blocation\b|\bcommute\b|\blive in\b/i],
    ['Condition', /\bfixer\b|\brenovat|\bmove.in.ready\b/i],
    ['Layout & features', /\byard\b|\bgarage\b|\bstairs\b|\blayout\b|\bkitchen\b|\bmain.floor\b/i],
    ['Home type', /\btownho|\bcondo|\bsingle.family|\bduplex/i],
    ['Rental-use condition', /\bAirbnb\b|\bshort.term\b|\brental/i],
  ];
  return claims.filter(c => c.include && c.basis === 'Client statement').flatMap(c => {
    // Likes/dislikes about this home alone must not become whole-search requirements.
    if (!/\b(?:needs?|wants?|prefers?|must|budget|looking for|only|no longer|don.t want)\b/i.test(c.quote) || /\b(?:maybe|might|possibly|if|could|not sure)\b/i.test(c.quote)) return [];
    return fields.filter(([, re]) => re.test(c.quote)).map(([field]) => ({ field, before: 'Not confirmed in this brief', after: c.quote, evidence: c.id, treatment: 'Preference to confirm', include: true }));
  });
}

function fullTasks(r) {
  const c = r._completeness;
  requireValue(c && c.has_more === false && c.capped === false, 'Open tasks are incomplete. Refresh before creating another task.');
  if (c.total_count != null) requireValue(c.returned_count === c.total_count, 'Open tasks are incomplete.');
  requireValue(Array.isArray(r.tasks), 'FUB did not return a task list.');
  return r.tasks;
}

function validateDate(value) {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value, 'Choose a real due date in America/Chicago.');
}

class BuyerWorkspace {
  constructor({ invoke, tools = TOOLS, now = () => new Date().toISOString(), mode = 'live', checkpoint = () => {} }) {
    this.invoke = invoke;
    this.tools = new Set(tools);
    this.now = now;
    this.mode = mode;
    this.checkpoint = checkpoint;
    this.briefs = new Map();
    this.proposals = new Map();
    this.owner = null;
    this.busy = false;
    this.writer = new FubWriteAdapter({
      invokeTool: async (tool, args) => ({ structuredContent: await this.call(tool, args) }),
      availableTools: tool => this.tools.has(tool), toolPrefix: '',
      allowedOperations: ['CREATE_CONTACT_NOTE', 'CREATE_CONTACT_TASK', 'UPDATE_CONTACT_TASK'], clock: now,
    });
  }
  exportState() {
    const cutoff = Date.parse(this.now()) - 30 * 60 * 1000;
    const receiptCutoff = Date.parse(this.now()) - 24 * 60 * 60 * 1000;
    return { owner: this.owner, briefs: [...this.briefs].filter(([, s]) => Date.parse(s.retrievedAt) > cutoff), proposals: [...this.proposals].filter(([, p]) => Date.parse(p.createdAt) > (p.attempted ? receiptCutoff : cutoff)).map(([id, p]) => { if (!p.attempted) return [id, p]; const { snapshot, ...receipt } = p; return [id, receipt]; }) };
  }
  pruneContext() {
    const bounded = this.exportState();
    this.briefs = new Map(bounded.briefs); this.proposals = new Map(bounded.proposals);
  }
  restoreState(state) {
    this.owner = state?.owner || null;
    this.briefs = new Map(state?.briefs || []);
    this.proposals = new Map(state?.proposals || []);
    for (const p of this.proposals.values()) if (p.state === 'SAVING') {
      p.state = p.attempted ? 'NEEDS_RECONCILIATION' : 'REFRESH_REQUIRED';
      p.error = 'The server restarted during approval. Check FUB before preparing any further update.';
    }
    const bounded = this.exportState();
    this.briefs = new Map(bounded.briefs); this.proposals = new Map(bounded.proposals);
  }
  async call(tool, args = {}) {
    requireValue(this.tools.has(tool), `Access gap: ${tool} is not available on this connection.`);
    return unwrap(await this.invoke(tool, args));
  }
  async buyers({ query = '' } = {}) {
    requireValue(typeof query === 'string' && query.length <= 120, 'Search by a name of up to 120 characters.');
    query = query.trim(); privateCheck(query);
    const users = await this.call('get_users');
    const matches = (users.users || []).filter(u => (u.name || nameOf(u)) === 'Blaise Smith');
    requireValue(matches.length === 1, 'Could not resolve Blaise’s assigned-agent ID. No buyer lookup was made.');
    this.owner = matches[0].id;
    // Stages describe progress, not buyer identity. Search all assigned stages so
    // nurture, early conversations and under-contract buyers are not hidden.
    const page = await this.call('find_contact', { assigned_user_id: this.owner, ...(query ? { name: query } : {}), limit: 100 });
    requireValue(Array.isArray(page.people), 'FUB did not return a contact list. Refresh before selecting a buyer.');
    const people = [...new Map(page.people.filter(p => p.assignedUserId === this.owner && contactKind(p) !== 'excluded').map(p => [p.id, p])).values()];
    const summarize = p => ({ id: p.id, name: nameOf(p), stage: p.stage, classification: contactKind(p) });
    const sort = (a, b) => a.name.localeCompare(b.name);
    const m = page._metadata;
    const partial = !m || Boolean(m.next || m.nextLink) || Number(m.offset || 0) > 0 || !Number.isFinite(m.total) || m.total > page.people.length;
    return { buyers: people.filter(p => contactKind(p) === 'buyer').map(summarize).sort(sort), otherContacts: people.filter(p => contactKind(p) === 'unclassified').map(summarize).sort(sort), retrievedAt: this.now(), partial, query, scope: 'Assigned to Blaise across all stages. Buyer-tagged contacts and showing/offer stages are listed as buyers; unclassified contacts appear separately. Seller/renter-only and Trash records are excluded.' };
  }
  async brief(id) {
    requireValue(!this.busy, 'Wait for the current save to finish.');
    requireValue(Number.isSafeInteger(id) && id > 0, 'Select one exact buyer.');
    requireValue(this.owner, 'Load the buyer list first.');
    const contact = await this.call('get_contact', { person_id: id });
    requireValue(contact.id === id && contact.assignedUserId === this.owner && contactKind(contact) !== 'excluded', 'The contact’s identity, assignment or buyer classification changed. Refresh the buyer list.');
    const retrievedAt = this.now();
    const read = async (tool, args) => {
      try { return { data: await this.call(tool, args), retrievedAt: this.now() }; }
      catch { return { error: `Unable to retrieve ${tool === 'get_open_tasks' ? 'open tasks' : 'recent notes'}.`, retrievedAt: null }; }
    };
    const [notes, tasks] = await Promise.all([read('get_contact_notes', { person_id: id, limit: 10, offset: 0 }), read('get_open_tasks', { person_id: id })]);
    const snapshot = { contact, notes, tasks, retrievedAt };
    const meaningfulNotes = (notes.data?.notes || []).filter(n => !n.actionPlanId && !n.automationId && !/^ylopo_/i.test(n.type || ''));
    const token = randomUUID();
    this.invalidateReviews();
    this.briefs.clear();
    this.briefs.set(token, snapshot);
    return {
      token, buyer: { id, name: nameOf(contact), firstName: contact.firstName, stage: contact.stage, assignedTo: contact.assignedTo, classification: contactKind(contact) }, retrievedAt,
      context: { price: contact.price || null, lender: contact.assignedLenderName || null, background: clean(contact.background), latestNote: meaningfulNotes[0] ? { subject: clean(meaningfulNotes[0].subject), excerpt: clean(meaningfulNotes[0].body).slice(0, 600), recordedAt: meaningfulNotes[0].created } : null, financing: 'Approval and comfortable budget are not independently verified.' },
      notes: (notes.data?.notes || []).slice(0, 5).map(n => ({ id: n.id, subject: clean(n.subject), body: clean(n.body), recordedAt: n.created })),
      tasks: (tasks.data?.tasks || []).map(t => ({ id: t.id, name: clean(t.name), due: t.dueDate || t.dueDateTime, type: t.type })),
      sources: [{ name: 'FUB contact', retrievedAt }, { name: 'FUB recent notes · latest 10 requested', retrievedAt: notes.retrievedAt }, { name: 'FUB open tasks', retrievedAt: tasks.retrievedAt }],
      gaps: [contactKind(contact) === 'unclassified' ? 'Buyer type is not marked in FUB. Confirm this is the right contact for a buyer showing; no CRM label was changed.' : null, notes.error, tasks.error, 'Current property facts: MLS is not connected to this workspace.', 'Preference changes are recorded in the CRM note. Ylopo saved searches are not changed.', 'Text/call history and automation overlap are not checked by this brief.'].filter(Boolean),
    };
  }
  draft({ briefToken, property, feedback }) {
    this.pruneContext();
    requireValue(this.briefs.has(briefToken), 'Refresh the buyer brief before drafting.');
    requireValue(typeof property === 'string' && property.trim() && property.length <= 240, 'Add the showing property or a clear tour label.');
    this.invalidateReviews();
    const first = this.briefs.get(briefToken).contact.firstName;
    const claims = parseFeedback(feedback, first);
    const prefs = preferenceCandidates(claims);
    const explicitNext = claims.find(c => /^(?:Next step|Next action)\s*:/i.test(c.quote))?.quote.replace(/^(?:Next step|Next action)\s*:\s*/i, '');
    const rentalQuestion = prefs.some(p => p.field === 'Rental-use condition' && /\bconfirm|\bverif/i.test(p.after));
    const nextAction = explicitNext || (rentalQuestion ? 'Obtain written rental restrictions and governing documents before moving toward an offer.' : 'Confirm which reactions should change the search before refining the next shortlist.');
    const clientText = rentalQuestion ? `Hey ${first}, I’ll track down the written rental rules so we can check whether your plan works before moving toward an offer.` : `${first}, thanks for walking through the home with me. Which of today’s likes or dealbreakers should lead our next search?`;
    return { briefToken, firstName: first, property: property.trim(), feedback, claims, preferences: prefs, nextAction, dueDate: '', createTask: false, clientText, parser: 'A conservative rules-based first pass, not an AI interpretation. Check speaker labels and preferences; unclear feedback is left unclassified.' };
  }
  invalidateReviews() { for (const p of this.proposals.values()) if (p.state === 'REVIEW') p.state = 'SUPERSEDED'; }
  review(input) {
    this.pruneContext();
    const snapshot = this.briefs.get(input.briefToken);
    requireValue(snapshot, 'Refresh the buyer brief before reviewing.');
    privateCheck(input);
    requireValue(typeof input.feedback === 'string' && input.feedback.length <= 8000, 'Feedback is required.');
    requireValue(typeof input.property === 'string' && input.property.trim() && input.property.length <= 240, 'Add a property or tour label.');
    requireValue(Array.isArray(input.claims) && input.claims.length <= 60, 'Review the feedback evidence.');
    const claims = input.claims.filter(c => c.include).map(c => {
      requireValue(LABELS.includes(c.basis) && c.quote && input.feedback.includes(c.quote), 'Every feedback claim must retain its original quotation and speaker label.');
      return { id: c.id, quote: c.quote, basis: c.basis };
    });
    requireValue(claims.length && new Set(claims.map(c => c.id)).size === claims.length, 'Select at least one unique feedback claim.');
    requireValue(!claims.some(c => c.basis === 'Unclassified'), 'Label unclear feedback or exclude it before review.');
    const preferences = (input.preferences || []).filter(p => p.include).map(p => {
      const evidence = claims.find(c => c.id === p.evidence);
      requireValue(evidence?.basis === 'Client statement', 'Preference changes need a client statement; observations are not client requirements.');
      requireValue(typeof p.field === 'string' && p.field.length < 100 && typeof p.after === 'string' && p.after.length > 0 && p.after.length <= 600, 'Describe each preference change concisely.');
      requireValue(['Confirmed requirement', 'Soft preference', 'Preference to confirm'].includes(p.treatment), 'Choose the preference’s strength.');
      return { field: p.field, before: 'Not confirmed in this brief', after: p.after, evidence: evidence.quote, treatment: p.treatment };
    });
    requireValue(typeof input.nextAction === 'string' && input.nextAction.trim().length >= 12 && input.nextAction.length <= 400, 'Add one specific next action.');
    const updateTask = input.createTask && input.existingTaskId ? fullTasks(snapshot.tasks.data || {}).find(t => t.id === Number(input.existingTaskId)) : null;
    if (input.createTask) { validateDate(input.dueDate); fullTasks(snapshot.tasks.data || {}); if (input.existingTaskId) requireValue(updateTask && updateTask.assignedUserId === this.owner, 'Choose an existing task assigned to Blaise.'); }
    requireValue(typeof input.clientText === 'string' && input.clientText.trim() && input.clientText.split(/\s+/).length <= 90, 'Keep the client draft under 90 words.');
    const sections = LABELS.filter(l => l !== 'Unclassified').map(label => {
      const rows = claims.filter(c => c.basis === label).map(c => `- ${c.quote}`);
      return rows.length ? `${label === 'Reported context' ? label : label + 's'} (Blaise-reported showing feedback):\n${rows.join('\n')}` : null;
    }).filter(Boolean);
    if (preferences.length) sections.push('Preference changes approved for CRM context (saved-search settings unchanged):\n' + preferences.map(p => `- ${p.field}: ${p.after} [${p.treatment}]. Prior value not confirmed in this brief.`).join('\n'));
    sections.push(`Next action — proposed by Blaise: ${input.nextAction.trim()}${input.createTask ? `\nTask due: ${input.dueDate} (America/Chicago)` : '\nNo dated task requested.'}`);
    sections.push('Property facts: not independently retrieved or verified in this workspace.');
    // Retrieval times are displayed in the review receipt, not embedded in the
    // note body: refreshing must not defeat exact-duplicate protection.
    const note = { subject: `Showing feedback — ${input.property.trim()}`, body: sections.join('\n\n') };
    requireValue(note.body.length <= 6000, 'Shorten the selected feedback before saving a concise CRM note.');
    const value = { buyer: { id: snapshot.contact.id, name: nameOf(snapshot.contact) }, property: input.property.trim(), note, preferences, nextAction: input.nextAction.trim(), task: input.createTask ? { name: input.nextAction.trim(), due_date: input.dueDate, task_type: updateTask?.type || 'Follow Up', existingId: updateTask?.id || null, previousName: updateTask?.name || null, previousDue: updateTask?.dueDate || null } : null, clientText: input.clientText.trim(), createdAt: this.now(), sourceRetrievedAt: snapshot.retrievedAt };
    const proposal = { ...value, id: randomUUID(), digest: digest(value), state: 'REVIEW', snapshot, results: [] };
    this.invalidateReviews();
    this.proposals.set(proposal.id, proposal);
    return this.publicProposal(proposal);
  }
  publicProposal(p) { const { snapshot, ...result } = p; return structuredClone(result); }
  async save({ id, digest: approvedDigest, approved }) {
    const p = this.proposals.get(id);
    requireValue(p && approved === true && p.digest === approvedDigest, 'Approve the exact current proposal before saving.');
    if (p.state === 'VERIFIED') return this.publicProposal(p);
    requireValue(p.state === 'REVIEW', 'This proposal has already been attempted. Read back the result; do not repeat an uncertain write.');
    requireValue(!this.busy, 'Another save is in progress. Wait for its result.');
    requireValue(Date.parse(this.now()) - Date.parse(p.createdAt) < 30 * 60 * 1000, 'This review expired. Refresh and review current buyer context.');
    this.busy = true;
    p.state = 'SAVING';
    try {
      await this.checkpoint();
      const current = await this.call('get_contact', { person_id: p.buyer.id });
      requireValue(current.id === p.buyer.id && nameOf(current) === p.buyer.name && current.assignedUserId === this.owner && current.stage === p.snapshot.contact.stage && contactKind(current) !== 'excluded', 'Buyer identity, assignment, classification or stage changed. Refresh and review again.');
      requireValue(current.updated === p.snapshot.contact.updated, 'The CRM record changed after this brief. Refresh and review again.');
      // A task is never issued from a partial task snapshot; existing equivalent tasks are reused.
      const tasks = p.task ? fullTasks(await this.call('get_open_tasks', { person_id: p.buyer.id })) : [];
      if (p.task?.existingId) {
        const old = tasks.find(t => t.id === p.task.existingId);
        requireValue(old && old.name === p.task.previousName && old.dueDate === p.task.previousDue && old.type === p.task.task_type && old.assignedUserId === this.owner, 'The selected task changed. Refresh and review again.');
      }
      const notes = await this.call('get_contact_notes', { person_id: p.buyer.id, limit: 20, offset: 0 });
      requireValue(Array.isArray(notes.notes), 'Could not check recent notes before saving.');
      const sameNote = notes.notes.find(n => clean(n.subject) === p.note.subject && clean(n.body) === p.note.body);
      if (!sameNote) requireValue(notes.notes[0]?.id === p.snapshot.notes.data?.notes?.[0]?.id, 'New CRM notes arrived after the brief. Refresh and review the latest context.');
      const sameTask = p.task && tasks.find(t => (!p.task.existingId || t.id === p.task.existingId) && t.assignedUserId === this.owner && t.name === p.task.name && t.type === p.task.task_type && String(t.dueDate || '').slice(0, 10) === p.task.due_date);
      if (!sameNote) await this.write('CREATE_CONTACT_NOTE', p, p.note);
      await this.verifyNote(p);
      if (p.task) {
        if (!sameTask) {
          if (p.task.existingId) await this.write('UPDATE_CONTACT_TASK', p, { task_id: p.task.existingId, expected_task_name: p.task.previousName, new_name: p.task.name, new_due_date: p.task.due_date });
          else await this.write('CREATE_CONTACT_TASK', p, { name: p.task.name, due_date: p.task.due_date, task_type: p.task.task_type, assigned_user_id: current.assignedUserId });
        }
        await this.verifyTask(p);
      }
      p.state = 'VERIFIED';
    } catch (error) {
      p.state = p.attempted ? 'NEEDS_RECONCILIATION' : 'REFRESH_REQUIRED';
      p.error = p.attempted ? 'The save may be partial. Check the read-back results below, then use “Check FUB again.” No writes will be retried.' : error.message;
    } finally { this.busy = false; await this.checkpoint(); }
    return this.publicProposal(p);
  }
  async write(operation, p, args) {
    p.attempted = true;
    // Persist BEFORE the first possible side effect. Restart recovery never
    // replays an attempted operation, even if the provider response was lost.
    await this.checkpoint();
    const identity = operation === 'UPDATE_CONTACT_TASK' ? { expected_person_id: p.buyer.id } : { person_id: p.buyer.id, expected_contact_name: p.buyer.name };
    const result = await this.writer.performWrite({ capability: { operation }, entity: { external_ids: { fub: p.buyer.id } }, untrusted_data: { ...identity, ...args }, execution_constraints: { mode: 'INTERNAL_WRITE', effect_budget: { external_writes: 1, external_messages: 0, schedules_created: 0, money_moved: 0 } } });
    // The adapter response is evidence, but only the independent read below establishes completion.
    if (result.report_status !== 'COMPLETED') throw new Error('FUB write needs reconciliation.');
  }
  async verifyNote(p) {
    const r = await this.call('get_contact_notes', { person_id: p.buyer.id, limit: 20, offset: 0 });
    const n = (r.notes || []).find(n => (!n.personId || n.personId === p.buyer.id) && clean(n.subject) === p.note.subject && clean(n.body) === p.note.body);
    requireValue(n && n.id, 'The exact note was not found on read-back.');
    p.results = [...p.results.filter(r => r.kind !== 'note'), { kind: 'note', status: 'VERIFIED', recordId: n.id, retrievedAt: this.now(), subject: clean(n.subject), body: clean(n.body) }];
  }
  async verifyTask(p) {
    const tasks = fullTasks(await this.call('get_open_tasks', { person_id: p.buyer.id }));
    const t = tasks.find(t => (!t.personId || t.personId === p.buyer.id) && (!p.task.existingId || t.id === p.task.existingId) && t.name === p.task.name && t.type === p.task.task_type && t.assignedUserId === this.owner && String(t.dueDate || '').slice(0, 10) === p.task.due_date);
    requireValue(t && t.id, 'The exact task was not found on read-back.');
    p.results = [...p.results.filter(r => r.kind !== 'task'), { kind: 'task', status: 'VERIFIED', recordId: t.id, retrievedAt: this.now(), name: t.name, dueDate: t.dueDate }];
  }
  async reconcile(id) {
    const p = this.proposals.get(id);
    requireValue(p && p.attempted && !this.busy, 'No uncertain save is ready for read-back.');
    this.busy = true;
    try { await this.verifyNote(p); if (p.task) await this.verifyTask(p); p.state = 'VERIFIED'; delete p.error; }
    catch { p.state = 'NEEDS_RECONCILIATION'; p.error = 'Not all exact records were found. Verified items are listed. Refresh the buyer in FUB before preparing any missing update.'; }
    finally { this.busy = false; await this.checkpoint(); }
    return this.publicProposal(p);
  }
}

module.exports = { BuyerWorkspace, parseFeedback, preferenceCandidates, privateCheck, unwrap, fullTasks, validateDate, TOOLS, LABELS };
