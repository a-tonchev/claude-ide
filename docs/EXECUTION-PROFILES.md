# Linux execution profiles

For actual Lab paths/profile accounts, deployment and rollback, see
[ENVIRONMENTS-AND-DEPLOYMENT.md](ENVIRONMENTS-AND-DEPLOYMENT.md). The provisioning examples below
are generic; do not overwrite an existing host's settings with their sample identities.

Each AI/terminal card selects a server-owned execution profile. The session's profile ID is
stored on the instance record and group item. Resume uses the stored ID, never a new client
selection. Removing a profile prevents resume; IDs must never be reassigned to another OS home.
Old records without a profile fail closed when profiles are enabled: an administrator must
assign their original profile ID after verifying the transcript home.

The feature is disabled when `settings.js.executionProfiles` is absent. Existing local
Windows behavior remains available in that mode. Linux profile terminals use Bash.

## Backend settings

```js
executionProfiles: [
  { id: 'claude1', label: 'Claude 1' },
  { id: 'claude2', label: 'Claude 2' },
  { id: 'codex', label: 'Codex' },
],
defaultExecutionProfileId: 'claude1',
executionProfileRunner: '/usr/local/sbin/claude-ide-profile-runner',
```

The browser receives only IDs/labels. Usernames, homes, executable paths and project roots
come from a separate root-owned configuration. Backend settings do not grant root command
execution: the helper independently resolves profile IDs and always runs the actual CLI as an
unprivileged user. A profile selects a login/home, independently of the AI provider selection.

## Host provisioning

Requires a Linux host with systemd, sudo, Python 3 and Node. Keep the backend nonroot. Create
three unprivileged OS users with distinct private homes (example names below); log in to each
CLI under its intended user. Install CLI executables globally in root-owned paths. Give all
profile users and the backend shared-group/ACL access to `/srv/metrik-lab/workspaces`, including
its `dev1`, `dev2`, `dev3` Git folders. Project access is shared; credential homes are private.
Configure Git safe.directory for the shared repositories for each user if ownership differs.

Install `scripts/execution-profile-runner.py` as root:root mode 0755 at
`/usr/local/sbin/claude-ide-profile-runner`. The backend installation, Node binary, CLI binaries
and every ancestor of those files must be root-owned and not writable by group/others. The
session lookup helper imports `sessionFiles.js`, so the entire backend code directory must be
root-owned and read-only to both the backend service user and the execution users. Give the
backend write access only to uploads/runtime data and shared project folders. Precreate its
exact MCP config as root; the source tree and generated MCP config remain read-only. Keep
`/srv/metrik-lab` itself root:root 0755: a writable parent permits replacing a protected release.
Profile homes must be mode 0700. Do not make the source tree group-writable.

Create `/etc/claude-ide/execution-profiles.json` as root:root mode 0644:

```json
{
  "installId": "metrik-lab",
  "node": "/usr/local/bin/node",
  "sessionLookup": "/opt/claude-ide-lab/backend/src/modules/instanceManager/profileSessionLookup.mjs",
  "projectRoots": ["/srv/metrik-lab/workspaces"],
  "profiles": {
    "claude1": {
      "username": "lab-claude1", "home": "/home/lab-claude1",
      "claudeBypassPermissions": true,
      "codexSandbox": "danger-full-access",
      "path": "/usr/local/bin:/usr/bin:/bin",
      "commands": { "claude": "/usr/local/bin/claude", "codex": "/usr/local/bin/codex" }
    },
    "claude2": {
      "username": "lab-claude2", "home": "/home/lab-claude2",
      "claudeBypassPermissions": true,
      "codexSandbox": "danger-full-access",
      "path": "/usr/local/bin:/usr/bin:/bin",
      "commands": { "claude": "/usr/local/bin/claude", "codex": "/usr/local/bin/codex" }
    },
    "codex": {
      "username": "lab-codex", "home": "/home/lab-codex",
      "codexSandbox": "danger-full-access",
      "path": "/usr/local/bin:/usr/bin:/bin",
      "commands": { "claude": "/usr/local/bin/claude", "codex": "/usr/local/bin/codex" }
    }
  }
}
```

Replace install paths and OS usernames as appropriate. Homes must match `/etc/passwd` exactly.
Keep `installId` unique to this backend installation; startup sweeps only service units with
this prefix. Root configuration and all its ancestor directories must reject group/other write.

