/**
 * MCP tool surface — seven tools, deliberately.
 *
 * Six primitives plus one orchestrator. Every description states what the tool does, which IDs it
 * requires, whether it WRITES, whether it preserves the fileId, and what it verifies — because a
 * tool description is the only thing a calling agent reads before deciding to use it.
 *
 * Write tools are refused unless BLAISE_DRIVE_MODE=read-write. That check lives in `dispatch`, not
 * in each tool, so a new write tool cannot accidentally ship without the gate.
 */

'use strict';

import { GoogleApiError } from './google/client.js';
import { DriveApi, GOOGLE_DOC_MIME, escapeQueryValue } from './google/drive.js';
import { DocsApi, extractText, extractVersion } from './google/docs.js';
import { canonicalDocMaintenance } from './canonical/maintenance.js';
import { resolvePinnedSource } from './canonical/recovery.js';

/** Tools that mutate Drive or Docs. Gated centrally. */
export const WRITE_TOOLS = new Set([
  'drive_copy_file',
  'drive_rename_move_file',
  'docs_batch_update',
  'canonical_doc_maintenance',
]);

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });

export const TOOLS = [
  {
    name: 'drive_search_files',
    description:
      'READ. Search Drive and return EVERY matching candidate with id, name, mimeType, parents, ' +
      'modifiedTime and trashed. Returns all matches deliberately — a title search must never ' +
      'authorize a write, and this tool will not nominate "the first result". Use it to discover ' +
      'candidates or to verify canonical uniqueness, then resolve an exact fileId before acting.',
    inputSchema: {
      type: 'object',
      properties: {
        query: str('Raw Drive v3 query, e.g. "name = \'SOP 02\' and trashed = false".'),
        exactName: str('Convenience: find every non-trashed file with exactly this name. Use instead of query.'),
        pageSize: { type: 'number', description: 'Max results, capped at 100. Default 50.' },
      },
    },
  },
  {
    name: 'drive_get_file_metadata',
    description:
      'READ. Exact metadata for one fileId: name, mimeType, parents, modifiedTime, trashed, owners, ' +
      'webViewLink. Also returns a canonical-target verdict — whether the file is a current, ' +
      'non-LEGACY Google Doc — with the specific gate that failed if it is not.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: str('Exact Drive file ID. Required.'),
        expectedTitle: str('Optional. If given, a title mismatch is reported as a failed gate.'),
      },
      required: ['fileId'],
    },
  },
  {
    name: 'docs_get_document',
    description:
      'READ. Full Google Docs structure for one documentId, plus the revisionId required for any ' +
      'revision-safe write, the extracted plain text (tables included), and the parsed version ' +
      'string. Capture the revisionId here and pass it to docs_batch_update.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: str('Exact Google Doc file ID. Required.'),
        includeStructure: { type: 'boolean', description: 'Include the raw body structure. Default false — the text and revisionId are usually enough.' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'drive_copy_file',
    description:
      'WRITE. Copies a file. Creates a NEW fileId; the source is untouched. Used to take an archive ' +
      'snapshot before editing a canonical document. Returns the new file\'s id, name and parents so ' +
      'the copy can be verified independently.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: str('Source file ID. Required.'),
        name: str('Name for the copy. For archives use "LEGACY - <title> - Superseded <YYYY-MM-DD> (v<old>)".'),
        parents: { type: 'array', items: { type: 'string' }, description: 'Destination folder IDs.' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_rename_move_file',
    description:
      'WRITE. Renames and/or moves a file. PRESERVES the fileId — a move is a parent swap, never a ' +
      'copy-and-delete. Returns the updated metadata for verification.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: str('File ID to modify. Required. Unchanged by this operation.'),
        name: str('New name, if renaming.'),
        addParents: { type: 'array', items: { type: 'string' }, description: 'Folder IDs to add.' },
        removeParents: { type: 'array', items: { type: 'string' }, description: 'Folder IDs to remove.' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'docs_batch_update',
    description:
      'WRITE. Applies a structured batch to an EXISTING Google Doc body. PRESERVES the fileId — the ' +
      'document is edited in place, never replaced. requiredRevisionId is MANDATORY: the write is ' +
      'rejected if the document changed since you read it, so a concurrent edit can never be ' +
      'silently overwritten. Supports replaceAllText, insertText, deleteContentRange, ' +
      'updateTextStyle, updateParagraphStyle. A batch is all-or-nothing. Does NOT verify the result ' +
      '— read the document back yourself, or use canonical_doc_maintenance which does it for you.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: str('Google Doc file ID. Required. Unchanged by this operation.'),
        requiredRevisionId: str('revisionId from docs_get_document. Required. No unguarded write path exists.'),
        requests: { type: 'array', items: { type: 'object' }, description: 'Docs API requests. Required, non-empty.' },
      },
      required: ['documentId', 'requiredRevisionId', 'requests'],
    },
  },
  {
    name: 'canonical_source_recovery',
    description:
      'READ. Resolves a registry-pinned fileId and, if the pin is no longer canonical (LEGACY, ' +
      'trashed, wrong MIME, missing), HOLDS the write and searches for the replacement by EXACT ' +
      'title. Never auto-follows a candidate — returns evidence and a proposed registry update that ' +
      'requires approval. Ambiguity returns AMBIGUOUS with no nomination.',
    inputSchema: {
      type: 'object',
      properties: {
        key: str('Registry key, for the report.'),
        pinnedFileId: str('The fileId currently pinned in the registry. Required.'),
        expectedTitle: str('Exact canonical title. Required to search for a replacement.'),
      },
      required: ['pinnedFileId'],
    },
  },
  {
    name: 'canonical_doc_maintenance',
    description:
      'WRITE. The full controlled-maintenance sequence for ONE canonical Google Doc: preflight, ' +
      'exact-target resolution, MIME check, LEGACY rejection, version check, pre-write uniqueness ' +
      'check, idempotency check, ARCHIVE BEFORE EDIT, in-place body patch against the captured ' +
      'revision, independent read-back, content/version/link verification, archive verification, and ' +
      'exactly-one-current-canonical verification. PRESERVES the canonical fileId. Idempotent: ' +
      're-running an applied change returns NOOP_ALREADY_CURRENT with zero writes and no second ' +
      'archive. Returns a full step-by-step report; a partial failure is reported as partial, never ' +
      'rounded up to success.',
    inputSchema: {
      type: 'object',
      properties: {
        targetFileId: str('Exact canonical Google Doc ID. Required.'),
        expectedTitle: str('Exact expected title. Required — a write that cannot verify its target is refused.'),
        expectedCurrentVersion: str('Version the document must currently be at, e.g. "1.4".'),
        newVersion: str('Version after the patch, e.g. "1.5". Verified on read-back.'),
        changeNote: str('Change note text. Verified present on read-back; duplicate insertion is prevented.'),
        patchOperations: { type: 'array', items: { type: 'object' }, description: 'Docs API requests. Required.' },
        archiveTitle: str('Override the archive title. Must carry a LEGACY/ARCHIVED prefix or the run is refused.'),
        archiveFolderId: str('Destination folder for the archive. Defaults to BLAISE_DRIVE_ARCHIVE_FOLDER_ID.'),
        verifyContains: { type: 'array', items: { type: 'string' }, description: 'Strings that must be present after.' },
        verifyAbsent: { type: 'array', items: { type: 'string' }, description: 'Strings that must be gone after.' },
        expectedCrossLinks: { type: 'array', items: { type: 'string' }, description: 'Links that must resolve in the result.' },
        dryRun: { type: 'boolean', description: 'Run every precondition and stop before any mutation.' },
      },
      required: ['targetFileId', 'expectedTitle', 'patchOperations'],
    },
  },
];

