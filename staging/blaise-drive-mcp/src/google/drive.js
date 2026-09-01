/**
 * Google Drive v3 operations.
 *
 * Every function here takes an explicit fileId or an explicit query. Nothing in this module
 * resolves a document by guessing, and nothing returns "the first result" as if it were the
 * answer — `searchFiles` returns all candidates and lets the caller decide, because a title
 * search must never authorize a write (CLAUDE.md §4.1, docs/SECURITY.md).
 */

'use strict';

import { DRIVE_BASE, GoogleApiError } from './client.js';

export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Fields worth having on every metadata read. Keeps payloads small and predictable. */
const FILE_FIELDS = 'id,name,mimeType,parents,modifiedTime,createdTime,trashed,owners(emailAddress),webViewLink,version';

/** Titles carrying these prefixes are never authority (CLAUDE.md §4.4). */
export function isLegacyTitle(name) {
  return /^\s*(LEGACY|ARCHIVED)\s*[-–—]/i.test(String(name ?? ''));
}

/** Drive query strings need single quotes escaped or the query silently changes meaning. */
export function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class DriveApi {
  constructor(client) {
    this.client = client;
  }

  /** Exact metadata for one fileId. */
  async getFile(fileId, { fields = FILE_FIELDS } = {}) {
    if (!fileId) throw new GoogleApiError('BAD_REQUEST', 'getFile requires a fileId');
    return this.client.request('GET', `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`, {
      query: { fields, supportsAllDrives: true },
    });
  }

  /**
   * Search. Returns EVERY candidate, deliberately — the caller must handle ambiguity.
   * `pageSize` is capped because an unbounded canonical-title search returning 400 rows is a
   * symptom of a bad query, not something to paginate through.
   */
  async searchFiles({ q, pageSize = 50, orderBy = 'modifiedTime desc' } = {}) {
    if (!q) throw new GoogleApiError('BAD_REQUEST', 'searchFiles requires a query');
    const out = await this.client.request('GET', `${DRIVE_BASE}/files`, {
      query: {
        q,
        pageSize: Math.min(pageSize, 100),
        orderBy,
        fields: `files(${FILE_FIELDS}),incompleteSearch`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      },
    });
    return { files: out?.files ?? [], incompleteSearch: Boolean(out?.incompleteSearch) };
  }

  /** Find every non-trashed file with exactly this name. The uniqueness primitive. */
  async findByExactName(name, { includeTrashed = false } = {}) {
    const q = `name = '${escapeQueryValue(name)}'` + (includeTrashed ? '' : ' and trashed = false');
    const { files, incompleteSearch } = await this.searchFiles({ q });
    // Drive `name =` is case-insensitive and can match near-variants; enforce exactness here.
    return { files: files.filter(f => f.name === name), incompleteSearch };
  }

  /** Copy a file. Returns the NEW fileId — the source is untouched. */
  async copyFile(fileId, { name, parents = null } = {}) {
    const body = {};
    if (name) body.name = name;
    if (parents) body.parents = parents;
    return this.client.request('POST', `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/copy`, {
      body,
      query: { fields: FILE_FIELDS, supportsAllDrives: true },
    });
  }

  /**
   * Rename and/or move. Preserves the fileId — a move is a parent swap, never a copy+delete.
   * Passing neither a name nor a parent change is a caller bug, not a no-op to paper over.
   */
  async renameMoveFile(fileId, { name = null, addParents = null, removeParents = null } = {}) {
    if (!name && !addParents && !removeParents) {
      throw new GoogleApiError('BAD_REQUEST', 'renameMoveFile requires a name and/or a parent change');
    }
    return this.client.request('PATCH', `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`, {
      body: name ? { name } : {},
      query: {
        addParents: addParents ? addParents.join(',') : undefined,
        removeParents: removeParents ? removeParents.join(',') : undefined,
        fields: FILE_FIELDS,
        supportsAllDrives: true,
      },
    });
  }

  async getPermissions(fileId) {
    const out = await this.client.request('GET', `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/permissions`, {
      query: { fields: 'permissions(id,type,role,emailAddress)', supportsAllDrives: true },
    });
    return out?.permissions ?? [];
  }

  /**
   * Confirm a fileId is a usable, current Google Doc.
   *
   * Returns a structured verdict rather than throwing, so callers can distinguish "wrong kind of
   * thing" from "right thing, wrong state" and report precisely which gate failed.
   */
  async verifyCanonicalTarget(fileId, { expectedTitle = null } = {}) {
    const file = await this.getFile(fileId);
    const problems = [];
    if (file.trashed) problems.push({ gate: 'TRASHED', detail: 'file is in the trash' });
    if (file.mimeType !== GOOGLE_DOC_MIME) {
      problems.push({ gate: 'WRONG_MIME', detail: `expected ${GOOGLE_DOC_MIME}, got ${file.mimeType}` });
    }
    if (isLegacyTitle(file.name)) {
      problems.push({ gate: 'LEGACY_TARGET', detail: `title is archival: "${file.name}"` });
    }
    if (expectedTitle !== null && file.name !== expectedTitle) {
      problems.push({ gate: 'TITLE_MISMATCH', detail: `expected "${expectedTitle}", found "${file.name}"` });
    }
    return { file, ok: problems.length === 0, problems };
  }
}
