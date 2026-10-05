// Copy text to the clipboard from a click handler. Returns a promise of true/false.
//
// The Clipboard API exists only on secure origins (https, localhost); a phone on
// http://<LAN IP> has none, so the fallback copies a selected, hidden textarea. That textarea
// goes next to `anchor` (inside an open MUI dialog), because a dialog's focus trap pulls focus
// back from anything outside it and the selection is lost. iOS also needs a read-only field and
// an explicit selection range.

function copyWithTextarea(text, anchor) {
  const host = anchor?.closest?.('[role="dialog"]') || document.body;
  const active = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  // 16px keeps iOS from zooming in; it stays on screen (some browsers refuse off-screen copies)
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;'
    + 'opacity:0;font-size:16px;pointer-events:none;';
  host.appendChild(ta);
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  if (active && typeof active.focus === 'function') active.focus({ preventScroll: true });
  return ok;
}

export async function copyText(text, anchor) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission refused or the document lost focus: try the textarea below
    }
  }
  return copyWithTextarea(text, anchor);
}

// Selects everything inside `element`, so the user can copy it with the device's own menu
export function selectContents(element) {
  if (!element) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

export default { copyText, selectContents };
