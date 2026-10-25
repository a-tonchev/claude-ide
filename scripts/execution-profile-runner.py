#!/usr/bin/python3 -I
"""Install root:root 0755 at /usr/local/sbin/claude-ide-profile-runner.

Only this file may be granted NOPASSWD:NOSETENV sudo access to the backend user.
Use command-specific env_keep for CLAUDE_IDE_LAUNCH_DATA, never SETENV.
The fixed root-owned config is /etc/claude-ide/execution-profiles.json.
"""
import json
import os
import pathlib
import pwd
import re
import subprocess
import sys

CONFIG = '/etc/claude-ide/execution-profiles.json'
ID = re.compile(r'^[a-z][a-z0-9_-]{0,39}$')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
ENV_KEYS = {'TERM', 'INSTANCE_ID', 'PROJECT_ID', 'OBSERVER_ID', 'CLAUDE_IDE_MCP_TOKEN', 'CLAUDE_IDE_SYSTEM_PROMPT', 'CLAUDE_IDE_FILES_DIR'}


def trusted_file(filename):
    target = pathlib.Path(filename).resolve(strict=True)
    for item in [target, *target.parents]:
        stat = item.stat()
        if stat.st_uid != 0 or stat.st_mode & 0o022:
            raise ValueError('Runner configuration and executable paths must be root-owned and not writable by group/others')
    return str(target)


def load_config():
    with open(trusted_file(CONFIG), encoding='utf-8') as stream:
        config = json.load(stream)
    if not ID.fullmatch(config['installId']):
        raise ValueError('Invalid installId')
    return config


def resolve_profile(config, profile_id):
    if not isinstance(profile_id, str) or not ID.fullmatch(profile_id):
        raise ValueError('Invalid profile ID')
    profile = config['profiles'][profile_id]
    if 'claudeBypassPermissions' in profile and type(profile['claudeBypassPermissions']) is not bool:
        raise ValueError('claudeBypassPermissions must be a boolean in the root-owned profile')
    if 'codexSandbox' in profile and profile['codexSandbox'] not in ('read-only', 'workspace-write', 'danger-full-access'):
        raise ValueError('Invalid codexSandbox in the root-owned profile')
    account = pwd.getpwnam(profile['username'])
    if account.pw_uid == 0 or account.pw_dir != profile['home']:
        raise ValueError('Profiles must be unprivileged users with matching homes')
    return profile, account


def unit_name(config, profile_id, instance_id):
    if not isinstance(instance_id, str) or not UUID.fullmatch(instance_id):
        raise ValueError('Invalid instance ID')
    return f"claude-ide-{config['installId']}-{profile_id}-{instance_id}.service"


def profile_env(profile, account, extra=None):
    env = {'PATH': profile.get('path', '/usr/local/bin:/usr/bin:/bin'), 'HOME': profile['home'],
           'USER': account.pw_name, 'LOGNAME': account.pw_name, 'SHELL': '/bin/bash',
           'LANG': 'C.UTF-8', 'TERM': 'xterm-256color',
           'CLAUDE_CONFIG_DIR': profile['home'] + '/.claude', 'CODEX_HOME': profile['home'] + '/.codex',
           'XDG_CONFIG_HOME': profile['home'] + '/.config', 'XDG_CACHE_HOME': profile['home'] + '/.cache',
           'XDG_DATA_HOME': profile['home'] + '/.local/share'}
    for key, value in (extra or {}).items():
        if key not in ENV_KEYS or not isinstance(value, str) or '\x00' in value:
            raise ValueError('Invalid launch environment')
        env[key] = value
    return env


def ensure_codex_home(profile, account):
    # An explicit CODEX_HOME must already exist in current Codex versions.
    # Create it as the profile user: a user-controlled symlink must never make
    # the privileged runner write or change ownership outside that user's rights.
    subprocess.run(['/usr/bin/mkdir', '-p', '-m', '0700', '--', profile['home'] + '/.codex'],
                   user=account.pw_uid, group=account.pw_gid,
                   extra_groups=os.getgrouplist(account.pw_name, account.pw_gid),
                   env={'PATH': '/usr/bin:/bin'}, check=True, capture_output=True)


def apply_launch_policy(profile, kind, args):
    invocation = list(args)
    if kind == 'claude' and profile.get('claudeBypassPermissions') is True:
        if '--dangerously-skip-permissions' not in invocation:
            invocation.insert(0, '--dangerously-skip-permissions')
    if kind == 'codex' and 'codexSandbox' in profile:
        # The selected policy belongs to the root-owned profile, never the request.
        if any(arg == '--sandbox' or arg.startswith(('-s', '--sandbox='))
               or re.match(r'^(?:--config=)?sandbox_mode\s*=', arg) for arg in invocation):
            raise ValueError('Codex sandbox flags are managed by the execution profile')
        invocation = ['--sandbox', profile['codexSandbox'], *invocation]
    return invocation


