import {
  useState, useCallback, useEffect, useRef,
} from 'react';
import axios from 'axios';

import BasicConfig, { getServerBaseUrl } from '@/components/config/BasicConfig';

const baseURL = () => `${getServerBaseUrl()}/${BasicConfig.API_VERSION}`;

// URL of a stored attachment, for thumbnails, opening and downloading
export const attachmentUrl = (instanceId, fileId, download = false) => (
  `${baseURL()}/files/get?instanceId=${encodeURIComponent(instanceId)}&file=${encodeURIComponent(fileId)}`
  + `${download ? '&download=1' : ''}`
);

export const isImage = mime => /^image\//.test(mime || '');

export const formatBytes = bytes => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Whether attachments are configured on the backend (settings.js filesDir), asked once
let configPromise = null;
const loadConfig = () => {
  if (!configPromise) {
    configPromise = axios.get(`${baseURL()}/files/config`)
      .then(res => res.data?.data || { enabled: false })
      .catch(() => {
        configPromise = null;
        return { enabled: false };
      });
  }
  return configPromise;
};

export const useFilesConfig = () => {
  const [config, setConfig] = useState({ enabled: false, maxBytes: 0 });
  useEffect(() => {
    let active = true;
    loadConfig().then(c => { if (active) setConfig(c); });
    return () => { active = false; };
  }, []);
  return config;
};

let keyCounter = 0;

// Files attached to the message being written in one chat. Each file uploads as soon as
// it is added; `ids` are the stored names of the finished ones, sent with the message.
const useAttachments = instanceId => {
  const { enabled, maxBytes } = useFilesConfig();
  const [items, setItems] = useState([]);
  const previews = useRef(new Map());

  const update = useCallback((key, fields) => {
    setItems(prev => prev.map(item => (item.key === key ? { ...item, ...fields } : item)));
  }, []);

  const addFiles = useCallback(fileList => {
    if (!enabled || !instanceId) return;
    Array.from(fileList || []).forEach(file => {
      keyCounter += 1;
      const key = `att-${keyCounter}`;
      const preview = isImage(file.type) ? URL.createObjectURL(file) : null;
      if (preview) previews.current.set(key, preview);
      // A pasted screenshot is called "image.png"; give it a more useful name
      const name = file.name && file.name !== 'image.png'
        ? file.name
        : `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${(file.type.split('/')[1] || 'png')}`;
      const item = {
        key, name, size: file.size, mime: file.type, preview, status: 'uploading', progress: 0, id: null, error: null,
      };
      if (maxBytes && file.size > maxBytes) {
        setItems(prev => [...prev, { ...item, status: 'error', error: `Larger than ${formatBytes(maxBytes)}` }]);
        return;
      }
      setItems(prev => [...prev, item]);
      axios.post(
        `${baseURL()}/files/upload?instanceId=${encodeURIComponent(instanceId)}&name=${encodeURIComponent(name)}`,
        file,
        {
          headers: { 'Content-Type': 'application/octet-stream' },
          onUploadProgress: e => {
            if (e.total) update(key, { progress: Math.round((e.loaded / e.total) * 100) });
          },
        },
      )
        .then(res => {
          const stored = res.data?.data?.file;
          if (!stored) throw new Error(res.data?.errorMessage || 'Upload failed');
          update(key, { status: 'done', progress: 100, id: stored.id });
        })
        .catch(err => {
          update(key, { status: 'error', error: err.response?.data?.errorMessage || err.message || 'Upload failed' });
        });
    });
  }, [enabled, instanceId, maxBytes, update]);

  const releasePreview = key => {
    const url = previews.current.get(key);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(key);
  };

  // ✕ on a chip: the uploaded file is deleted too
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const remove = useCallback(key => {
    const item = itemsRef.current.find(i => i.key === key);
    if (item?.id) {
      axios.post(`${baseURL()}/files/delete`, { instanceId, file: item.id }).catch(() => {});
    }
    setItems(prev => prev.filter(i => i.key !== key));
    releasePreview(key);
  }, [instanceId]);

  // After sending: the files now belong to the message, so they are only taken off the input
  const clear = useCallback(() => {
    itemsRef.current.forEach(i => releasePreview(i.key));
    setItems([]);
  }, []);

  useEffect(() => () => {
    previews.current.forEach(url => URL.revokeObjectURL(url));
    previews.current.clear();
  }, []);

  const ids = items.filter(i => i.status === 'done').map(i => i.id);
  const uploading = items.some(i => i.status === 'uploading');

  return {
    enabled, items, ids, uploading, addFiles, remove, clear,
  };
};

export default useAttachments;
