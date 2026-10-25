# Lab authentication

Enable only in the isolated lab backend's external, root-owned settings:

```js
labAuth: {
  enabled: true,
  allowedOrigins: ['https://lab.metrik.fit', 'https://lab-api.metrik.fit'],
  sessionHours: 12,
  allowServiceKeePass: false,
},
listenHost: '127.0.0.1',
additionalMcpServers: {
  'chrome-devtools': {
    command: '/usr/local/bin/chrome-devtools-mcp',
    args: ['--browserUrl=http://127.0.0.1:9222', '--no-usage-statistics'],
  },
},
```

Build the lab frontend with `VITE_LAB_AUTH=true` and HTTPS API host `lab-api.metrik.fit`.
The backend gate protects all registered HTTP routes, raw attachment routes and WebSocket
upgrades. The inherited signup, login and password reset routes are disabled. Exact Origin
checks protect state changes and WebSocket upgrades. GET requests without Origin can retrieve
attachments only with a valid session. Preflight responses reveal no application data.

Sessions use 32 CSPRNG bytes; only a SHA-256 token hash is stored in `labSessions`. Passwords
use versioned scrypt hashes in `labUsers`. The `__Host-claude_lab_session` cookie is Secure,
HttpOnly, SameSite=Strict, Path=/, with no Domain attribute. It belongs only to the API host;
the two HTTPS lab hosts are same-site, so credentialed frontend requests still send it.
Do not enable access for untrusted origins. Login is limited by account and direct peer.
Profiles share projects and dashboard capabilities; personal login is not tenant isolation.

## Account administration

Run from the deployed backend using its selected settings environment:

```sh
environment=lab node --import ./register.mjs scripts/lab-user.mjs --secret-file /run/secrets/lab-admin-password
environment=lab node --import ./register.mjs scripts/lab-user.mjs --email colleague@example.com --role member --secret-file /run/secrets/lab-colleague-password
```

The initial email defaults to `at.tonchev@gmail.com`. Password files must use an absolute path
outside the repository. Store them mode 0600 under a root-only directory. Alternatively pipe
the password from a secret source and use `--stdin`; never supply it as an argument. The CLI
prints only account status and email. Add `--reset` to rotate a password and revoke sessions,
or `--email ... --disable` to revoke an account. New passwords require 14 to 1024 characters.

API WebSockets close immediately on logout, expire at session expiry, recheck authentication
for each message, and recheck idle connections every 30 seconds for account revocation.

## Shared browser gateway

Nginx can use an internal auth_request subrequest to `GET /api/v1/lab-auth/check`: it returns
200 for a valid cookie and 401 for a missing, expired or revoked session. Forward the Cookie
to that internal check, disable its request body, and forward no cookie to the subsequent
noVNC/websockify upstream. Keep IP/VPN restrictions around both frontend and API.

Accepted limitation: nginx checks a noVNC WebSocket only at handshake. An already-open VNC
connection can survive logout, account revocation or session expiry until disconnected.
The API WebSocket revocation logic does not control that separate proxy connection.

## MCP credentials and immutable releases

Each AI instance receives its own random service token only through environment variables.
The token permits its own dashboard updates and plans, and its own observer configuration.
KeePass credential retrieval is denied unless `allowServiceKeePass` is explicitly enabled.
There is no general localhost bypass. Tokens are revoked when the instance stops/exits.
Codex forwards the token environment variable by name rather than putting its value in argv.

Additional MCP servers come exclusively from trusted backend settings and accept only an
absolute stdio command and string args. Both providers receive the same browser MCP config.
Do not put secrets in command arguments. Before activating a root-owned release, generate
its exact MCP config as root with `setMcpApiPort`, `setAdditionalMcpServers` and
`ensureMcpConfig` from `backend/mcp/setupMcp.js`. Lab startup fails if that config cannot be
read or would need a write. Keep the release, config, tools and all their parents root-owned
and not writable by execution profiles or the backend account.
