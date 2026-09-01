/**
 * Google Docs v1 operations, including the revision-safe write path.
 *
 * CONCURRENCY — what is real and what is not:
 *
 *   Docs `documents.batchUpdate` accepts `writeControl.requiredRevisionId`. If the document has
 *   changed since that revision, the API rejects the whole batch. That is genuine optimistic
 *   concurrency and it is what this module uses for every body edit.
 *
 *   Drive `files.copy` and `files.update` have NO equivalent precondition. So the archive step of
 *   a maintenance run cannot be revision-guarded — a concurrent edit landing between the archive
 *   copy and the body patch produces an archive one revision stale. The body patch still fails
 *   safely (the revision moved), so the canonical document is never corrupted; the cost is a
 *   spurious archive. docs/LIMITATIONS.md L-002 records this honestly rather than implying a
 *   guarantee the API does not offer.
 */

'use strict';

import { DOCS_BASE, GoogleApiError } from './client.js';

/** Batch request kinds this server is willing to send. Anything else is refused. */
export const ALLOWED_REQUEST_KINDS = new Set([
  'replaceAllText',
  'insertText',
  'deleteContentRange',
  'updateTextStyle',
  'updateParagraphStyle',
]);

export class DocsApi {
  constructor(client) {
    this.client = client;
  }

  /** Full document structure plus the revisionId the write path depends on. */
  async getDocument(documentId) {
    if (!documentId) throw new GoogleApiError('BAD_REQUEST', 'getDocument requires a documentId');
    return this.client.request('GET', `${DOCS_BASE}/documents/${encodeURIComponent(documentId)}`);
  }

  /**
   * Apply a batch, guarded by the revision it was built against.
   *
   * `requiredRevisionId` is mandatory here by design. An unguarded batchUpdate is exactly the
   * "silently overwrite newer edits" behavior this connector exists to prevent, so there is no
   * parameter to turn it off.
   */
  async batchUpdate(documentId, requests, { requiredRevisionId }) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new GoogleApiError('BAD_REQUEST', 'batchUpdate requires at least one request');
    }
    if (!requiredRevisionId) {
      throw new GoogleApiError('BAD_REQUEST',
        'batchUpdate requires requiredRevisionId — unguarded writes are not supported');
    }
    validateRequests(requests);
    return this.client.request('POST',
      `${DOCS_BASE}/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
        body: { requests, writeControl: { requiredRevisionId } },
      });
  }
}

/**
 * Reject a malformed or unsupported batch before it reaches Google.
 *
 * Google would reject most of these too, but a local rejection is deterministic, testable, and —
 * critically — happens before any partial application is possible.
 */
export function validateRequests(requests) {
  requests.forEach((req, i) => {
    if (!req || typeof req !== 'object' || Array.isArray(req)) {
      throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] is not an object`);
    }
    const kinds = Object.keys(req);
    if (kinds.length !== 1) {
      throw new GoogleApiError('MALFORMED_BATCH',
        `request[${i}] must carry exactly one operation, found ${kinds.length || 'none'}`);
    }
    const kind = kinds[0];
    if (!ALLOWED_REQUEST_KINDS.has(kind)) {
      throw new GoogleApiError('UNSUPPORTED_OPERATION',
        `request[${i}] uses "${kind}", which this server does not send. Allowed: ${[...ALLOWED_REQUEST_KINDS].join(', ')}`);
    }
    const op = req[kind];

    if (kind === 'replaceAllText') {
      const text = op?.containsText?.text;
      if (!text) throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] replaceAllText needs containsText.text`);
      if (typeof op.replaceText !== 'string') {
        throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] replaceAllText needs a string replaceText`);
      }
    }

    if (kind === 'insertText') {
      if (typeof op?.text !== 'string' || op.text.length === 0) {
        throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] insertText needs non-empty text`);
      }
      const idx = op?.location?.index ?? op?.endOfSegmentLocation;
      if (idx === undefined) {
        throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] insertText needs a location`);
      }
    }

    if (kind === 'deleteContentRange') {
      const r = op?.range;
      if (!r || typeof r.startIndex !== 'number' || typeof r.endIndex !== 'number') {
        throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] deleteContentRange needs a numeric range`);
      }
      if (r.endIndex <= r.startIndex) {
        throw new GoogleApiError('MALFORMED_BATCH', `request[${i}] deleteContentRange range is empty or inverted`);
      }
      // Index 1 is the first body character. A delete starting at 0 that runs to the end is the
      // classic "wipe the document" bug; refuse it outright rather than trusting the caller.
      if (r.startIndex <= 1 && r.endIndex >= 100000) {
        throw new GoogleApiError('REFUSED_DESTRUCTIVE',
          `request[${i}] deleteContentRange spans the entire document — refused`);
      }
    }
  });
  return true;
}

/**
 * Flatten a Docs document to plain text.
 *
 * Walks tables and their nested cell content too, because a canonical SOP's version line is
 * routinely inside a table and a naive body-only walk silently misses it.
 */
export function extractText(doc) {
  const parts = [];
  const walkElements = (elements = []) => {
    for (const el of elements) {
      if (el.paragraph) {
        for (const pe of el.paragraph.elements ?? []) {
          if (pe.textRun?.content) parts.push(pe.textRun.content);
        }
      }
      if (el.table) {
        for (const row of el.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) walkElements(cell.content ?? []);
        }
      }
      if (el.tableOfContents) walkElements(el.tableOfContents.content ?? []);
    }
  };
  walkElements(doc?.body?.content ?? []);
  return parts.join('');
}

/**
 * Read a `Version: X.Y` style line out of a document.
 *
 * Tolerant of the variants that actually occur across Blaise's canonical docs — "Version: 1.0",
 * "Version 1.0", "v1.0" — and of the smart quotes and non-breaking spaces that Docs inserts.
 */
export function extractVersion(text) {
  const normalized = String(text ?? '').replace(/ /g, ' ');
  const m = normalized.match(/\bversion\s*[:\-]?\s*v?(\d+(?:\.\d+)*)/i)
    || normalized.match(/\bv(\d+\.\d+)\b/);
  return m ? m[1] : null;
}

/** Normalize smart punctuation so a patch written with ASCII still matches document text. */
export function normalizeForMatch(text) {
  return String(text ?? '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ');
}

/** Does `needle` occur in the document text, ignoring smart-punctuation differences? */
export function documentContains(docText, needle) {
  return normalizeForMatch(docText).includes(normalizeForMatch(needle));
}
