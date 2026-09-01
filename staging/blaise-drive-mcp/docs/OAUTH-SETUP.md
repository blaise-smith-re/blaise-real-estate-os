# OAuth Setup

This is the one part of the build that **cannot be automated**. Google requires a human to see the
consent screen and approve the scopes.

## Scopes

```
https://www.googleapis.com/auth/drive            metadata read, copy, rename, move
https://www.googleapis.com/auth/documents        Docs read + batchUpdate
https://www.googleapis.com/auth/userinfo.email   account-binding check only
```

### Why `drive` and not `drive.file`

`drive.file` is the least-privilege Drive scope, and it does not work here. It grants access only
to files **the app itself created or the user explicitly opened with it**. Every canonical Blaise
document predates this connector, so `drive.file` cannot see any of them.

The narrower read scopes fail for a different reason: `drive.readonly` and `drive.metadata` cannot
copy, rename or move — and archive-before-edit requires all three. Google publishes no
"write to existing files only" scope.

So `drive` is the narrowest scope that supports the required operations, and it is genuinely broad:
it grants full access to the account's Drive. **That breadth is compensated in the connector, not in
the scope**:

| Control | Effect |
|---|---|
| `BLAISE_DRIVE_MODE=read-only` (default) | Every write tool refused at dispatch regardless of scope |
| Account binding | Refuses to act if the token's account ≠ `BLAISE_DRIVE_ACCOUNT_EMAIL` |
| Exact-target gates | fileId + expected title + Google Doc MIME + non-LEGACY, or no write |
| Archive-before-edit | A destructive mistake always has a snapshot behind it |
| Local operation allowlist | Only 5 Docs request kinds; whole-document deletion refused outright |

`userinfo.email` is requested solely so the server can prove which account it is bound to. It reads
an email address and nothing else.

## Setup

### 1. Enable the APIs

Google Cloud Console → **APIs & Services → Library** → enable:
- **Google Drive API**
- **Google Docs API**

### 2. Create an OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app.**

Copy the client ID and secret into `.env`:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

### 3. Consent, as the right account

> **Which account matters.** Canonical files live under two accounts
> (`bsmith@blaisesmithproperties.com` and `blaise@buysellhometeam.com`). Sign in as the one that
> **owns** the documents you intend to maintain. Consenting as the wrong account produces a server
> that authenticates fine and cannot see the files.

```bash
node scripts/authorize.js
```

It prints a consent URL, takes the code you paste back, and prints:

```
GOOGLE_OAUTH_REFRESH_TOKEN=...
BLAISE_DRIVE_ACCOUNT_EMAIL=...   # the account that actually consented — verify it
```

Add both to `.env`. Nothing is written to disk by the script, so it cannot leave a credential file
lying around to be committed by accident.

### 4. Verify before enabling writes

Leave `BLAISE_DRIVE_MODE=read-only` and confirm a read works end to end:

```bash
node src/server.js
# then: tools/call drive_get_file_metadata with a known canonical fileId
```

A successful metadata read proves credentials, scopes, account binding and network in one step.
Only then set `BLAISE_DRIVE_MODE=read-write`, and only for a session that needs it.

## If a service account looks tempting

It is the wrong tool here. A service account is a *separate identity* with its own empty Drive;
it would need every canonical document explicitly shared with it, and files it created would be
owned by the service account rather than by Blaise. Domain-wide delegation solves that only for
Workspace admins and grants far more than this connector needs. The refresh-token flow keeps the
documents owned by their real owner and the blast radius equal to one account's Drive.

## Rotation and revocation

- The refresh token is long-lived but not permanent — it dies on password change, scope change, or
  explicit revocation. The server surfaces that as `REAUTH_REQUIRED`; re-run `authorize.js`.
- Revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- Rotate by revoking, then re-running `authorize.js`. Nothing else needs to change.
