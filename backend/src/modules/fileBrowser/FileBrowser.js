import fs from 'fs';
import path from 'path';
import os from 'os';

function normalizePath(inputPath) {
  if (os.platform() === 'win32' && /^\/[a-zA-Z]\//.test(inputPath)) {
    const drive = inputPath[1].toUpperCase();
    return `${drive}:${inputPath.slice(2).replace(/\//g, '\\')}`;
  }
  return inputPath;
}

const FileBrowser = {
  listDirectories(dirPath) {
    let targetPath = dirPath;

    if (!targetPath) {
      targetPath = os.homedir();
    }

    const resolved = path.resolve(normalizePath(targetPath));

    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return { ok: false, error: 'Not a directory' };
      }
    } catch (e) {
      return { ok: false, error: 'Path does not exist' };
    }

    const entries = [];

    try {
      const items = fs.readdirSync(resolved, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory()) continue;
        // Skip hidden dirs and common non-project dirs
        if (item.name.startsWith('.')) continue;
        if (item.name === 'node_modules') continue;

        entries.push({
          name: item.name,
          path: path.join(resolved, item.name),
        });
      }
    } catch (e) {
      // Permission denied etc — return what we can
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    // Get parent directory
    const parent = path.dirname(resolved);

    // Get drive roots on Windows
    let roots = null;
    if (os.platform() === 'win32') {
      roots = getDriveLetters();
    }

    return {
      ok: true,
      current: resolved,
      parent: parent !== resolved ? parent : null,
      entries,
      roots,
    };
  },
};

function getDriveLetters() {
  const drives = [];
  // Check A-Z drive letters
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    try {
      fs.accessSync(drivePath);
      drives.push({ name: `${letter}:`, path: drivePath });
    } catch (e) {
      // Drive doesn't exist
    }
  }
  return drives;
}

export default FileBrowser;
