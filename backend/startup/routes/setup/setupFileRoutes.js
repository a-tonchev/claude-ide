import fs from 'fs';
import path from 'path';

import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import FileStore from '#modules/files/FileStore';
import InstanceManager from '#modules/instanceManager/InstanceManager';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import setupCors from '../../startupHelpers/setupCors';

// Chat attachments. These routes sit outside the route creator because uploads are raw
// file bodies, streamed to disk instead of parsed as JSON.
//   GET  /files/config                          { enabled, maxBytes }
//   POST /files/upload?instanceId=&name=        raw body → { file: { id, name, size, mime } }
//   GET  /files/get?instanceId=&file=           the file itself (thumbnails, downloads)
//   POST /files/delete  { instanceId, file }    removes an attachment that wasn't sent
// Like the rest of the API they are not authenticated yet (see SECURITY-TODO.md); paths are
// always built here from filesDir, a known instance id and a name this module generated.

const prefix = SystemSettingsServices.getRoutePrefix();

const qs = req => Object.fromEntries(new URLSearchParams(req.getQuery() || ''));

function respond(res, state, status, body, headers = {}) {
  if (state.aborted || state.done) return;
  state.done = true;
  res.cork(() => {
    res.writeStatus(String(status));
    setupCors(res, state.origin);
    Object.entries(headers).forEach(([name, value]) => res.writeHeader(name, value));
    if (Buffer.isBuffer(body)) {
      res.end(body);
    } else {
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    }
  });
}

const fail = (res, state, status, message) => respond(res, state, status, { ok: false, errorMessage: message });

// The instance must exist: running, or remembered (it can be started again)
async function instanceExists(instanceId) {
  if (InstanceManager.get(instanceId)) return true;
  return !!(await InstanceStore.getRecord(instanceId));
}

function readJsonBody(res, state) {
  return new Promise(resolve => {
    let buffer = Buffer.alloc(0);
    res.onData((chunk, isLast) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      if (buffer.length > 64 * 1024) {
        fail(res, state, 413, 'Request too large');
        resolve(null);
        return;
      }
      if (!isLast) return;
      try {
        resolve(JSON.parse(buffer.toString() || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function handleUpload(res, req) {
  const state = { origin: req.getHeader('origin'), aborted: false, done: false };
  const { instanceId, name } = qs(req);
  const maxBytes = FileStore.maxUploadBytes();
  const declared = Number(req.getHeader('content-length'));

  let target = null;
  let stream = null;
  let received = 0;

  // Removes the partial file, and the instance folder if this upload created it
  const discard = () => {
    stream?.destroy();
    if (!target) return;
    fs.promises.rm(target.filePath, { force: true })
      .then(() => fs.promises.rmdir(path.dirname(target.filePath)))
      .catch(() => {});
  };

  res.onAborted(() => {
    state.aborted = true;
    discard();
  });

  if (!FileStore.isEnabled()) return fail(res, state, 404, 'File attachments are not configured (filesDir in settings.js).');
  if (!name) return fail(res, state, 400, 'name is required');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return fail(res, state, 413, `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  // Everything is read before any await: uWS needs onData registered synchronously
  target = FileStore.newUploadTarget(instanceId, name);
  if (!target) return fail(res, state, 400, 'Unknown instance');
  stream = fs.createWriteStream(target.filePath);
  stream.on('error', err => {
    console.error('[files] upload write failed:', err.message);
    discard();
    fail(res, state, 500, 'The file could not be saved.');
  });

  res.onData((chunk, isLast) => {
    if (state.done || state.aborted) return;
    received += chunk.byteLength;
    if (received > maxBytes) {
      discard();
      fail(res, state, 413, `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      return;
    }
    // uWS reuses the chunk's memory after this callback, so copy it
    stream.write(Buffer.from(new Uint8Array(chunk)));
    if (!isLast) return;
    stream.end(async () => {
      if (state.done || state.aborted) return;
      try {
        if (!(await instanceExists(instanceId))) {
          discard();
          fail(res, state, 404, 'This instance no longer exists.');
          return;
        }
        const [file] = FileStore.describe(instanceId, [target.storedName]);
        if (!file) {
          fail(res, state, 500, 'The file could not be saved.');
          return;
        }
        const { path: filePath, ...publicFile } = file;
        respond(res, state, 200, { ok: true, data: { file: publicFile } });
      } catch (err) {
        console.error('[files] upload failed:', err.message);
        discard();
        fail(res, state, 500, 'The file could not be saved.');
      }
    });
  });
  return undefined;
}

function handleGet(res, req) {
  const state = { origin: req.getHeader('origin'), aborted: false, done: false };
  res.onAborted(() => { state.aborted = true; });
  const { instanceId, file, download } = qs(req);
  const filePath = FileStore.resolve(instanceId, file);
  if (!filePath) return fail(res, state, 404, 'File not found');

  fs.promises.readFile(filePath)
    .then(content => {
      const disposition = download ? 'attachment' : 'inline';
      const mime = FileStore.mimeType(file);
      const headers = {
        'Content-Type': mime,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(FileStore.originalName(file))}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=86400',
      };
      // An SVG (or anything else) opened directly must not run scripts. Not for PDFs: the
      // browser's PDF viewer doesn't load under this policy.
      if (mime !== 'application/pdf') {
        headers['Content-Security-Policy'] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
      }
      respond(res, state, 200, content, headers);
    })
    .catch(() => fail(res, state, 404, 'File not found'));
  return undefined;
}

function handleDelete(res, req) {
  const state = { origin: req.getHeader('origin'), aborted: false, done: false };
  res.onAborted(() => { state.aborted = true; });
  readJsonBody(res, state).then(async body => {
    if (!body) return;
    try {
      const removed = await FileStore.deleteFile(body.instanceId, body.file);
      if (!removed) return fail(res, state, 404, 'File not found');
      return respond(res, state, 200, { ok: true, data: {} });
    } catch (err) {
      console.error('[files] delete failed:', err.message);
      return fail(res, state, 500, 'The file could not be deleted.');
    }
  });
}

function handleConfig(res, req) {
  const state = { origin: req.getHeader('origin'), aborted: false, done: false };
  respond(res, state, 200, {
    ok: true,
    data: { enabled: FileStore.isEnabled(), maxBytes: FileStore.maxUploadBytes() },
  });
}

const setupFileRoutes = app => {
  try {
    const root = FileStore.ensureRoot();
    if (root) console.info(`[files] attachments are stored in ${root}`);
  } catch (err) {
    console.error('[files] could not create the files folder:', err.message);
  }

  app.get(`${prefix}/files/config`, handleConfig);
  app.post(`${prefix}/files/upload`, handleUpload);
  app.get(`${prefix}/files/get`, handleGet);
  app.post(`${prefix}/files/delete`, handleDelete);
};

export default setupFileRoutes;
