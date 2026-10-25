import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

const ID = /^[a-z][a-z0-9_-]{0,39}$/;
const ENV_KEYS = new Set(['TERM', 'INSTANCE_ID', 'PROJECT_ID', 'OBSERVER_ID', 'CLAUDE_IDE_MCP_TOKEN', 'CLAUDE_IDE_SYSTEM_PROMPT', 'CLAUDE_IDE_FILES_DIR']);

export function configuredProfiles(settings) {
  const profiles = settings.executionProfiles || [];
  if (!Array.isArray(profiles)) throw new Error('executionProfiles must be an array');
  const ids = new Set();
  return profiles.map(profile => {
    if (!profile || typeof profile.id !== 'string' || !ID.test(profile.id) || ids.has(profile.id)
      || typeof profile.label !== 'string' || !profile.label.trim()) {
      throw new Error('Invalid execution profile configuration');
    }
    ids.add(profile.id);
    return { id: profile.id, label: profile.label };
  });
}

export function resolveExecutionProfile(settings, profileId, record = null, platform = process.platform) {
  const profiles = configuredProfiles(settings);
  // Resume identity is immutable. Never move an existing conversation into another home.
  const requested = record ? record.executionProfileId : profileId;
  if (!profiles.length) {
    if (requested) throw new Error('This execution profile is no longer configured');
    return null;
  }
  if (platform !== 'linux') throw new Error('Execution profiles require Linux');
  if (record && !requested) throw new Error('This legacy session has no execution profile. Assign its original profile in the database before resuming.');
  const id = requested || settings.defaultExecutionProfileId || profiles[0].id;
  const profile = profiles.find(item => item.id === id);
  if (!profile) throw new Error('Unknown execution profile');
  if (!path.isAbsolute(settings.executionProfileRunner || '')) throw new Error('An absolute executionProfileRunner is required');
  return profile;
}

export function profileEnvironment(env) {
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => ENV_KEYS.has(key) && typeof value === 'string'));
}

export function profileLaunch(settings, profile, instanceId, kind, cwd, args, env) {
  const payload = { profileId: profile.id, instanceId, kind, cwd: cwd || null, args, env: profileEnvironment(env) };
  return {
    file: '/usr/bin/sudo',
    // sudoers permits only CLAUDE_IDE_LAUNCH_DATA through command-specific env_keep.
    // Never grant SETENV: loader variables such as LD_PRELOAD would execute as root.
    args: ['-n', '--', settings.executionProfileRunner, 'launch'],
    // The launch request can contain the MCP credential. Keep it out of argv, files and logs.
    env: { PATH: '/usr/bin:/bin', TERM: 'xterm-256color', CLAUDE_IDE_LAUNCH_DATA: JSON.stringify(payload) },
  };
}

export function queryProfileSession(settings, profile, query) {
  return JSON.parse(execFileSync('/usr/bin/sudo', ['-n', '--', settings.executionProfileRunner, 'lookup', profile.id, JSON.stringify(query)], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
    env: { PATH: '/usr/bin:/bin' },
  }).trim());
}

export function stopProfile(settings, profileId, instanceId, { sync = false } = {}) {
  const args = ['-n', '--', settings.executionProfileRunner, 'stop', profileId, instanceId];
  if (sync) return execFileSync('/usr/bin/sudo', args, { timeout: 15000, stdio: 'ignore' });
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/sudo', args, { timeout: 15000 }, err => (err ? reject(err) : resolve()));
  });
}

export function sweepProfileServices(settings) {
  if (!configuredProfiles(settings).length) return;
  execFileSync('/usr/bin/sudo', ['-n', '--', settings.executionProfileRunner, 'sweep'], {
    timeout: 30000, stdio: 'ignore', env: { PATH: '/usr/bin:/bin' },
  });
}
