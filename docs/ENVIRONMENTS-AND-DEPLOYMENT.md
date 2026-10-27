# Claude IDE: environments, deployment and update recovery

Operational reference, verified **2026-10-27**. Update the dated release record after the next
deployment; do not infer the running version from the branch name. This document contains
paths and configuration contracts, never passwords, connection strings or session tokens.

## One application, three installations

Keep application changes in `master`. Local/server behavior comes from installation settings,
not divergent implementations or a dashboard switch that changes databases under a running
session. The Lab worktree is a staging convenience, not a separate product.

| Installation | Source / runtime | UI | API and database |
|---|---|---|---|
| Windows development | `D:\development\own\claude-ide` (`master`), nodemon + Vite | `http://localhost:3030` | `6960`, `claude-ide-dev` |
| Windows live | `D:\Programs\claude-ide`, pm2 | `http://localhost:3010` | `6950`, `claude-ide` |
| Linux Lab | `/srv/metrik-lab/current`, systemd + Nginx | `https://lab.metrik.fit` | `https://lab-api.metrik.fit/api/v1`, loopback `6950`, `claude_lab` |

`D:\development\own\claude-ide-lab` is the same Git repository's worktree on
`codex/netcup-lab-20261025`. Before the documentation update, both branches pointed to
`c55bb564c84d23531467f97e31f41155dc2aeee2`. Prefer fast-forwarding reviewed changes between
them; don't create permanent Windows-only and Linux-only branches. A local commit/merge is
not a Git remote push or a runtime deployment.

Metrik Fit (`D:\development\own\metrik-fit`) is a different application. Its production site,
Lab workspaces and dev1/dev2/dev3 processes must not be redeployed/restarted by a Claude IDE
deployment. The shared host does not make their releases interchangeable.

## Configuration ownership

- Backend: git-ignored `backend/settings.js`. `process.env.environment` selects its matching
  entry; when unset, the code uses `settings.local`. The named entry must exist. Port, Mongo
  connection, database, encryption key and upload directory belong to that install. Do not
  use a generic `PORT` variable: spawned project servers inherit it.
- Frontend: Vite values are compiled at build time. Changing backend settings cannot change
  the API URL or login gate in an already-built bundle. Keep overrides out of tracked files.
- `labAuth` and `VITE_LAB_AUTH` are historical names for **shared authentication**, including
  Windows. They do not require Linux execution profiles. Enable the backend and frontend
  sides together; provision a user in the selected database before activating the login gate.
- `executionProfiles` is a separate, optional Linux feature. Omit it on Windows. Profile IDs
  persist with instances and select the OS account/home; they are not tenant boundaries.
- See [LAB-AUTH.md](LAB-AUTH.md) for complete auth fragments, user provisioning, origins,
  cookies and session revocation; see [EXECUTION-PROFILES.md](EXECUTION-PROFILES.md) for the
  privileged runner contract and profile policies.

Windows HTTP authentication requires `allowLoopbackHttp: true`, exact loopback HTTP origins
and a literal `127.0.0.1` or `::1` backend bind. Lab keeps HTTPS and the Secure `__Host-` cookie.
Use `localhost` consistently for local UI/API. Local/dev cookies on the same hostname share
their name despite different ports; logging into one can require logging into the other again.
Account data is separate in each install's database; unification does not synchronize users.

Lab frontend build overrides (`frontend/.env.production.local`, or equivalent build env):

```dotenv
VITE_IDE_ENVIRONMENT=lab
VITE_LAB_AUTH=true
VITE_SERVER_PROTOCOL=https
VITE_SERVER_HOST=lab-api.metrik.fit
VITE_SERVER_PORT=
VITE_SERVER_PATH=/api
VITE_HOST_SAME_URL=false
VITE_API_VERSION=v1
```

Tracked `.env.production` supplies `VITE_ENVIRONMENT=prod`, but its default API points at
Windows localhost. Never publish a Lab bundle without the overrides above. Conversely, never
reuse a Lab bundle for Windows live. For Windows live use HTTP localhost, port `6950`, and
`VITE_LAB_AUTH=true` when activating the prepared local authentication. Dev uses port `6960`.
Keep environment overrides in the build workspace so one target cannot contaminate the next.

### Tab names, colored icons and installed app identity

`VITE_IDE_ENVIRONMENT` is a **frontend branding** setting, independent of backend settings,
authentication and execution profiles. It does not switch APIs or databases.

| Value | Browser / PWA name | Icon and browser theme color |
|---|---|---|
| `local` | Claude IDE · Local | Blue `#2563EB` |
| `lab` | Claude IDE · Lab | Purple `#7C3AED` |
| `dev` | Claude IDE · Dev | Orange `#EA580C` |