/** Execute one tool call. Write gating happens here, once, for every write tool. */
export async function dispatch(name, args, { client }) {
  const drive = new DriveApi(client);
  const docs = new DocsApi(client);

  if (WRITE_TOOLS.has(name) && client.mode !== 'read-write') {
    throw new GoogleApiError('READ_ONLY_MODE',
      `"${name}" is a write tool and BLAISE_DRIVE_MODE is "${client.mode}". Every mutation is refused. ` +
      'This is the default and it fails closed — set BLAISE_DRIVE_MODE=read-write deliberately to enable writes.');
  }

  switch (name) {
    case 'drive_search_files': {
      const q = args.exactName
        ? `name = '${escapeQueryValue(args.exactName)}' and trashed = false`
        : args.query;
      const out = await drive.searchFiles({ q, pageSize: args.pageSize ?? 50 });
      const files = args.exactName ? out.files.filter(f => f.name === args.exactName) : out.files;
      return {
        matchCount: files.length,
        incompleteSearch: out.incompleteSearch,
        files: files.map(f => ({
          fileId: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents ?? [],
          modifiedTime: f.modifiedTime, trashed: Boolean(f.trashed),
          isGoogleDoc: f.mimeType === GOOGLE_DOC_MIME,
        })),
        note: 'All candidates returned. A title search does not authorize a write — resolve an exact fileId first.',
      };
    }

    case 'drive_get_file_metadata': {
      const verdict = await drive.verifyCanonicalTarget(args.fileId, { expectedTitle: args.expectedTitle ?? null });
      return {
        fileId: verdict.file.id, name: verdict.file.name, mimeType: verdict.file.mimeType,
        parents: verdict.file.parents ?? [], modifiedTime: verdict.file.modifiedTime,
        trashed: Boolean(verdict.file.trashed), webViewLink: verdict.file.webViewLink ?? null,
        owners: (verdict.file.owners ?? []).map(o => o.emailAddress),
        canonicalTarget: { ok: verdict.ok, failedGates: verdict.problems },
      };
    }

    case 'docs_get_document': {
      const doc = await docs.getDocument(args.documentId);
      const text = extractText(doc);
      return {
        documentId: doc.documentId, title: doc.title,
        revisionId: doc.revisionId,
        version: extractVersion(text),
        textLength: text.length,
        text,
        ...(args.includeStructure ? { body: doc.body } : {}),
        note: 'Pass revisionId to docs_batch_update. It is the only thing preventing a silent overwrite.',
      };
    }

    case 'drive_copy_file': {
      const copy = await drive.copyFile(args.fileId, { name: args.name, parents: args.parents ?? null });
      return {
        sourceFileId: args.fileId, newFileId: copy.id, name: copy.name,
        parents: copy.parents ?? [],
        note: 'A copy has a NEW fileId. The source document is unchanged.',
      };
    }

    case 'drive_rename_move_file': {
      const f = await drive.renameMoveFile(args.fileId, {
        name: args.name ?? null,
        addParents: args.addParents ?? null,
        removeParents: args.removeParents ?? null,
      });
      return { fileId: f.id, name: f.name, parents: f.parents ?? [], fileIdPreserved: f.id === args.fileId };
    }

    case 'docs_batch_update': {
      const out = await docs.batchUpdate(args.documentId, args.requests, {
        requiredRevisionId: args.requiredRevisionId,
      });
      return {
        documentId: args.documentId,
        fileIdPreserved: true,
        newRevisionId: out?.writeControl?.requiredRevisionId ?? null,
        applied: args.requests.length,
        note: 'The write was accepted. This is NOT verification — read the document back before reporting success.',
      };
    }

    case 'canonical_source_recovery':
      return resolvePinnedSource(drive, {
        key: args.key ?? null,
        pinnedFileId: args.pinnedFileId,
        expectedTitle: args.expectedTitle ?? null,
      });

    case 'canonical_doc_maintenance':
      return canonicalDocMaintenance({ drive, docs, client }, args);

    default:
      throw new GoogleApiError('UNKNOWN_TOOL', `no such tool: ${name}`);
  }
}
