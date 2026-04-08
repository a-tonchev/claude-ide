import React, { useMemo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import { Marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// --- Diff Parser ---

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* eslint-disable no-continue */
function parseDiff(text) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  let oldLine = 0;
  let newLine = 0;

  const lines = text.split('\n');

  for (const line of lines) {
    // diff --git header
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = { name: match ? match[2] : 'unknown', hunks: [] };
      currentHunk = null;
      files.push(currentFile);
      continue;
    }

    // --- header
    if (line.startsWith('--- ')) {
      if (!currentFile) {
        const name = line.replace(/^--- (a\/)?/, '').trim() || 'file';
        currentFile = { name, hunks: [] };
        files.push(currentFile);
      }
      continue;
    }

    // +++ header
    if (line.startsWith('+++ ')) {
      if (currentFile) {
        const name = line.replace(/^\+\+\+ (b\/)?/, '').trim();
        if (name && name !== '/dev/null') currentFile.name = name;
      }
      continue;
    }

    // index, old mode, new mode, etc. - skip
    if (line.startsWith('index ') || line.startsWith('old mode') || line.startsWith('new mode')
      || line.startsWith('new file') || line.startsWith('deleted file')
      || line.startsWith('similarity') || line.startsWith('rename')
      || line.startsWith('Binary')) {
      continue;
    }

    // Hunk header
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentHunk = { header: hunkMatch[3].trim(), lines: [] };
      if (!currentFile) {
        currentFile = { name: 'changes', hunks: [] };
        files.push(currentFile);
      }
      currentFile.hunks.push(currentHunk);
      continue;
    }

    // Content lines
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add', content: line.slice(1), oldNum: null, newNum: newLine++,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'del', content: line.slice(1), oldNum: oldLine++, newNum: null,
        });
      } else if (line.startsWith('\\')) {
        // "\ No newline at end of file" - skip
        continue;
      } else {
        currentHunk.lines.push({
          type: 'ctx', content: line.startsWith(' ') ? line.slice(1) : line, oldNum: oldLine++, newNum: newLine++,
        });
      }
    }
  }

  // Fallback: if no structured diff was found, try simple +/- lines
  if (files.length === 0 && lines.some(l => l.startsWith('+') || l.startsWith('-'))) {
    currentFile = { name: 'changes', hunks: [{ header: '', lines: [] }] };
    [currentHunk] = currentFile.hunks;
    let lineNum = 1;
    for (const line of lines) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add', content: line.slice(1), oldNum: null, newNum: lineNum++,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'del', content: line.slice(1), oldNum: lineNum, newNum: null,
        });
        lineNum++;
      } else if (line.trim() !== '') {
        currentHunk.lines.push({
          type: 'ctx', content: line, oldNum: lineNum, newNum: lineNum,
        });
        lineNum++;
      }
    }
    if (currentHunk.lines.length > 0) files.push(currentFile);
  }

  return files;
}

/* eslint-disable max-len */
function renderDiffHtml(text) {
  const files = parseDiff(text);
  if (files.length === 0) return `<pre><code>${escapeHtml(text)}</code></pre>`;

  let html = '<div class="diff-container">';

  for (const file of files) {
    html += '<div class="diff-file">';
    html += `<div class="diff-file-header"><svg class="diff-file-icon" viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25Zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 019 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg><span class="diff-file-name">${escapeHtml(file.name)}</span></div>`;
    html += '<table class="diff-table"><tbody>';

    for (const hunk of file.hunks) {
      if (hunk.header) {
        html += `<tr class="diff-hunk-row"><td class="diff-line-num"></td><td class="diff-line-num"></td><td class="diff-hunk-info">${escapeHtml(hunk.header)}</td></tr>`;
      }

      for (const line of hunk.lines) {
        const cls = line.type === 'add' ? 'diff-addition' : line.type === 'del' ? 'diff-deletion' : 'diff-context';
        const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : '\u00a0';
        const oldNum = line.oldNum !== null ? line.oldNum : '';
        const newNum = line.newNum !== null ? line.newNum : '';
        html += `<tr class="${cls}">`;
        html += `<td class="diff-line-num diff-line-num-old">${oldNum}</td>`;
        html += `<td class="diff-line-num diff-line-num-new">${newNum}</td>`;
        html += `<td class="diff-line-content"><span class="diff-prefix">${prefix}</span>${escapeHtml(line.content)}</td>`;
        html += '</tr>';
      }
    }

    html += '</tbody></table></div>';
  }

  html += '</div>';
  return html;
}
/* eslint-enable max-len */

// --- Marked Instance ---

const markedInstance = new Marked();