If omitted, Vite development mode uses `dev`; production builds use `local`. Lab builds must
explicitly set `lab`. Invalid values fail the build. `frontend/branding.json` holds the shared
names/colors; `frontend/branding.mjs` resolves the build profile; Vite uses it for the initial
HTML title, favicon, Apple touch icon and generated `manifest.webmanifest`. React uses the
same `appBranding` helper, including dashboard, plan and instance-window titles. Instance
status stays in its title; it does not replace the environment's identifying color.

SVG icons and 32/192/512px PNG fallbacks live in `frontend/public/branding/`. To regenerate them
after changing colors, run `frontend/scripts/generate-branding-icons.ps1` on Windows. The
existing hexagon mark stays the same in every environment. The old public `manifest.json`
and generic icons are legacy assets for cached clients; new HTML uses only the generated
environment-specific manifest. Do not add a second manifest link to `index.html`.

Changing this branding needs only a frontend build and static deployment. **No backend
restart or new database settings are needed.** Browser tabs adopt it after Update/reload;
already-installed app names/icons can follow the browser/OS manifest update schedule.

## Verified release record — 2026-10-27

| Item | Verified value |
|---|---|
| Backend application commit | `c55bb564c84d23531467f97e31f41155dc2aeee2` |
| Backend release / current symlink | `/srv/metrik-lab/current` → `/srv/metrik-lab/releases/ide-unified-c55bb56` |
| Frontend application commit | `3b80325` (environment names/icons; no backend changes) |
| Frontend release / current symlink | `/srv/metrik-lab/ui-current` → `/srv/metrik-lab/releases/ide-ui-3b80325` |
| Nginx UI root | `/srv/metrik-lab/ui-current/frontend/build` |
| Main UI script | `/static/index-DoNHh78S.js` |
| Previous backend release | `/srv/metrik-lab/releases/ide-20261025` |
| Previous served UI root | `/srv/metrik-lab/releases/ide-ui-browser-login-20261026-v2/frontend/build` |
| Deployment rollback files | `/srv/metrik-lab/deploy-backups/unified-c55bb56` |
| Frontend-only rollback files | `/srv/metrik-lab/deploy-backups/ui-3b80325` |
| Windows live | Intentionally not deployed or restarted during this rollout |

The unified rollout originally pointed both components through `current`. The later branding
update introduced `ui-current` so frontend-only changes can ship without restarting backend
instances. Both components still come from the same source history. Read `current/REVISION`
for backend and `ui-current/REVISION` for frontend, plus the served asset hashes. Neither a
documentation commit nor a frontend-only commit requires a new backend deployment.

Changes included:

- `043b416`: shared local/Lab auth, plan validation and request IP parsing fixes.
- `72e79ad`: `.gitattributes` forces LF for Python/shell scripts. An initial Lab attempt failed
  because Windows archive conversion put CRLF in the runner shebang; automatic rollback
  restored the old release. The final release includes the permanent fix and regression test.
- `c55bb56`: service worker activation and Update UI fixes, including translations.
- `3b80325`: Local/Lab/Dev names and colored favicon/PWA icons. Deployed **frontend only**;
  backend PID `4182625` and its `2026-10-27 09:56:21 CET` start time stayed unchanged.
  Browser Update loaded `Claude IDE · Lab`, theme `#7C3AED`, and the new bundle successfully.
  Local branding remains staged in source until the deferred Windows deployment.

Verified: 60 JavaScript tests on Windows; 35 relevant JavaScript and 11 Python tests on Linux;
production frontend build; live authenticated API/WS, profile terminal launch/stop, attachment
upload/download/delete and anonymous denial; real plan insertion, Mongo persistence and
`plan_saved` delivery; invalid-plan rejection; session revocation. Two existing remembered
AI session records were preserved, and temporary test plans were removed.

Browser verification: new Update activated the new worker; subsequent refresh kept the new
bundle without repeating the update prompt. Another open tab retained its loaded old bundle
until its own refresh. This verifies that updating one tab does not navigate all tabs.

## Lab host layout

