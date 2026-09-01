/**
 * canonical-doc-maintenance — controlled maintenance of one canonical Google Doc.
 *
 * Implements the 21-step sequence from the Blaise Real Estate OS certification path
 * (docs/SOP-MAINTENANCE-CERTIFICATION-PATH.md §2 in the OS repo). The rules that matter most:
 *
 *   ARCHIVE BEFORE EDIT. No archive, no edit. Ever.
 *   Never declare success from a write response — always read back independently.
 *   Exactly one CURRENT canonical must remain. Two is the failure mode this whole lane risks
 *     creating, and it is the one that must never occur.
 *   Repeating the same request must not produce a second archive or a duplicate change note.
 *
 * Every run returns a structured report whether it succeeded, no-opped, or failed partway. A
 * partial result is reported as a partial result; nothing here rounds up to "done".
 */

'use strict';

import { GoogleApiError } from '../google/client.js';
import { isLegacyTitle, GOOGLE_DOC_MIME } from '../google/drive.js';
import { extractText, extractVersion, documentContains } from '../google/docs.js';

/** Outcome codes. The adversarial suite asserts on these, so they are contract. */
export const OUTCOME = {
  APPLIED: 'APPLIED',
  NOOP_ALREADY_CURRENT: 'NOOP_ALREADY_CURRENT',
  ARCHIVE_ONLY_PARTIAL: 'ARCHIVE_ONLY_PARTIAL',
  BLOCKED: 'BLOCKED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
};

/** `LEGACY - <title> - Superseded <YYYY-MM-DD> (v<old>)` — matches the existing Drive convention. */
export function buildArchiveTitle(title, supersededDate, oldVersion) {
  const v = oldVersion ? ` (v${oldVersion})` : '';
  return `LEGACY - ${title} - Superseded ${supersededDate}${v}`;
}

/** America/Chicago business date. The OS anchors every date to Chicago; archives are no exception. */
export function chicagoDate(now = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return dtf.format(now); // en-CA yields YYYY-MM-DD
}

class Journal {
  constructor() { this.steps = []; }
  record(step, status, detail = null, data = null) {
    this.steps.push({ step, status, detail, ...(data ? { data } : {}) });
    return this;
  }
  get failed() { return this.steps.filter(s => s.status === 'FAIL'); }
}

/**
 * @param {{drive: import('../google/drive.js').DriveApi, docs: import('../google/docs.js').DocsApi, client: any}} deps
 */
