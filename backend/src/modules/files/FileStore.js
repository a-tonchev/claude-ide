import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';

// Files attached in the chat. settings.js `filesDir` is the root (one per install):
//   <filesDir>/instances/<instanceId>/  what was attached in that chat; deleted with the
//                                       instance's record and messages
//   <filesDir>/shared/                  files the AI keeps for good, one folder per project;
//                                       never touched by the backend
// Without `filesDir` attachments are switched off.

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;

// Instance ids are UUIDs (crypto.randomUUID), which keeps them safe as folder names
const INSTANCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Stored names are made here: <yyyyMMdd-HHmmss>-<4 hex>-<sanitized original name>
const STORED_NAME_PATTERN = /^\d{8}-\d{6}-[0-9a-f]{4}-[^\\/]+$/;

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
};

const getRoot = () => {
  const { filesDir } = SystemSettingsServices.getSettings();
  return typeof filesDir === 'string' && filesDir.trim() ? path.resolve(filesDir.trim()) : null;
};

const isInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const pad = n => String(n).padStart(2, '0');
const timestamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  + `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// A name that is safe as a Windows/POSIX file name and can't leave its folder
export function sanitizeFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop();
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (!cleaned) return 'file';
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned;
  const ext = path.extname(cleaned).slice(0, 16);
  return cleaned.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
}

export const isInstanceId = id => typeof id === 'string' && INSTANCE_ID_PATTERN.test(id);
export const isStoredName = name => typeof name === 'string' && STORED_NAME_PATTERN.test(name)
  && name === sanitizeFileName(name);

const FileStore = {
  isEnabled: () => !!getRoot(),

  getRoot,

  maxUploadBytes() {
    const configured = Number(SystemSettingsServices.getSettings().maxUploadBytes);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
  },

  sharedDir: () => (getRoot() ? path.join(getRoot(), 'shared') : null),

  instanceDir(instanceId) {
    const root = getRoot();
    if (!root || !isInstanceId(instanceId)) return null;
    return path.join(root, 'instances', instanceId);
  },

  // Creates <filesDir>/instances and <filesDir>/shared. Called at startup.
  ensureRoot() {
    const root = getRoot();
    if (!root) return null;
    fs.mkdirSync(path.join(root, 'instances'), { recursive: true });
    fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
    return root;
  },

  // A new, unused path for an upload into the instance's folder (created on first use)
  newUploadTarget(instanceId, originalName) {
    const dir = FileStore.instanceDir(instanceId);
    if (!dir) return null;
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `${timestamp()}-${crypto.randomBytes(2).toString('hex')}-${sanitizeFileName(originalName)}`;
    return { storedName, filePath: path.join(dir, storedName) };
  },

  // The full path of a stored attachment, or null when the name isn't one of ours
  resolve(instanceId, storedName) {
    const dir = FileStore.instanceDir(instanceId);
    if (!dir || !isStoredName(storedName)) return null;
    const filePath = path.join(dir, storedName);
    return isInside(dir, filePath) ? filePath : null;
  },

  // Stored attachments as { id, name, size, mime, path }; unknown or missing ones are left out
  describe(instanceId, storedNames) {
    if (!Array.isArray(storedNames)) return [];
    return storedNames.map(storedName => {
      const filePath = FileStore.resolve(instanceId, storedName);
      if (!filePath) return null;
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        return {
          id: storedName,
          name: FileStore.originalName(storedName),
          size: stat.size,
          mime: FileStore.mimeType(storedName),
          path: filePath,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  },

  // The name as uploaded, without the timestamp prefix
  originalName: storedName => storedName.replace(/^\d{8}-\d{6}-[0-9a-f]{4}-/, ''),

  mimeType: name => MIME_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream',

  async deleteFile(instanceId, storedName) {
    const filePath = FileStore.resolve(instanceId, storedName);
    if (!filePath) return false;
    await fs.promises.rm(filePath, { force: true });
    return true;
  },

  // Deleting an instance's record deletes what was attached in its chat
  async deleteInstanceDirs(instanceIds) {
    await Promise.all(instanceIds.map(async id => {
      const dir = FileStore.instanceDir(id);
      if (!dir) return;
      try {
        await fs.promises.rm(dir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[files] could not delete ${dir}:`, err.message);
      }
    }));
  },

  // Instance folders whose record is gone (e.g. deleted while the backend was down).
  // Called at startup with the ids of all records.
  async deleteOrphanInstanceDirs(knownIds) {
    const root = getRoot();
    if (!root) return 0;
    const known = new Set(knownIds);
    let entries;
    try {
      entries = await fs.promises.readdir(path.join(root, 'instances'), { withFileTypes: true });
    } catch {
      return 0;
    }
    const orphans = entries.filter(e => e.isDirectory() && isInstanceId(e.name) && !known.has(e.name));
    await FileStore.deleteInstanceDirs(orphans.map(e => e.name));
    return orphans.length;
  },

  // The instructions instances get about attachments and the shared folder
  promptSection(instanceId) {
    const root = getRoot();
    if (!root) return '';
    const own = FileStore.instanceDir(instanceId);
    const shared = path.join(root, 'shared');
    return [
      '## Attached files',
      `Files the user attaches in the dashboard are saved in: ${own}`,
      'Their full paths are added at the end of the user\'s message, after the words Attached files. Open them with your file tools;',
      'images are images (screenshots, mockups) — look at them.',
      'That folder belongs to this instance and is DELETED when the instance is stopped.',
      '',
      `Files that must be kept go to the shared folder: ${shared}`,
      '- Use one folder per project there, named after the project. Create it if it does not exist, otherwise reuse it.',
      '- Inside the project folder, organize files however makes sense (subfolders by topic, etc.).',
      '- Copy an attachment (or a file you produced) there when it will be needed later: designs, specs, reference material.',
      '- Never delete or overwrite existing files in the shared folder; add a suffix to the name instead.',
      '- When the user refers to earlier material, look in the project\'s shared folder first.',
    ].join('\n');
  },
};

export default FileStore;