| Component | Location / responsibility |
|---|---|
| Service | `claude-ide-lab.service`, user/group `claude-lab`, `environment=lab` |
| Working directory | `/srv/metrik-lab/current/backend` |
| Static UI | `/srv/metrik-lab/ui-current/frontend/build` (independent frontend release) |
| Node | `/opt/metrik-lab/node-v24.14.0/bin/node` |
| Backend settings | `/etc/claude-ide/settings.js`, symlinked from each release's `backend/settings.js` |
| Build overrides | `/etc/claude-ide/frontend.env` |
| Profile config | `/etc/claude-ide/execution-profiles.json` |
| Runner | `/usr/local/sbin/claude-ide-profile-runner` |
| Profile session lookup | `/srv/metrik-lab/current/backend/src/modules/instanceManager/profileSessionLookup.mjs` |
| CLI tools | `/opt/metrik-lab/tools/node_modules/.bin` |
| Shared projects | `/srv/metrik-lab/workspaces` |
| Uploads / retained files | `/srv/metrik-lab/uploads` (`instances/` and `shared/`) |
| Nginx config | `/etc/nginx/sites-available/metrik-lab` |

Actual profiles: `claude1` and `codex` use `lab-anton`; `claude2` uses `lab-colleague`.
Do not reassign these IDs to different homes: resumed conversations depend on their original
profile. Read the root-owned configuration for current CLI policy, rather than copying example
usernames from the generic profile guide. Homes remain private; projects are shared.

The release, runner, tools and parent directories must be root-owned and not group/other
writable. Settings retain their restricted permissions. Generate each release's MCP config
as root before activation; the service cannot write into an immutable release. Never copy
Windows `node_modules` to Linux. This release reused the working Linux backend dependencies;
it did not perform an unreviewed fresh dependency upgrade. A fresh backend install can resolve
newer transitive dependencies, so test it separately (the fast-uri issue exposed this).

## Lab deployment procedure

This is the procedure used for the rollout, not a claim that a tracked one-command Lab
deployment script exists. `scripts/deploy-live.mjs` targets **Windows**, never Lab.

1. Read this document and confirm the requested target. Check Git status in both worktrees;
   don't include untracked `temp/` archives or unrelated application changes. Commit reviewed
   source and fast-forward the other worktree so both use the same application commit.
2. Record the active release and configuration. Prepare a root-only backup directory containing
   the Nginx site file, profile JSON, installed runner and previous release path. Preserve
   session metadata; a backend restart stops Lab PTYs even though AI records remain resumable.
3. Run the tests below. Build the frontend from the exact commit with Lab overrides. A clean
   scratch build is useful on Windows; do not place scratch files inside watched `backend/`.
4. Export tracked source with `git archive`; package the built UI separately. On Windows use
   `C:\Windows\System32\tar.exe` to avoid Git Bash tar interpreting a drive letter as a host.
   Retain `.gitattributes`; inspect the runner shebang/line endings in the extracted artifact.
   Compare local/uploaded SHA-256 hashes.
5. Extract into a **new** `/srv/metrik-lab/releases/ide-<revision>` directory. Supply compatible
   Linux dependencies, link external settings, and install the new UI at `frontend/build`.
   Preserve old hashed assets for already-open tabs without overwriting the new entrypoint or
   worker. Keep the old release available for rollback. Write the source commit to `REVISION`.
6. From the new release's backend, generate MCP configuration using the actual Lab Node binary:

   ```sh
   environment=lab /opt/metrik-lab/node-v24.14.0/bin/node --import ./register.mjs --input-type=module - <<'JS'
   import settings from './settings.js';
   import { setMcpApiPort, setAdditionalMcpServers, ensureMcpConfig } from './mcp/setupMcp.js';
   setMcpApiPort(settings.lab.port);
   setAdditionalMcpServers(settings.lab.additionalMcpServers);
   ensureMcpConfig();
   JS
   ```

7. Apply root ownership/read-only code permissions; MCP JSON is readable, settings keep their
   existing restricted ownership. Run Linux tests against the extracted code/dependencies.
   Install the matching runner and keep profile `sessionLookup` pointing through `current`.
8. Validate Nginx with `nginx -t`. For a full release, atomically replace `current` and
   `ui-current` using temporary symlinks in the same directory and `mv -T`, both pointing at
   the new release containing backend and built frontend. Restart **only**
   `claude-ide-lab.service`; reload Nginx if its configuration changed. Arm rollback for
   startup or smoke-test failure. For frontend-only work use the procedure below instead.
9. Verify anonymous auth status, authenticated HTTP/WS, profile launch/stop, plan save and
   attachments. Use disposable test records and remove only those records. Check existing
   session IDs survived. Verify UI/SW hashes, MIME types and cache headers over HTTPS, then
   test Update in a browser. Check service restart count and logs before reporting success.
10. Record the deployed commit, release path, build hashes, backup path and checks here. A
    browser can retain an old bundle even when Nginx serves the newest release.