markedInstance.use({
  breaks: true,
  renderer: {
    code({ text, lang }) {
      if (lang === 'diff' || (!lang && /^(diff --git|---\s|@@\s)/.test(text))) {
        return renderDiffHtml(text);
      }
      const language = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`;
    },
  },
});

// --- Shared Styles ---

const markdownBaseStyles = {
  color: '#A9B7C6',
  lineHeight: 1.7,
  fontFamily: 'inherit',
  '& h1': {
    color: '#A9B7C6', fontSize: '1.4rem', fontWeight: 600, borderBottom: '1px solid #3C3F41', pb: 1, mb: 2,
  },
  '& h2': {
    color: '#A9B7C6', fontSize: '1.15rem', fontWeight: 600, mt: 3, mb: 1.5,
  },
  '& h3': {
    color: '#A9B7C6', fontSize: '1rem', fontWeight: 600, mt: 2, mb: 1,
  },
  '& p': { mb: 1.5 },
  '& ul, & ol': { pl: 3, mb: 1.5 },
  '& li': { mb: 0.5 },
  '& code': {
    bgcolor: '#3C3F41',
    color: '#CC7832',
    px: 0.75,
    py: 0.25,
    borderRadius: '4px',
    fontSize: '0.85em',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '& pre': {
    bgcolor: '#313335', border: '1px solid #4E5254', borderRadius: '6px', p: 2, overflow: 'auto', mb: 2,
  },
  '& pre code': { bgcolor: 'transparent', color: '#A9B7C6', p: 0 },
  '& blockquote': {
    borderLeft: '3px solid #4E5254', pl: 2, color: '#808080', ml: 0, mb: 1.5,
  },
  '& table:not(.diff-table)': { borderCollapse: 'collapse', width: '100%', mb: 2 },
  '& th, & td:not(.diff-line-num):not(.diff-line-content):not(.diff-hunk-info)': {
    border: '1px solid #4E5254', px: 1.5, py: 0.75, fontSize: '0.85rem',
  },
  '& th': { bgcolor: '#313335', fontWeight: 600 },
  '& a': { color: '#6897BB', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  '& hr': { border: 'none', borderTop: '1px solid #3C3F41', my: 3 },
  '& img': { maxWidth: '100%' },

  // --- Diff Styles ---
  '& .diff-container': {
    mb: 2,
  },
  '& .diff-file': {
    border: '1px solid #444d56',
    borderRadius: '6px',
    overflow: 'hidden',
    mb: 2,
  },
  '& .diff-file-header': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    bgcolor: '#2d333b',
    borderBottom: '1px solid #444d56',
    px: 1.5,
    py: 1,
    fontSize: '0.8rem',
    fontFamily: '"JetBrains Mono", monospace',
    color: '#adbac7',
    fontWeight: 600,
  },
  '& .diff-file-icon': {
    flexShrink: 0,
    color: '#768390',
  },
  '& .diff-file-name': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .diff-table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.78rem',
    lineHeight: 1.5,
    tableLayout: 'fixed',
  },
  '& .diff-line-num': {
    width: '50px',
    minWidth: '50px',
    maxWidth: '50px',
    px: 1,
    py: 0,
    textAlign: 'right',
    color: '#545d68',
    userSelect: 'none',
    verticalAlign: 'top',
    borderRight: '1px solid #373e47',
    fontSize: '0.72rem',
    lineHeight: '20px',
  },
  '& .diff-line-content': {
    px: 1.5,
    py: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: '20px',
    verticalAlign: 'top',
  },
  '& .diff-prefix': {
    display: 'inline-block',
    width: '12px',
    userSelect: 'none',
    color: 'inherit',
    fontWeight: 700,
  },
  '& .diff-hunk-row': {
    bgcolor: 'rgba(56, 139, 253, 0.10)',
  },
  '& .diff-hunk-info': {
    px: 1.5,
    py: 0.5,
    color: '#768390',
    fontSize: '0.75rem',
    fontFamily: '"JetBrains Mono", monospace',
    fontStyle: 'italic',
    lineHeight: '20px',
  },
  '& .diff-addition': {
    bgcolor: 'rgba(46, 160, 67, 0.12)',
    '& .diff-line-num': {
      bgcolor: 'rgba(46, 160, 67, 0.20)',
      color: '#57ab5a',
    },
    '& .diff-line-content': {
      color: '#adbac7',
    },
    '& .diff-prefix': {
      color: '#57ab5a',
    },
  },
  '& .diff-deletion': {
    bgcolor: 'rgba(248, 81, 73, 0.12)',
    '& .diff-line-num': {
      bgcolor: 'rgba(248, 81, 73, 0.20)',
      color: '#e5534b',
    },
    '& .diff-line-content': {
      color: '#adbac7',
    },
    '& .diff-prefix': {
      color: '#e5534b',
    },
  },
  '& .diff-context': {
    '& .diff-line-content': {
      color: '#8b949e',
    },
  },
};

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
  return ok;
}

const COPY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

const MarkdownRenderer = ({ content, fontSize = '0.85rem', sx = {} }) => {
  const renderedHtml = useMemo(() => markedInstance.parse(content || ''), [content]);
  const boxRef = useRef(null);

  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    const pres = container.querySelectorAll('pre');
    const cleanups = [];

    for (const pre of pres) {
      if (pre.querySelector('.copy-code-btn')) continue;
      pre.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.innerHTML = COPY_ICON;
      btn.title = 'Copy code';

      const handleClick = () => {
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;

        const onSuccess = () => {
          btn.innerHTML = CHECK_ICON;
          setTimeout(() => { btn.innerHTML = COPY_ICON; }, 1500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
            fallbackCopy(text) && onSuccess();
          });
        } else {
          fallbackCopy(text) && onSuccess();
        }
      };

      btn.addEventListener('click', handleClick);
      pre.appendChild(btn);
      cleanups.push(() => {
        btn.removeEventListener('click', handleClick);
        btn.remove();
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, [renderedHtml]);

  return (
    <Box
      ref={boxRef}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
      sx={{
        ...markdownBaseStyles,
        fontSize,
        '& pre .copy-code-btn': {
          position: 'absolute',
          top: 8,
          right: 8,
          bgcolor: '#3C3F41',
          border: '1px solid #4E5254',
          borderRadius: '4px',
          color: '#808080',
          cursor: 'pointer',
          p: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s, color 0.2s, background-color 0.2s',
          '&:hover': {
            bgcolor: '#4E5254',
            color: '#A9B7C6',
          },
        },
        '& pre:hover .copy-code-btn': {
          opacity: 1,
        },
        '@media (hover: none)': {
          '& pre .copy-code-btn': {
            opacity: 1,
          },
        },
        ...sx,
      }}
    />
  );
};

export default MarkdownRenderer;
