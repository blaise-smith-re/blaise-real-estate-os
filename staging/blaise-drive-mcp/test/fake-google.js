/**
 * In-memory fake of the Google Drive v3 + Docs v1 REST surface.
 *
 * This is a `fetch`-compatible function injected into GoogleClient, which is why the entire
 * adversarial suite runs offline with no credentials and no network. It models the behaviors the
 * connector actually depends on:
 *
 *   - revisionId advances on every mutation
 *   - batchUpdate rejects a stale writeControl.requiredRevisionId with a 400 naming "revision"
 *   - replaceAllText / insertText / deleteContentRange mutate real text
 *   - files.copy mints a new fileId and leaves the source untouched
 *   - files.patch renames and reparents in place, preserving the fileId
 *
 * WHAT IT DOES NOT PROVE: that Google behaves this way. It encodes the documented contract. Only a
 * live run against real Google APIs can certify that, and none has occurred — see docs/CERTIFICATION.md.
 */

'use strict';

let seq = 0;
const nextId = (p) => `${p}_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Build a Docs-shaped document body from plain text. Docs body content starts at index 1. */
export function bodyFromText(text) {
  const content = [{ startIndex: 0, endIndex: 1, sectionBreak: {} }];
  let index = 1;
  for (const line of String(text).split('\n')) {
    const withNl = line + '\n';
    content.push({
      startIndex: index,
      endIndex: index + withNl.length,
      paragraph: { elements: [{ startIndex: index, endIndex: index + withNl.length, textRun: { content: withNl } }] },
    });
    index += withNl.length;
  }
  return { content };
}

export function textFromBody(body) {
  let out = '';
  for (const el of body.content ?? []) {
    for (const pe of el.paragraph?.elements ?? []) out += pe.textRun?.content ?? '';
  }
  return out;
}

export class FakeGoogle {
  constructor({ accountEmail = 'blaise@buysellhometeam.com' } = {}) {
    this.files = new Map();   // fileId -> {id,name,mimeType,parents,trashed,modifiedTime}
    this.docs = new Map();    // fileId -> {revisionId, text}
    this.accountEmail = accountEmail;
    this.failures = [];       // queued injected failures
    this.calls = [];          // audit of every request
    this.tokenValid = true;
    this.refreshTokenValid = true;
  }

  // ---------------------------------------------------------------- seeding
  addDoc({ name, text = '', parents = ['folder_root'], trashed = false, id = null }) {
    const fileId = id || nextId('doc');
    this.files.set(fileId, {
      id: fileId, name, mimeType: 'application/vnd.google-apps.document',
      parents, trashed, modifiedTime: new Date().toISOString(),
      owners: [{ emailAddress: this.accountEmail }],
    });
    this.docs.set(fileId, { revisionId: nextId('rev'), text });
    return fileId;
  }

  addNonDoc({ name, mimeType = 'application/pdf', parents = ['folder_root'] }) {
    const fileId = nextId('file');
    this.files.set(fileId, {
      id: fileId, name, mimeType, parents, trashed: false,
      modifiedTime: new Date().toISOString(), owners: [{ emailAddress: this.accountEmail }],
    });
    return fileId;
  }

  /** Simulate someone else editing the document, which advances its revision. */
  concurrentEdit(fileId, appendText = '\n[edited by another user]') {
    const d = this.docs.get(fileId);
    d.text += appendText;
    d.revisionId = nextId('rev');
    return d.revisionId;
  }

  /** Queue a one-shot failure for the next request whose URL matches. */
  injectFailure({ match, status = 500, error = 'injected failure', reason = null, once = true }) {
    this.failures.push({ match, status, error, reason, once });
  }

  _takeFailure(url, method) {
    const i = this.failures.findIndex(f =>
      (typeof f.match === 'string' ? url.includes(f.match) : f.match(url, method)));
    if (i === -1) return null;
    const f = this.failures[i];
    if (f.once) this.failures.splice(i, 1);
    return f;
  }

  // ---------------------------------------------------------------- fetch
  get fetch() {
    return async (url, opts = {}) => this._handle(String(url), opts);
  }

  _json(status, obj) {
    return { ok: status >= 200 && status < 300, status, json: async () => obj };
  }
  _err(status, message, reason = null) {
    return this._json(status, { error: { code: status, message, status: reason, errors: reason ? [{ reason }] : [] } });
  }

  async _handle(url, opts) {
    const method = (opts.method || 'GET').toUpperCase();
    this.calls.push({ method, url });

    const injected = this._takeFailure(url, method);
    if (injected) return this._err(injected.status, injected.error, injected.reason);

    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (!this.refreshTokenValid) {
        return this._json(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
      }
      return this._json(200, { access_token: 'ya29.fake-' + nextId('tok'), expires_in: 3600 });
    }

    const auth = opts.headers?.authorization || '';
    if (!auth.startsWith('Bearer ')) return this._err(401, 'Missing credentials');
    if (!this.tokenValid) return this._err(401, 'Invalid Credentials', 'authError');

    if (url.includes('/oauth2/v2/userinfo')) return this._json(200, { email: this.accountEmail });
    if (url.includes('docs.googleapis.com')) return this._docs(url, method, opts);
    if (url.includes('/drive/v3/')) return this._drive(url, method, opts);
    return this._err(404, `unhandled URL ${url}`);
  }

  // ---------------------------------------------------------------- Drive
  _drive(url, method, opts) {
    const body = opts.body ? JSON.parse(opts.body) : null;
    const u = new URL(url);

    if (u.pathname.endsWith('/files') && method === 'GET') {
      const q = u.searchParams.get('q') || '';
      const nameMatch = q.match(/name\s*=\s*'((?:[^'\\]|\\.)*)'/);
      const wantName = nameMatch ? nameMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
      const excludeTrashed = /trashed\s*=\s*false/.test(q);
      const files = [...this.files.values()].filter(f => {
        if (wantName !== null && f.name.toLowerCase() !== wantName.toLowerCase()) return false;
        if (excludeTrashed && f.trashed) return false;
        return true;
      });
      return this._json(200, { files, incompleteSearch: false });
    }

    const copyMatch = u.pathname.match(/\/files\/([^/]+)\/copy$/);
    if (copyMatch && method === 'POST') {
      const src = this.files.get(decodeURIComponent(copyMatch[1]));
      if (!src) return this._err(404, 'File not found');
      const newId = nextId('doc');
      this.files.set(newId, {
        ...src, id: newId,
        name: body?.name || `Copy of ${src.name}`,
        parents: body?.parents || src.parents,
        modifiedTime: new Date().toISOString(),
      });
      const srcDoc = this.docs.get(src.id);
      if (srcDoc) this.docs.set(newId, { revisionId: nextId('rev'), text: srcDoc.text });
      return this._json(200, this.files.get(newId));
    }

    const permMatch = u.pathname.match(/\/files\/([^/]+)\/permissions$/);
    if (permMatch && method === 'GET') {
      return this._json(200, { permissions: [{ id: 'p1', type: 'user', role: 'owner', emailAddress: this.accountEmail }] });
    }

    const fileMatch = u.pathname.match(/\/files\/([^/]+)$/);
    if (fileMatch) {
      const id = decodeURIComponent(fileMatch[1]);
      const f = this.files.get(id);
      if (!f) return this._err(404, 'File not found');
      if (method === 'GET') return this._json(200, f);
      if (method === 'PATCH') {
        if (body?.name) f.name = body.name;
        const add = u.searchParams.get('addParents');
        const rem = u.searchParams.get('removeParents');
        if (add) f.parents = [...new Set([...(f.parents ?? []), ...add.split(',')])];
        if (rem) f.parents = (f.parents ?? []).filter(p => !rem.split(',').includes(p));
        f.modifiedTime = new Date().toISOString();
        return this._json(200, f);
      }
    }
    return this._err(404, `unhandled Drive route ${u.pathname}`);
  }

  // ---------------------------------------------------------------- Docs
  _docs(url, method, opts) {
    const u = new URL(url);
    const batch = u.pathname.match(/\/documents\/([^/:]+):batchUpdate$/);
    if (batch && method === 'POST') {
      const id = decodeURIComponent(batch[1]);
      const d = this.docs.get(id);
      if (!d) return this._err(404, 'Requested entity was not found.');
      const body = JSON.parse(opts.body);
      const required = body?.writeControl?.requiredRevisionId;

      if (required && required !== d.revisionId) {
        // Matches the real API's precondition failure, including the word the client keys on.
        return this._err(400,
          'Invalid requiredRevisionId: the document has been modified since the specified revision.');
      }

      let text = d.text;
      for (const req of body.requests ?? []) {
        if (req.replaceAllText) {
          const find = req.replaceAllText.containsText.text;
          text = text.split(find).join(req.replaceAllText.replaceText);
        } else if (req.insertText) {
          const at = Math.max(0, Math.min((req.insertText.location?.index ?? 1) - 1, text.length));
          text = text.slice(0, at) + req.insertText.text + text.slice(at);
        } else if (req.deleteContentRange) {
          const { startIndex, endIndex } = req.deleteContentRange.range;
          text = text.slice(0, Math.max(0, startIndex - 1)) + text.slice(Math.max(0, endIndex - 1));
        }
        // updateTextStyle / updateParagraphStyle are formatting-only: accepted, no text change.
      }
      d.text = text;
      d.revisionId = nextId('rev');
      const f = this.files.get(id);
      if (f) f.modifiedTime = new Date().toISOString();
      return this._json(200, { documentId: id, writeControl: { requiredRevisionId: d.revisionId } });
    }

    const get = u.pathname.match(/\/documents\/([^/:]+)$/);
    if (get && method === 'GET') {
      const id = decodeURIComponent(get[1]);
      const d = this.docs.get(id);
      const f = this.files.get(id);
      if (!d || !f) return this._err(404, 'Requested entity was not found.');
      return this._json(200, {
        documentId: id, title: f.name, revisionId: d.revisionId, body: bodyFromText(d.text),
      });
    }
    return this._err(404, `unhandled Docs route ${u.pathname}`);
  }
}

/** Standard env for tests. No real credential shapes, no real values. */
export function fakeEnv(overrides = {}) {
  return {
    GOOGLE_OAUTH_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_OAUTH_REFRESH_TOKEN: 'test-refresh-token',
    BLAISE_DRIVE_ACCOUNT_EMAIL: 'blaise@buysellhometeam.com',
    BLAISE_DRIVE_MODE: 'read-write',
    ...overrides,
  };
}

/** The synthetic certification document from the build spec §10. */
export const SYNTHETIC_DOC_TEXT = [
  '[TEST] Claude Drive MCP Canonical Maintenance',
  '',
  'Version: 1.0',
  'Updated: 2026-09-01',
  '',
  'SECTION A',
  'Original text',
  '',
  'SECTION B',
  'Old link: https://example.invalid/old',
  '',
  'CHANGE LOG',
].join('\n');