On-host HTTPS checks use the configured VPN listener, retaining TLS validation and SNI:

```sh
curl --resolve lab.metrik.fit:443:10.88.0.1 -I https://lab.metrik.fit/service-worker.js
curl --resolve lab-api.metrik.fit:443:10.88.0.1 https://lab-api.metrik.fit/api/v1/lab-auth/session
systemctl show claude-ide-lab.service -p ActiveState -p MainPID -p NRestarts
readlink -f /srv/metrik-lab/current
cat /srv/metrik-lab/current/REVISION
readlink -f /srv/metrik-lab/ui-current
cat /srv/metrik-lab/ui-current/REVISION
```

The anonymous session response should report `ok: true`, `enabled: true`, `user: null`.
It is not proof of authenticated functionality; protected routes must still reject anonymous
requests. New and retained hashed JS assets should return 200; public source maps return 404.

Existing operator transport helpers live in the **Metrik Fit** checkout's `private/`:
`_ssh_debug.cjs` (remote read/commands), `_ssh_sudo.cjs` (root script via stdin), and
`_sftp_put.cjs` (upload). Their `production` argument selects the shared Netcup host, not
permission to deploy the Metrik production application. They load private credentials;
never print or commit their environment files. Recheck their availability before use.
When piping a Bash script from PowerShell, strip CR characters and append a final comment:

```powershell
($remoteScript.Replace("`r", '').TrimEnd() + "`n# end") | node private/_ssh_sudo.cjs production
```

Here the backticks are PowerShell escape characters (use a literal single-quoted here-string
for the Bash body); no shell interpolation of secrets is needed.

### Frontend-only updates (no backend restart)

Build from the desired commit with Lab overrides, including `VITE_IDE_ENVIRONMENT=lab`.
Extract into a new `releases/ide-ui-<revision>/frontend/build` and write that commit into
the release's `REVISION`. Preserve old hashed assets alongside the new ones, without replacing
new files. Back up the previous UI symlink target, Nginx config and frontend build env. Atomically
switch **only** `ui-current`; keep `current`, settings, profile runner and all backend code
untouched. Nginx already serves through `ui-current`, so subsequent symlink switches need no
config change or reload. Never run `systemctl restart claude-ide-lab.service` for this path.

If changing Nginx configuration, `nginx -t` and reload it gracefully. Poll the expected HTML
hash briefly: the first request immediately after reload can still hit an old worker. This
happened during the initial branding switch and must not be confused with a broken artifact.
Verify entrypoint, worker, manifest, icon assets, browser Update and unchanged backend
PID/start time. Existing installed PWA metadata may update on the browser/OS's own schedule.

For the branding release, archive SHA-256 is
`c54b5733bdc9e7c99002e0935e2830b419a6457025a3894218a4080bc3bae38e`;
served HTML SHA-256 is `7de4932792c8a2fe55087dc29c1aadfbc8f30e9d1c323664261d912a1330be05`.

### Rollback

For a **frontend-only** release, restore its previous UI target and any changed Nginx/frontend
env files, then verify the old UI is served. Reload Nginx only if its config changed; do not
restart the backend. The `ui-3b80325` backup contains `nginx`, `frontend.env`,
`previous-ui-release` and `backend-pid`. Its preceding UI is in the `ide-unified-c55bb56` release.

For a **full backend/UI** release:

Restore the selected deployment's saved Nginx site, profile configuration and installed runner;
atomically repoint `current` and the UI target to their recorded previous releases; validate/reload Nginx and
restart only the Lab IDE service. Then repeat health and UI checks. Do not restore/delete
databases or user files as part of code rollback. A future database migration needs its own
rollback plan; this rollout did not introduce a data migration.

For `c55bb56`, backups are `unified-c55bb56/{nginx,profiles.json,runner,previous-release}`
under `/srv/metrik-lab/deploy-backups`. The earlier attempt's protected
`unified-043b416/instances-before.json` is a historical instance metadata snapshot, not a
complete database backup. Staging releases `ide-unified-043b416` and `ide-unified-72e79ad`
are not the active release. Do not select the newest-looking directory name blindly.

## PWA Update: implementation and recovery

The old worker destructured nonexistent `currentCacheName`/`otherCacheNames` fields and failed
before `CACHE_PREPARED`. The old client also raced activation by reloading immediately after
posting a message. Metrik's flow was reviewed; Claude IDE now waits for actual control rather
than relying on a fixed delay.

