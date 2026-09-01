/**
 * Source-registry recovery — the IF-014 model.
 *
 * The OS resolves canonical sources by pinned fileId. But some supersession workflows create a NEW
 * current document and rename the old one `LEGACY - …`, which silently invalidates the pin. A
 * pinned fileId that now resolves to a LEGACY document is not an error to route around — it is a
 * hold on that specific write, plus an evidence-based search for the replacement.
 *
 * This module NEVER auto-follows a candidate. It returns evidence for a human or a repo-native
 * process to act on. "A similarly named document" is exactly how you edit the wrong file.
 */

'use strict';

import { isLegacyTitle, GOOGLE_DOC_MIME } from '../google/drive.js';

export const RECOVERY = {
  PIN_VALID: 'PIN_VALID',
  RECOVERED_CANDIDATE: 'RECOVERED_CANDIDATE',
  AMBIGUOUS: 'AMBIGUOUS',
  NOT_FOUND: 'NOT_FOUND',
};

/**
 * Resolve a registry pin, and if it is no longer canonical, look for the replacement.
 *
 * @returns {{status: string, holdWrite: boolean, pinned: object|null, candidate: object|null,
 *            candidates: object[], evidence: string[], registryUpdate: object|null}}
 */
export async function resolvePinnedSource(drive, { key, pinnedFileId, expectedTitle, expectedAuthority = null }) {
  const evidence = [];
  const out = {
    key, status: null, holdWrite: false, pinned: null,
    candidate: null, candidates: [], evidence, registryUpdate: null,
  };

  let pinned = null;
  try {
    pinned = await drive.getFile(pinnedFileId);
    out.pinned = { fileId: pinned.id, name: pinned.name, mimeType: pinned.mimeType, trashed: pinned.trashed };
    evidence.push(`pin ${pinnedFileId} resolved to "${pinned.name}"`);
  } catch (e) {
    evidence.push(`pin ${pinnedFileId} did not resolve: ${e.code || e.message}`);
  }

  const pinIsCanonical = pinned
    && !pinned.trashed
    && pinned.mimeType === GOOGLE_DOC_MIME
    && !isLegacyTitle(pinned.name)
    && (expectedTitle ? pinned.name === expectedTitle : true);

  if (pinIsCanonical) {
    out.status = RECOVERY.PIN_VALID;
    evidence.push('pin is current, correctly typed, and not archival — proceeding on the pin');
    return out;
  }

  // The pin is stale, wrong-typed, archival, or gone. Hold this write and search for evidence.
  out.holdWrite = true;
  if (pinned && isLegacyTitle(pinned.name)) {
    evidence.push(`pin now resolves to an ARCHIVAL title — the document was superseded in place`);
  }
  if (pinned && pinned.mimeType !== GOOGLE_DOC_MIME) {
    evidence.push(`pin is a ${pinned.mimeType}, not a Google Doc`);
  }

  if (!expectedTitle) {
    out.status = RECOVERY.NOT_FOUND;
    evidence.push('no expectedTitle supplied — cannot search for a replacement without one');
    return out;
  }

  const { files, incompleteSearch } = await drive.findByExactName(expectedTitle);
  const current = files.filter(f =>
    !isLegacyTitle(f.name) && !f.trashed && f.mimeType === GOOGLE_DOC_MIME);
  out.candidates = current.map(f => ({ fileId: f.id, name: f.name, modifiedTime: f.modifiedTime }));
  evidence.push(`exact-title search found ${current.length} current candidate(s)${incompleteSearch ? ' (search incomplete)' : ''}`);

  if (incompleteSearch) {
    out.status = RECOVERY.AMBIGUOUS;
    evidence.push('search was incomplete — refusing to nominate a candidate from a partial result set');
    return out;
  }
  if (current.length === 0) {
    out.status = RECOVERY.NOT_FOUND;
    return out;
  }
  if (current.length > 1) {
    out.status = RECOVERY.AMBIGUOUS;
    evidence.push('more than one current document carries this exact title — a human must disambiguate');
    return out;
  }

  const candidate = current[0];
  if (candidate.id === pinnedFileId) {
    // Same file, but it failed a canonical gate above (archival title, wrong MIME, trashed).
    out.status = RECOVERY.NOT_FOUND;
    evidence.push('the only candidate IS the pinned file, which already failed a canonical gate');
    return out;
  }

  out.status = RECOVERY.RECOVERED_CANDIDATE;
  out.candidate = { fileId: candidate.id, name: candidate.name, modifiedTime: candidate.modifiedTime };
  out.registryUpdate = {
    key,
    from: pinnedFileId,
    to: candidate.id,
    reason: pinned && isLegacyTitle(pinned.name)
      ? 'pinned document was renamed LEGACY; a new current document carries the canonical title'
      : 'pinned document is no longer a valid canonical target',
    requiresApproval: true,
  };
  evidence.push(`candidate ${candidate.id} identified by EXACT title match and uniqueness — NOT auto-followed`);
  return out;
}