export async function canonicalDocMaintenance(deps, request) {
  const { drive, docs, client } = deps;
  const j = new Journal();
  const {
    targetFileId,
    expectedTitle,
    expectedCurrentVersion = null,
    newVersion = null,
    changeNote = null,
    patchOperations = [],
    archiveTitle: archiveTitleOverride = null,
    archiveFolderId = null,
    verifyContains = [],
    verifyAbsent = [],
    expectedCrossLinks = [],
    dryRun = false,
    now = new Date(),
  } = request ?? {};

  const report = {
    outcome: null,
    targetFileId,
    expectedTitle,
    fileIdPreserved: null,
    archive: null,
    versionBefore: null,
    versionAfter: null,
    revisionBefore: null,
    revisionAfter: null,
    canonicalUniqueness: null,
    steps: j.steps,
    problems: [],
    writesPerformed: [],
  };

  const block = (code, detail, extra = {}) => {
    report.outcome = OUTCOME.BLOCKED;
    report.problems.push({ code, detail, ...extra });
    return report;
  };

  // ---------------------------------------------------------------- 1. preflight
  if (!targetFileId) return block('NO_TARGET', 'targetFileId is required');
  if (!expectedTitle) return block('NO_EXPECTED_TITLE', 'expectedTitle is required — a write without an expected title cannot verify its own target');

  if (!dryRun && client.mode !== 'read-write') {
    return block('READ_ONLY_MODE',
      'BLAISE_DRIVE_MODE is not "read-write" — every mutation is refused. This is the default and it fails closed.');
  }
  try {
    await client.assertBoundAccount();
    j.record('1_preflight', 'PASS', 'credential matches the bound Drive account');
  } catch (e) {
    j.record('1_preflight', 'FAIL', e.message);
    return block(e.code || 'PREFLIGHT_FAILED', e.message);
  }

  // ------------------------------------------- 2-4. resolve, verify MIME, reject LEGACY
  let verdict;
  try {
    verdict = await drive.verifyCanonicalTarget(targetFileId, { expectedTitle });
  } catch (e) {
    j.record('2_resolve', 'FAIL', e.message);
    return block(e.code || 'RESOLVE_FAILED', `could not resolve fileId ${targetFileId}: ${e.message}`);
  }
  if (!verdict.ok) {
    for (const p of verdict.problems) j.record(`2_4_${p.gate}`, 'FAIL', p.detail);
    return block(verdict.problems[0].gate, verdict.problems[0].detail, { allGates: verdict.problems });
  }
  j.record('2_4_target', 'PASS', `fileId ${targetFileId} is a current Google Doc titled "${verdict.file.name}"`);
  const sourceParents = verdict.file.parents ?? [];

  // ---------------------------------------------------------------- 5-7. read + capture revision
  let doc, text;
  try {
    doc = await docs.getDocument(targetFileId);
    text = extractText(doc);
  } catch (e) {
    j.record('5_read', 'FAIL', e.message);
    return block(e.code || 'READ_FAILED', e.message);
  }
  report.versionBefore = extractVersion(text);
  report.revisionBefore = doc.revisionId ?? null;

  if (!report.revisionBefore) {
    j.record('7_revision', 'FAIL', 'document returned no revisionId');
    return block('NO_REVISION_ID',
      'document has no revisionId — a revision-safe write is impossible, refusing to edit');
  }
  j.record('5_7_read', 'PASS', `version ${report.versionBefore ?? 'none'} @ revision ${report.revisionBefore}`);

  // ---------------------------------------------------------------- 9. idempotency (checked early)
  const noteAlreadyPresent = changeNote ? documentContains(text, changeNote) : false;
  const versionAlreadyNew = newVersion ? report.versionBefore === newVersion : false;
  if (versionAlreadyNew && (!changeNote || noteAlreadyPresent)) {
    j.record('9_idempotency', 'PASS', `already at v${newVersion} with the change note present — no work to do`);
    report.outcome = OUTCOME.NOOP_ALREADY_CURRENT;
    report.versionAfter = report.versionBefore;
    report.revisionAfter = report.revisionBefore;
    report.fileIdPreserved = true;
    report.canonicalUniqueness = await checkUniqueness(drive, expectedTitle, targetFileId, j);
    return report;
  }
  j.record('9_idempotency', 'PASS', 'change not yet applied');

  // ---------------------------------------------------------------- 6. expected version
  if (expectedCurrentVersion !== null && report.versionBefore !== expectedCurrentVersion) {
    j.record('6_version', 'FAIL',
      `expected v${expectedCurrentVersion}, document is v${report.versionBefore ?? 'unversioned'}`);
    return block('VERSION_MISMATCH',
      `expected v${expectedCurrentVersion}, found v${report.versionBefore ?? 'unversioned'} — refusing to patch a document that is not in the expected state`);
  }
  j.record('6_version', 'PASS', `document is at expected v${report.versionBefore ?? 'unversioned'}`);

  // ---------------------------------------------------------------- 8. conflicting canonicals
  const before = await checkUniqueness(drive, expectedTitle, targetFileId, j, '8_pre_uniqueness');
  if (!before.ok) {
    return block('AMBIGUOUS_CANONICAL',
      `${before.currentCount} active documents carry the title "${expectedTitle}" — resolve the ambiguity before any write`,
      { candidates: before.current });
  }

  if (dryRun) {
    j.record('dry_run', 'PASS', 'stopped before any mutation');
    report.outcome = OUTCOME.BLOCKED;
    report.problems.push({ code: 'DRY_RUN', detail: 'dryRun requested — all preconditions passed, nothing written' });
    return report;
  }

  // ---------------------------------------------------------------- 10-13. archive BEFORE edit
  const archiveTitle = archiveTitleOverride
    || buildArchiveTitle(expectedTitle, chicagoDate(now), report.versionBefore);

  let archive = null;
  try {
    // Reconcile first: a prior partial run may already have created this archive. Creating a
    // second one on retry is precisely the duplicate this design must not produce.
    const existing = await drive.findByExactName(archiveTitle);
    if (existing.files.length > 1) {
      j.record('10_archive', 'FAIL', `${existing.files.length} archives already named "${archiveTitle}"`);
      return block('DUPLICATE_ARCHIVE',
        `${existing.files.length} files already carry the archive title "${archiveTitle}" — reconcile manually before retrying`);
    }
    if (existing.files.length === 1) {
      archive = existing.files[0];
      j.record('10_archive', 'PASS', `reusing existing archive ${archive.id} from a prior run — no duplicate created`);
    } else {
      const copy = await drive.copyFile(targetFileId, {
        name: archiveTitle,
        parents: archiveFolderId ? [archiveFolderId] : (sourceParents.length ? sourceParents : null),
      });
      report.writesPerformed.push({ op: 'drive.copy', fileId: copy.id, name: copy.name });
      archive = copy;
      j.record('10_11_archive', 'PASS', `archived to ${copy.id} as "${copy.name}"`);
    }

    // 12. Placement, when an archive folder is configured and the copy did not land there.
    if (archiveFolderId && !(archive.parents ?? []).includes(archiveFolderId)) {
      archive = await drive.renameMoveFile(archive.id, {
        addParents: [archiveFolderId],
        removeParents: (archive.parents ?? []).filter(p => p !== archiveFolderId),
      });
      report.writesPerformed.push({ op: 'drive.move', fileId: archive.id });
      j.record('12_archive_placement', 'PASS', `archive placed in folder ${archiveFolderId}`);
    } else if (!archiveFolderId) {
      j.record('12_archive_placement', 'WARN',
        'no BLAISE_DRIVE_ARCHIVE_FOLDER_ID configured — archive left beside the source document');
    }

    // 13. Independent verification that the archive really exists and reads back correctly.
    const archiveCheck = await drive.getFile(archive.id);
    if (archiveCheck.trashed) throw new GoogleApiError('ARCHIVE_INVALID', 'archive copy is trashed');
    if (archiveCheck.name !== archiveTitle) {
      throw new GoogleApiError('ARCHIVE_INVALID',
        `archive title is "${archiveCheck.name}", expected "${archiveTitle}"`);
    }
    if (!isLegacyTitle(archiveCheck.name)) {
      // Guards adversarial case 29: an archive left carrying a CURRENT-looking title becomes a
      // second canonical, which is the exact outcome step 20 exists to prevent.
      throw new GoogleApiError('ARCHIVE_INVALID',
        `archive title "${archiveCheck.name}" is not marked LEGACY/ARCHIVED — it would read as a second current canonical`);
    }
    report.archive = { fileId: archiveCheck.id, name: archiveCheck.name, parents: archiveCheck.parents ?? [] };
    j.record('13_archive_verified', 'PASS', `archive ${archiveCheck.id} verified`);
  } catch (e) {
    j.record('10_13_archive', 'FAIL', e.message);
    // The code names the STEP, not the HTTP cause. "ARCHIVE_FAILED" carries the safety-critical
    // meaning — the canonical document was never touched — which "BACKEND_ERROR" does not. The
    // underlying cause rides along in `cause` so nothing diagnostic is lost.
    //
    // Deliberate validation failures keep their own codes: "could not create the archive" and
    // "created an archive that is wrong" are different problems with different remedies.
    const ARCHIVE_VALIDATION = ['ARCHIVE_INVALID', 'DUPLICATE_ARCHIVE'];
    return block(ARCHIVE_VALIDATION.includes(e.code) ? e.code : 'ARCHIVE_FAILED',
      `archive step failed: ${e.message}. NO EDIT WAS ATTEMPTED — the canonical document is untouched.`,
      { cause: e.code || 'UNKNOWN', archive: report.archive });
  }

  // ---------------------------------------------------------------- 14. patch the ORIGINAL fileId
  if (patchOperations.length === 0) {
    return block('NO_PATCH', 'patchOperations is empty — nothing to apply', { archive: report.archive });
  }

  try {
    await docs.batchUpdate(targetFileId, patchOperations, { requiredRevisionId: report.revisionBefore });
    report.writesPerformed.push({ op: 'docs.batchUpdate', fileId: targetFileId, requests: patchOperations.length });
    j.record('14_patch', 'PASS', `${patchOperations.length} operation(s) applied against revision ${report.revisionBefore}`);
  } catch (e) {
    j.record('14_patch', 'FAIL', e.message);
    // Archive exists, canonical does not have the edit. Report the true partial state; a blind
    // retry must reuse the archive above rather than making another one.
    report.outcome = OUTCOME.ARCHIVE_ONLY_PARTIAL;
    report.problems.push({
      code: e.code === 'STALE_REVISION' ? 'STALE_REVISION' : (e.code || 'PATCH_FAILED'),
      detail: e.code === 'STALE_REVISION'
        ? `the document changed between read and write — the patch was rejected and NOTHING was modified. Re-run to rebuild the patch against the current revision; the existing archive ${report.archive?.fileId} will be reused, not duplicated.`
        : `${e.message} — the canonical document was NOT modified. Archive ${report.archive?.fileId} exists and must be reconciled, not re-created.`,
    });
    report.fileIdPreserved = true;
    return report;
  }

  // ---------------------------------------------------------------- 15-18. independent read-back
  let after, afterText;
  try {
    after = await docs.getDocument(targetFileId);
    afterText = extractText(after);
  } catch (e) {
    j.record('15_readback', 'FAIL', e.message);
    report.outcome = OUTCOME.VERIFICATION_FAILED;
    report.problems.push({
      code: 'READBACK_FAILED',
      detail: `the patch was accepted but read-back failed: ${e.message}. DO NOT retry the write — re-read first to determine whether the change already landed.`,
    });
    return report;
  }

  report.revisionAfter = after.revisionId ?? null;
  report.versionAfter = extractVersion(afterText);
  report.fileIdPreserved = (after.documentId ?? targetFileId) === targetFileId;

  const failures = [];
  for (const needle of verifyContains) {
    if (!documentContains(afterText, needle)) failures.push({ check: 'contains', value: needle });
  }
  for (const needle of verifyAbsent) {
    if (documentContains(afterText, needle)) failures.push({ check: 'absent', value: needle });
  }
  if (changeNote && !documentContains(afterText, changeNote)) {
    failures.push({ check: 'changeNote', value: changeNote });
  }
  if (newVersion && report.versionAfter !== newVersion) {
    failures.push({ check: 'version', value: newVersion, found: report.versionAfter });
  }
  for (const link of expectedCrossLinks) {
    if (!documentContains(afterText, link)) failures.push({ check: 'crossLink', value: link });
  }
  if (!report.fileIdPreserved) {
    failures.push({ check: 'fileIdPreserved', value: targetFileId, found: after.documentId });
  }

  if (failures.length) {
    j.record('16_18_verify', 'FAIL', `${failures.length} verification(s) failed`);
    report.outcome = OUTCOME.VERIFICATION_FAILED;
    report.problems.push({
      code: 'VERIFICATION_FAILED',
      detail: 'the write was accepted but read-back does not match the intent. The archive is intact and is the rollback source.',
      failures,
      rollbackSource: report.archive?.fileId ?? null,
    });
    return report;
  }
  j.record('16_18_verify', 'PASS',
    `content, version (${report.versionAfter}) and ${expectedCrossLinks.length} link(s) verified on read-back`);

  // ---------------------------------------------------------------- 19-20. archive + uniqueness
  const archiveStill = await drive.getFile(report.archive.fileId).catch(() => null);
  if (!archiveStill || archiveStill.trashed) {
    j.record('19_archive', 'FAIL', 'archive is missing or trashed after the edit');
    report.outcome = OUTCOME.VERIFICATION_FAILED;
    report.problems.push({ code: 'ARCHIVE_LOST', detail: 'the archive disappeared during the run' });
    return report;
  }
  j.record('19_archive', 'PASS', `archive ${report.archive.fileId} still present`);

  report.canonicalUniqueness = await checkUniqueness(drive, expectedTitle, targetFileId, j, '20_uniqueness');
  if (!report.canonicalUniqueness.ok) {
    report.outcome = OUTCOME.VERIFICATION_FAILED;
    report.problems.push({
      code: 'MULTIPLE_CURRENT_CANONICALS',
      detail: `${report.canonicalUniqueness.currentCount} active documents now carry "${expectedTitle}" — this must be reconciled immediately`,
      candidates: report.canonicalUniqueness.current,
    });
    return report;
  }

  // ---------------------------------------------------------------- 21. report
  report.outcome = OUTCOME.APPLIED;
  return report;
}

/** Exactly one active, non-LEGACY document may carry the canonical title, and it must be the target. */
async function checkUniqueness(drive, title, expectedFileId, journal, step = 'uniqueness') {
  const { files, incompleteSearch } = await drive.findByExactName(title);
  const current = files.filter(f => !isLegacyTitle(f.name) && !f.trashed
    && f.mimeType === GOOGLE_DOC_MIME);
  const ok = current.length === 1 && current[0].id === expectedFileId && !incompleteSearch;
  journal?.record(step, ok ? 'PASS' : 'FAIL',
    ok ? `exactly one current canonical, and it is ${expectedFileId}`
       : `${current.length} current canonical(s)${incompleteSearch ? ' (search was incomplete)' : ''}`);
  return {
    ok,
    currentCount: current.length,
    current: current.map(f => ({ fileId: f.id, name: f.name })),
    matchesTarget: current.length === 1 && current[0].id === expectedFileId,
    incompleteSearch,
  };
}
