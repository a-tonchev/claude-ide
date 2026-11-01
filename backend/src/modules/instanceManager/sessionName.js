// Claude Code session names: what other Claude Code sessions see in ListAgents and use to
// address a cross-session SendMessage. An instance's IDE title becomes its session name:
// `claude -n <name>` at launch, `/rename <name>` typed into the PTY when the title changes.
// Everything here is pure, so it is unit-tested without a PTY.

const MAX_SESSION_NAME = 60;

// Bulgarian streamlined system; the Russian/Ukrainian extras follow the same spirit.
const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
  ё: 'yo', ы: 'y', э: 'e', і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
};

function slug(text) {
  if (typeof text !== 'string') return null;
  const latin = [...text.toLowerCase()].map(ch => CYRILLIC[ch] ?? ch).join('')
    // é → e: drop the combining marks after decomposing
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  const name = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, MAX_SESSION_NAME).replace(/-+$/, '');
  return name || null;
}

// The session name for a title, or for `fallback` (the project name) when the title gives
// none. Always [a-z0-9-], so it is safe on any command line. null when neither gives one.
export function sessionNameFor(title, fallback) {
  return slug(title) || slug(fallback) || null;
}

// The argv part that names a new or resumed Claude session; nothing without a title, so
// Claude keeps its own default name.
export function sessionNameArgs(title, projectName) {
  const name = title ? sessionNameFor(title, projectName) : null;
  return name ? ['-n', name] : [];
}

// The name a title change should rename a running session to, or null for "leave it".
// Clearing the title goes back to the project name, unless the session never had a name
// from the IDE (it still has Claude's default, which is what a reset means then).
export function renameTarget({ title, projectName, currentName }) {
  const target = title || currentName ? sessionNameFor(title, projectName) : null;
  return target && target !== currentName ? target : null;
}

// Typing into the PTY can answer whatever prompt is open: a startup dialog such as the
// folder trust check (status stays 'running' until Claude's input prompt shows), a question
// the instance asked (pendingInput / waiting), a plan waiting for approval, or a user
// message still being typed and submitted by the backend (inputInFlight). Ready, working
// or thinking is fine: Claude Code queues what is typed.
const UNSAFE_STATUSES = new Set(['running', 'waiting', 'waiting_input', 'plan_ready']);

export function canTypeNow({ status, pendingInput, inputInFlight }) {
  return status !== 'exited' && !pendingInput && !UNSAFE_STATUSES.has(status) && !inputInFlight;
}

// What to do with a remembered rename now:
//   none  — nothing pending;
//   drop  — the instance is gone;
//   type  — type `command` + Enter;
//   retry — only the backend's own typing is in the way: try again shortly;
//   wait  — a prompt is open: try again when the status changes.
export function renameStep({ pendingName, status, pendingInput, inputInFlight }) {
  if (!pendingName) return { action: 'none' };
  if (status === 'exited') return { action: 'drop' };
  if (canTypeNow({ status, pendingInput, inputInFlight })) {
    return { action: 'type', command: `/rename ${pendingName}` };
  }
  return { action: canTypeNow({ status, pendingInput }) ? 'retry' : 'wait' };
}
