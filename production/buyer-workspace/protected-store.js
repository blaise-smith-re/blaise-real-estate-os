'use strict';

// Short-lived sessions and write receipts, not a client database. Only encrypted
// envelopes reach disk. The key belongs in the host's secret environment store.
const { DatabaseSync } = require('node:sqlite');
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

class ProtectedStore {
  constructor({ directory, key, now = Date.now }) {
    if (!path.isAbsolute(directory || '') || typeof key !== 'string' || key.length < 43 || key.length > 512 || /\s/.test(key)) throw new Error('Protected storage needs an absolute persistent path and a securely generated encryption secret.');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.key = createHash('sha256').update(key).digest();
    this.now = now;
    // Hold an OS-released SQLite lock for the process lifetime. A second worker
    // fails closed, preventing concurrent use of a rotating refresh credential.
    this.owner = new DatabaseSync(path.join(directory, 'owner.sqlite'));
    try { this.owner.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); }
    catch { this.owner.close(); throw new Error('Another workspace process owns this session store.'); }
    try {
      this.db = new DatabaseSync(path.join(directory, 'sessions.sqlite'));
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, envelope BLOB NOT NULL);');
      this.prune();
    } catch (e) { this.owner.close(); throw e; }
  }
  id(value) { return createHash('sha256').update(value).digest('hex'); }
  put(id, value, expires) {
    if (!Number.isSafeInteger(expires) || expires <= this.now()) throw new Error('Session lifetime is invalid.');
    const name = this.id(id), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`${name}:${expires}`));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    const envelope = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires, envelope=excluded.envelope').run(name, expires, envelope);
  }
  get(id) {
    const name = this.id(id), row = this.db.prepare('SELECT expires, envelope FROM sessions WHERE id=?').get(name);
    if (!row) return null;
    if (row.expires <= this.now()) { this.delete(id); return null; }
    try {
      const b = Buffer.from(row.envelope), decipher = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
      decipher.setAAD(Buffer.from(`${name}:${row.expires}`)); decipher.setAuthTag(b.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString());
    } catch { throw new Error('Protected session could not be opened. The session key or stored data changed.'); }
  }
  delete(id) { this.db.prepare('DELETE FROM sessions WHERE id=?').run(this.id(id)); }
  prune() { this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(this.now()); }
  close() { this.db.close(); this.owner.close(); this.key.fill(0); }
}
module.exports = { ProtectedStore };