| File | Responsibility |
|---|---|
| `frontend/src/serviceWorkerRegistration.js` | Production registration of `/service-worker.js`, `updateViaCache: 'none'`, update discovery |
| `frontend/src/components/helpers/SWHelper.js` | Current-page registration, direct `SKIP_WAITING`, wait for that worker to become controller, single reload, timeout/retry |
| `frontend/src/service-worker.js` | Workbox revisioned precache, app-scoped cache names, `clientsClaim`, awaited worker messages, legacy sender-only reload |
| `frontend/src/screens/update/VersionDetector.jsx` | Later/Update prompt, progress and retryable error |
| `tests/pwa-update.test.mjs` | Activation ordering, duplicate clicks, retry, installing worker and no unsolicited other-tab reload |

Do not restore manual HTML copying across caches, global cache deletion or a static env string
as the release identity. Workbox manifest revisions identify changed assets. The legacy
`VITE_VERSION_UNIQUE_STRING` is no longer used by this worker. Do not automatically reload all
tabs or activate a worker during `beforeunload`.

Nginx serves `/service-worker.js` as JavaScript with
`Cache-Control: no-cache, no-store, must-revalidate` and `try_files $uri =404`, so a missing
worker never silently becomes SPA HTML. `index.html` is `no-store`. Verify these on other
hosting setups too; the Windows rollout's headers still need verification at deployment.

**One-time recovery for an already-cached old UI + old active worker:** open
`https://lab.metrik.fit/index.html?update=c55bb56`, then click **Update**. This was verified in
the browser. Use a fresh revision in the query for a later recovery. Plain `/index.html` alone
was still served by the old precache; the query is essential to bypass that old entry while
the file extension bypasses its app-shell navigation route. It loads the new UI that can
activate the waiting worker. Subsequent normal refreshes then use the new worker. This does
not stop backend instances, erase authentication or require clearing every site's cache.

## Plans and request validation

`backend/src/modules/validation/Validations.js` caches compiled validators in a `Map` keyed by
serialized schema. Do not pass serialized JSON to `ajv.addSchema/getSchema` as a schema URI:
newer Ajv/fast-uri throws `URI scheme is malformed`. The regression was reproduced with
Ajv 8.20.0; the fix was tested against the older local and current Linux dependencies.

`backend/mcp/server.js` saves `/plans/add` first and marks the instance `plan_ready` only after
success. `PlanController.create` persists `instance_id` and emits `plan_saved` after insertion.
MCP tokens remain scoped to their own instance/project. `tests/plan-validation.test.mjs` and
`tests/ai-provider.test.mjs` cover the validation, persistence/event ordering and MCP routing.

`backend/startup/startupHelpers/setupContext.js` handles native IPv4, mapped IPv6 and native
IPv6; `toIPv4Address()` is called only for mapped IPv6. `tests/request-ip.test.mjs` covers all
these forms and loopback. The old unconditional conversion produced noisy request errors.

## Tests and pending Windows rollout

With dependencies installed, from repository root:

```sh
node --test "tests/*.test.mjs"
python3 -m unittest discover -s tests -p 'test_*.py'
```

Use Node 24's quoted test glob. Python tests were run on Linux (Python was unavailable on the
Windows host during this rollout). The Lab worktree initially had no dependency installation;
Windows tests used `NODE_PATH` pointing to the main checkout's frontend/backend `node_modules`,
and its isolated frontend build used the matching main frontend dependencies. Do not confuse
missing worktree dependencies with a source regression. Run frontend ESLint from `frontend/`
so its `@` alias resolves. Builds require explicit user authorization for the target.

**Still pending at the user's request:** Windows live deployment and activation of its login.
The user must finish/stop the other local instances and authorize that final step. Until then,
do not copy to `D:\Programs\claude-ide`, restart its pm2 processes or flip its auth settings.
Code support and configuration examples are ready; local accounts/settings were not activated
by the Lab rollout. Existing local processes stayed running throughout.

At that final step: preserve live settings and data; configure loopback auth and provision the
local account as described in LAB-AUTH.md; build with Windows live API/login settings; use
`npm run deploy:live` only with the user's live authorization; verify login, API/WS, Claude and
Codex launch/resume, plans, upload access and browser Update. The deployment script preserves
the existing live settings, so enabling auth is an explicit configuration step, not an automatic
consequence of copying new code. `--frontend-only` cannot deliver the backend validation/auth
changes. Never copy the server settings, credentials or Linux profile list into Windows.

Editing **any** file under a checkout's `backend/` can restart its nodemon dev process and PTYs.
Check port 6960 and its child processes before such edits. Documentation belongs here or at
repository root; deployment scratch material belongs in `temp/`, not in watched backend code.