For a backend service account named `claude-lab`, install this sudoers entry via `visudo`:

```sudoers
Defaults!/usr/local/sbin/claude-ide-profile-runner env_keep += "CLAUDE_IDE_LAUNCH_DATA"
claude-lab ALL=(root) NOPASSWD:NOSETENV: /usr/local/sbin/claude-ide-profile-runner
```

This permission applies only to the root-owned validated helper, which accepts four fixed
operations. Never grant SETENV: dynamic loader variables can execute code as root before a
Python script runs. The command-specific env_keep forwards only the launch payload; normal
sudo env_reset filtering remains enabled. Python isolated mode additionally blocks Python
environment injection. The helper discards inherited environment before launching. Never grant sudo access to Python, Node,
systemctl, systemd-run, runuser, env, or a shell directly.

## Launch and cleanup contract

`launch` receives a JSON request through the single preserved `CLAUDE_IDE_LAUNCH_DATA`
environment variable. It contains profile ID, instance UUID, kind (`claude`, `codex`,
`terminal`), cwd, argument array and an allowlisted environment. Credentials never enter this
helper's argv or temporary files. The helper validates cwd against the shared project roots
and the selected user's home, then invokes `systemd-run --pty --wait` with fixed executable
paths, explicit UID/GID and private HOME/config locations. These are trusted collaborator
units: they must retain access to a separately validated, allowlisted lab service helper via
sudo. Do not set NoNewPrivileges on these agent units; restrict the sudo commands themselves.

Each instance gets `claude-ide-<installId>-<profileId>-<instanceUUID>.service`. `stop` targets that
exact service cgroup, including reparented descendants. Graceful backend shutdown stops these
services synchronously. `sweep` stops this installation's leftover services before the backend
starts accepting connections. No process-name matching or stale PID snapshots are used for
profile processes. Natural CLI exit also ends its service cgroup.

`lookup <profileId> <queryJson>` drops all root privileges and executes the fixed session helper
as that user. It returns only transcript existence or a Codex session UUID. The backend needs
no read permission on the profile's private credentials or conversation directories.

Before a Codex launch the runner creates the configured `.codex` directory with mode 0700
as the profile user. Codex refuses to start when an explicit `CODEX_HOME` does not exist.
The runner does not create or chown this directory as root; existing credentials are preserved.

Optional launch policies belong only to this root-owned profile JSON. An actual boolean
`claudeBypassPermissions: true` adds Claude's `--dangerously-skip-permissions` on fresh and resumed
launches. It has no effect on terminals or Codex. Omitted/false leaves Claude's flags unchanged.

`codexSandbox` accepts only `read-only`, `workspace-write`, or `danger-full-access`. The trusted
development lab selects `danger-full-access` so its existing Linux users can invoke the constrained
sudo service helper. This passes only `--sandbox`; it does not bypass Codex approvals or change the
user's approval policy. An uploads `--add-dir` requires a writable sandbox: a fresh Codex home with
its implicit read-only policy otherwise exits during startup. Omitted leaves Codex's config intact.
Request payload fields cannot change either policy, and conflicting Codex sandbox arguments are
rejected. Local launches outside managed profiles retain their existing behavior. Policy changes
take effect on the next launch/resume without restarting the backend or other sessions.

Only TERM, dashboard IDs, dashboard prompt/upload path and the instance-scoped MCP credential
are accepted from the backend launch environment. Backend provider credentials, HOME, CODEX_HOME,
CLAUDE_CONFIG_DIR, NODE_OPTIONS and dynamic loader variables are discarded. systemd receives
credential variable names through `--setenv=NAME`; values remain in the environment. Codex MCP
configuration similarly relies on the inherited credential rather than adding it to CLI args.

## Verification

`node --test tests/execution-profiles.test.mjs` verifies profile allowlisting, resume identity,
environment filtering, launch payload handling and matching cards in the same project.
`python3 -B -m unittest discover -s tests -p test_execution_profile_runner.py` verifies the
helper privilege/environment contract with mocked systemd and UID changes.

On the Linux host, smoke-test all profiles: launch a terminal and verify `id`, HOME,
CLAUDE_CONFIG_DIR and CODEX_HOME; create a child/grandchild and confirm Stop removes the service;
start each AI provider, send a dashboard message, stop/restart the backend and resume the same
conversation. Verify `/proc` command lines contain no MCP credential and the profile homes
remain inaccessible to other profile users. These host/systemd checks cannot run on Windows.