def main():
    if os.geteuid() != 0:
        raise ValueError('Must run through the configured sudo rule')
    config = load_config()
    operation = sys.argv[1]
    if operation == 'launch' and len(sys.argv) == 2:
        payload = json.loads(os.environ.pop('CLAUDE_IDE_LAUNCH_DATA'))
        profile_id = payload['profileId']
        profile, account = resolve_profile(config, profile_id)
        unit = unit_name(config, profile_id, payload['instanceId'])
        kind = payload['kind']
        if kind not in ('claude', 'codex', 'terminal'):
            raise ValueError('Invalid launch kind')
        # Command paths and identity come only from root-owned configuration.
        executable = trusted_file('/bin/bash' if kind == 'terminal' else profile['commands'][kind])
        args = payload['args']
        if not isinstance(args, list) or not all(isinstance(arg, str) and '\x00' not in arg for arg in args):
            raise ValueError('Invalid arguments')
        cwd = pathlib.Path(payload.get('cwd') or profile['home']).resolve(strict=True)
        roots = [pathlib.Path(root).resolve(strict=True) for root in config['projectRoots']] + [pathlib.Path(profile['home']).resolve(strict=True)]
        if not cwd.is_dir() or not any(cwd == root or root in cwd.parents for root in roots):
            raise ValueError('Working directory is outside the configured shared project roots')
        env = profile_env(profile, account, payload.get('env'))
        args = apply_launch_policy(profile, kind, args)
        if kind == 'codex':
            ensure_codex_home(profile, account)
        command = ['/usr/bin/systemd-run', '--quiet', '--collect', '--wait', '--pty', '--service-type=exec',
                   '--unit=' + unit, '--uid=' + account.pw_name, '--gid=' + str(account.pw_gid),
                   '--working-directory=' + str(cwd), '--property=KillMode=control-group',
                   '--property=TimeoutStopSec=5s', '--property=UMask=0007']
        # Name-only --setenv keeps credentials out of the process command line.
        command += ['--setenv=' + key for key in env]
        command += ['--', executable, *args]
        os.execve(command[0], command, env)
    elif operation == 'stop' and len(sys.argv) == 4:
        profile_id, instance_id = sys.argv[2:]
        resolve_profile(config, profile_id)
        unit = unit_name(config, profile_id, instance_id)
        # systemd stops the exact service cgroup, including reparented grandchildren.
        result = subprocess.run(['/usr/bin/systemctl', 'stop', unit], capture_output=True, timeout=12, env={'PATH': '/usr/bin:/bin'})
        if result.returncode and b'not loaded' not in result.stderr and b'not found' not in result.stderr:
            raise ValueError('Profile service could not be stopped')
    elif operation == 'lookup' and len(sys.argv) == 4:
        profile, account = resolve_profile(config, sys.argv[2])
        query = json.loads(sys.argv[3])
        if query.get('kind') not in ('claude', 'codex'):
            raise ValueError('Invalid lookup')
        node = trusted_file(config['node'])
        helper = trusted_file(config['sessionLookup'])
        os.initgroups(account.pw_name, account.pw_gid)
        os.setgid(account.pw_gid)
        os.setuid(account.pw_uid)
        os.execve(node, [node, helper, json.dumps(query)], profile_env(profile, account))
    elif operation == 'sweep' and len(sys.argv) == 2:
        prefix = 'claude-ide-' + config['installId'] + '-'
        result = subprocess.run(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend', prefix + '*.service'],
                                check=True, capture_output=True, text=True, timeout=10, env={'PATH': '/usr/bin:/bin'})
        pattern = re.compile(re.escape(prefix) + r'[a-z][a-z0-9_-]{0,39}-[0-9a-f-]{36}\.service')
        units = [line.split()[0] for line in result.stdout.splitlines() if line.split() and pattern.fullmatch(line.split()[0])]
        if units:
            subprocess.run(['/usr/bin/systemctl', 'stop', *units], check=True, capture_output=True, timeout=15, env={'PATH': '/usr/bin:/bin'})
    else:
        raise ValueError('Invalid runner operation')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not include payloads/environment values in errors (they may contain a credential).
        print('Execution profile runner rejected request: ' + str(error), file=sys.stderr)
        sys.exit(1)
