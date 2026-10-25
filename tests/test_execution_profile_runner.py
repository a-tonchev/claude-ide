"""Privilege-boundary contract tests; systemd/UID changes are mocked, not executed."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

try:
    import pwd
except ImportError:  # These contract tests also run on a Windows development host.
    sys.modules['pwd'] = types.SimpleNamespace(getpwnam=lambda _: None)

spec = importlib.util.spec_from_file_location('profile_runner', Path(__file__).parents[1] / 'scripts' / 'execution-profile-runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
INSTANCE = '12345678-1234-4234-8234-123456789abc'


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.home = self.root / 'home'
        self.home.mkdir()
        self.projects = self.root / 'workspaces'
        self.projects.mkdir()
        self.profile = {'username': 'lab-user', 'home': str(self.home),
                        'commands': {'claude': '/usr/local/bin/claude', 'codex': '/usr/local/bin/codex'}}
        self.config = {'installId': 'test-lab', 'projectRoots': [str(self.projects)],
                       'profiles': {'claude1': self.profile}, 'node': '/usr/local/bin/node', 'sessionLookup': '/opt/helper.mjs'}
        self.account = types.SimpleNamespace(pw_uid=1001, pw_gid=1001, pw_name='lab-user', pw_dir=str(self.home))
        for patcher in [patch.object(runner, 'load_config', return_value=self.config),
                        patch.object(runner.os, 'geteuid', return_value=0, create=True),
                        patch.object(runner.pwd, 'getpwnam', return_value=self.account)]:
            patcher.start()
            self.addCleanup(patcher.stop)

    def launch(self, **changes):
        payload = {'profileId': 'claude1', 'instanceId': INSTANCE, 'kind': 'claude',
                   'cwd': str(self.projects), 'args': ['--session-id', INSTANCE],
                   'env': {'INSTANCE_ID': INSTANCE, 'CLAUDE_IDE_MCP_TOKEN': 'test-secret'}}
        payload.update(changes)
        with patch.object(sys, 'argv', ['runner', 'launch']), patch.dict(os.environ, {'CLAUDE_IDE_LAUNCH_DATA': json.dumps(payload)}), \
                patch.object(runner, 'trusted_file', side_effect=lambda filename: filename), patch.object(os, 'execve') as execute:
            runner.main()
            return execute.call_args

    def test_launch_runs_fixed_command_as_profile_with_private_home(self):
        call = self.launch()
        executable, args, env = call.args
        self.assertEqual(executable, '/usr/bin/systemd-run')
        self.assertIn('--uid=lab-user', args)
        self.assertIn('--property=KillMode=control-group', args)
        # These trusted collaborator units need their separately allowlisted sudo service helper.
        self.assertNotIn('--property=NoNewPrivileges=yes', args)
        self.assertIn('--setenv=CLAUDE_IDE_MCP_TOKEN', args)
        self.assertNotIn('test-secret', ' '.join(args))
        self.assertEqual(env['CLAUDE_IDE_MCP_TOKEN'], 'test-secret')
        self.assertEqual(env['HOME'], str(self.home))
        self.assertEqual(env['CODEX_HOME'], str(self.home) + '/.codex')
        self.assertNotIn('CLAUDE_IDE_LAUNCH_DATA', env)
        self.assertEqual(args[-3], '/usr/local/bin/claude')

    def test_client_cannot_pick_root_override_home_or_escape_project_roots(self):
        with self.assertRaises(KeyError):
            self.launch(profileId='root')
        with self.assertRaisesRegex(ValueError, 'Invalid launch environment'):
            self.launch(env={'HOME': '/root', 'LD_PRELOAD': 'payload'})
        with self.assertRaisesRegex(ValueError, 'outside'):
            self.launch(cwd=str(self.root))
        with self.assertRaisesRegex(ValueError, 'Invalid instance ID'):
            self.launch(instanceId='../../another.service')
        self.account.pw_uid = 0
        with self.assertRaisesRegex(ValueError, 'unprivileged'):
            self.launch()

    def test_first_codex_launch_creates_private_home_without_root_file_writes(self):
        with patch.object(os, 'getgrouplist', return_value=[1001, 1002], create=True), \
                patch.object(runner.subprocess, 'run') as mkdir:
            call = self.launch(kind='codex', args=[])
            mkdir.assert_called_once()
            self.assertEqual(mkdir.call_args.args[0], ['/usr/bin/mkdir', '-p', '-m', '0700', '--', str(self.home) + '/.codex'])
            self.assertEqual(mkdir.call_args.kwargs['user'], 1001)
            self.assertEqual(mkdir.call_args.kwargs['group'], 1001)
            self.assertEqual(mkdir.call_args.kwargs['extra_groups'], [1001, 1002])
            self.assertEqual(mkdir.call_args.kwargs['env'], {'PATH': '/usr/bin:/bin'})
            self.assertEqual(call.args[1][-1], '/usr/local/bin/codex')

    def test_codex_home_creation_failure_prevents_launch(self):
        with patch.object(os, 'getgrouplist', return_value=[1001], create=True), \
                patch.object(runner.subprocess, 'run', side_effect=PermissionError('home is not writable')):
            with self.assertRaisesRegex(PermissionError, 'not writable'):
                self.launch(kind='codex', args=[])

    def test_root_claude_bypass_applies_to_launch_and_resume_but_not_terminal(self):
        self.profile['claudeBypassPermissions'] = True
        for args in [[], ['--resume', INSTANCE], ['--dangerously-skip-permissions']]:
            invocation = self.launch(args=args).args[1]
            self.assertEqual(invocation.count('--dangerously-skip-permissions'), 1)
        terminal = self.launch(kind='terminal', args=['-l']).args[1]
        self.assertNotIn('--dangerously-skip-permissions', terminal)
        self.assertNotIn('--sandbox', terminal)
        self.profile['claudeBypassPermissions'] = False
        self.assertNotIn('--dangerously-skip-permissions', self.launch(args=[]).args[1])

    def test_codex_policy_comes_only_from_root_profile_and_preserves_approvals(self):
        self.profile['codexSandbox'] = 'danger-full-access'
        self.profile['claudeBypassPermissions'] = True
        with patch.object(runner, 'ensure_codex_home'):
            invocation = self.launch(kind='codex', args=['resume', INSTANCE],
                                     codexSandbox='read-only', claudeBypassPermissions=False).args[1]
        self.assertEqual(invocation[invocation.index('--sandbox') + 1], 'danger-full-access')
        self.assertNotIn('--ask-for-approval', invocation)
        self.assertNotIn('--dangerously-bypass-approvals-and-sandbox', invocation)
        self.assertNotIn('--dangerously-skip-permissions', invocation)
        self.assertEqual(invocation[-2:], ['resume', INSTANCE])

    def test_sandbox_mode_allowlist_and_conflicting_request_flags(self):
        for mode in ['read-only', 'workspace-write', 'danger-full-access']:
            self.profile['codexSandbox'] = mode
            with patch.object(runner, 'ensure_codex_home'):
                invocation = self.launch(kind='codex', args=[]).args[1]
            self.assertEqual(invocation[invocation.index('--sandbox') + 1], mode)
        for mode in ['root', None, False, [], {}]:
            self.profile['codexSandbox'] = mode
            with self.assertRaisesRegex(ValueError, 'Invalid codexSandbox'):
                self.launch(kind='codex', args=[])
        self.profile['codexSandbox'] = 'danger-full-access'
        for args in [['--sandbox', 'read-only'], ['--sandbox=read-only'], ['-sread-only'],
                     ['-c', 'sandbox_mode="read-only"'], ['--config=sandbox_mode="read-only"']]:
            with self.assertRaisesRegex(ValueError, 'managed by the execution profile'):
                self.launch(kind='codex', args=args)
        for value in ['true', 1, None]:
            self.profile['claudeBypassPermissions'] = value
            with self.assertRaisesRegex(ValueError, 'must be a boolean'):
                self.launch()

    def test_unspecified_policies_leave_cli_defaults_unchanged(self):
        self.assertNotIn('--dangerously-skip-permissions', self.launch(args=[]).args[1])
        with patch.object(runner, 'ensure_codex_home'):
            self.assertNotIn('--sandbox', self.launch(kind='codex', args=[]).args[1])

    def test_stop_targets_exact_install_profile_instance_service(self):
        with patch.object(sys, 'argv', ['runner', 'stop', 'claude1', INSTANCE]), \
                patch.object(runner.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as execute:
            runner.main()
            self.assertEqual(execute.call_args.args[0], ['/usr/bin/systemctl', 'stop',
                             f'claude-ide-test-lab-claude1-{INSTANCE}.service'])

    def test_lookup_drops_supplementary_groups_gid_and_uid(self):
        with patch.object(sys, 'argv', ['runner', 'lookup', 'claude1', json.dumps({'kind': 'claude', 'sessionId': INSTANCE})]), \
                patch.object(runner, 'trusted_file', side_effect=lambda filename: filename), \
                patch.object(os, 'initgroups', create=True) as groups, patch.object(os, 'setgid', create=True) as gid, \
                patch.object(os, 'setuid', create=True) as uid, patch.object(os, 'execve') as execute:
            runner.main()
            groups.assert_called_once_with('lab-user', 1001)
            gid.assert_called_once_with(1001)
            uid.assert_called_once_with(1001)
            self.assertEqual(execute.call_args.args[0], '/usr/local/bin/node')
            self.assertEqual(execute.call_args.args[1][1], '/opt/helper.mjs')


if __name__ == '__main__':
    unittest.main()
