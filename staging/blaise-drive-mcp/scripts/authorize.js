#!/usr/bin/env node
/**
 * One-time OAuth bootstrap: obtain a refresh token for the Drive account that owns the canonical
 * documents.
 *
 * This is the ONE step that cannot be automated — Google requires a human to see the consent
 * screen and approve the scopes. Run it once; the refresh token it prints goes in `.env` and is
 * long-lived.
 *
 *   node scripts/authorize.js
 *
 * Prints a URL, waits for the code you paste back, exchanges it, prints the refresh token.
 * Nothing is written to disk — you copy the value into .env yourself, so this script never
 * creates a credential file that could be committed by accident.
 */

'use strict';

import { createInterface } from 'node:readline';
import { REQUIRED_SCOPES, TOKEN_ENDPOINT } from '../src/google/client.js';

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // manual copy/paste flow
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.');
  console.error('Create them at: Google Cloud Console > APIs & Services > Credentials >');
  console.error('Create credentials > OAuth client ID > Desktop app.');
  console.error('See docs/OAUTH-SETUP.md.');
  process.exit(2);
}

const url = `${AUTH_ENDPOINT}?` + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: REQUIRED_SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent', // force a refresh token even on re-authorization
}).toString();

console.log('\n1. Open this URL while signed in as the account that OWNS the canonical documents:\n');
console.log(url);
console.log('\n2. Approve the scopes:\n');
for (const s of REQUIRED_SCOPES) console.log('   - ' + s);
console.log('\n3. Paste the authorization code below.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Authorization code: ', async (code) => {
  rl.close();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.refresh_token) {
    console.error('\nExchange failed:', json.error || res.status, json.error_description || '');
    if (json.access_token && !json.refresh_token) {
      console.error('Got an access token but no refresh token — re-run; prompt=consent is required.');
    }
    process.exit(1);
  }

  // Confirm which account actually consented. Approving as the wrong Google account is an easy
  // mistake and produces a server bound to the wrong Drive.
  const who = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${json.access_token}` },
  }).then(r => r.json()).catch(() => ({}));

  console.log('\nSuccess. Add these to .env:\n');
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${json.refresh_token}`);
  if (who.email) console.log(`BLAISE_DRIVE_ACCOUNT_EMAIL=${who.email}`);
  console.log('\nConsented account:', who.email || '(could not read)');
  console.log('Verify that is the account that owns the canonical documents before using this token.');
  console.log('\nThe refresh token is a credential. Do not commit it, paste it into chat, or log it.\n');
});
