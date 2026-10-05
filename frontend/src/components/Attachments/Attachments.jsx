import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { attachmentUrl, formatBytes, isImage } from '@/hooks/useAttachments';

const chipSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  maxWidth: 220,
  minWidth: 0,
  pl: 0.5,
  pr: 0.75,
  py: 0.5,
  borderRadius: 1.5,
  bgcolor: '#2B2B2B',
  border: '1px solid #4E5254',
};

const Thumb = ({ src, mime }) => (src && isImage(mime) ? (
  <Box
    component="img"
    src={src}
    alt=""
    sx={{
      width: 32, height: 32, objectFit: 'cover', borderRadius: 1, flexShrink: 0, bgcolor: '#1A1A1A',
    }}
  />
) : (
  <Box sx={{
    width: 32,
    height: 32,
    borderRadius: 1,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: '#1A1A1A',
  }}
  >
    <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: '#808080' }} />
  </Box>
));

const ChipText = ({ name, detail, detailColor = '#808080' }) => (
  <Box sx={{ minWidth: 0, flex: 1 }}>
    <Typography sx={{
      fontSize: '0.72rem', color: '#A9B7C6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}
    >
      {name}
    </Typography>
    <Typography sx={{
      fontSize: '0.65rem', color: detailColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}
    >
      {detail}
    </Typography>
  </Box>
);

// 📎 next to the chat input: pick files (on phones also camera and gallery)
export const AttachButton = ({ onFiles, disabled }) => {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={e => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <IconButton
        size="small"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Attach files"
        aria-label="Attach files"
        sx={{
          width: 28,
          height: 28,
          color: '#808080',
          '&:hover': { color: '#6897BB', bgcolor: 'rgba(104,151,187,0.15)' },
          '&.Mui-disabled': { color: '#4E5254' },
        }}
      >
        <AttachFileIcon sx={{ fontSize: 17, transform: 'rotate(45deg)' }} />
      </IconButton>
    </>
  );
};

// Files attached to the message being written: progress while uploading, ✕ to remove
export const AttachmentChips = ({ items, onRemove }) => {
  if (!items.length) return null;
  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5,
    }}
    >
      {items.map(item => {
        let detail = formatBytes(item.size);
        let detailColor;
        if (item.status === 'uploading') detail = `Uploading ${item.progress}%`;
        if (item.status === 'error') {
          detail = item.error;
          detailColor = '#BC3F3C';
        }
        return (
          <Box key={item.key} sx={{ ...chipSx, borderColor: item.status === 'error' ? '#BC3F3C' : '#4E5254' }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Thumb src={item.preview} mime={item.mime} />
              {item.status === 'uploading' && (
                <CircularProgress
                  size={20}
                  variant={item.progress ? 'determinate' : 'indeterminate'}
                  value={item.progress}
                  sx={{
                    position: 'absolute', top: 6, left: 6, color: '#6897BB',
                  }}
                />
              )}
              {item.status === 'error' && (
                <ErrorOutlineIcon sx={{
                  position: 'absolute', top: 7, left: 7, fontSize: 18, color: '#BC3F3C',
                }}
                />
              )}
            </Box>
            <ChipText name={item.name} detail={detail} detailColor={detailColor} />
            <IconButton
              size="small"
              onClick={() => onRemove(item.key)}
              title="Remove"
              aria-label={`Remove ${item.name}`}
              sx={{ p: 0.25, color: '#808080', '&:hover': { color: '#BC3F3C' } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
};

// Accepts dropped files anywhere inside; shows an overlay while files are dragged over it
export const FileDropZone = ({
  enabled, onFiles, children, sx,
}) => {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes('Files');

  if (!enabled) return <Box sx={sx}>{children}</Box>;

  return (
    <Box
      sx={{ position: 'relative', ...sx }}
      onDragEnter={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={e => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      }}
      onDrop={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      {children}
      {dragging && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          bgcolor: 'rgba(33,66,131,0.55)',
          border: '2px dashed #6897BB',
          borderRadius: 2,
          pointerEvents: 'none',
        }}
        >
          <UploadFileIcon sx={{ fontSize: 32, color: '#FFFFFF' }} />
          <Typography sx={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>Drop files to attach</Typography>
        </Box>
      )}
    </Box>
  );
};

// The files of a sent user message, in the feed: thumbnails for images, chips otherwise
export const FeedAttachments = ({ instanceId, attachments }) => {
  if (!attachments?.length) return null;
  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5,
    }}
    >
      {attachments.map(file => {
        const url = attachmentUrl(instanceId, file.id);
        return (
          <Box
            key={file.id}
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${file.name} (${formatBytes(file.size)})`}
            onClick={e => e.stopPropagation()}
            sx={{
              ...chipSx,
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { borderColor: '#6897BB' },
            }}
          >
            <Thumb src={url} mime={file.mime} />
            <ChipText name={file.name} detail={formatBytes(file.size)} />
          </Box>
        );
      })}
    </Box>
  );
};

// Files pasted into the input (screenshots, copied files); returns true when there were any
export const takePastedFiles = (event, onFiles) => {
  const files = Array.from(event.clipboardData?.files || []);
  if (!files.length) return false;
  event.preventDefault();
  onFiles(files);
  return true;
};
