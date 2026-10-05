import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import getRequestError from '../frontend/src/helpers/requestErrorHelper.js';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { transformSync, types: t } = require('@babel/core');
const componentNames = new Set();
const { code } = transformSync(readFileSync(new URL(
  '../frontend/src/components/NewInstanceDialog/NewInstanceDialog.jsx', import.meta.url,
), 'utf8'), {
  configFile: false,
  babelrc: false,
  presets: [require.resolve('@babel/preset-react')],
  plugins: [() => ({ visitor: {
    ImportDeclaration(path) {
      path.node.specifiers.forEach(specifier => componentNames.add(specifier.local.name));
      path.remove();
    },
    ExportDefaultDeclaration(path) {
      path.replaceWith(t.expressionStatement(t.assignmentExpression('=',
        t.memberExpression(t.identifier('globalThis'), t.identifier('TestDialog')), path.node.declaration)));
    },
  } })],
});

// Run the real component's callbacks with an isolated hook store and mocked
// network. No browser, backend, database, or agent process is touched.
function harness(onCreate, projectsResult = { ok: true, data: { projects: [{ _id: 'project', name: 'Project', path: 'D:/project' }] } }) {
  const hooks = [];
  const effects = [];
  let index = 0;
  let closed = 0;
  const context = vm.createContext({
    ...Object.fromEntries([...componentNames].map(name => [name, name])),
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useState(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
    },
    useCallback: callback => callback,
    useEffect(effect, dependencies) {
      const slot = index++;
      if (!hooks[slot] || dependencies.some((value, i) => value !== hooks[slot][i])) effects.push(effect);
      hooks[slot] = dependencies;
    },
    Connections: { postRequest: async () => projectsResult },
    ApiEndpoints: { projectsAll: '/projects/all' },
    getRequestError,
  });
  vm.runInContext(code, context);
  const render = () => {
    index = 0;
    const tree = context.TestDialog({ open: true, defaultProvider: 'codex', onCreate, onClose: () => { closed += 1; } });
    while (effects.length) effects.shift()();
    return tree;
  };
  return { render, closed: () => closed };
}

function find(tree, type, predicate = () => true) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type === type && predicate(tree.props)) return tree.props;
  for (const child of (tree.props?.children || []).flat(Infinity)) {
    const result = find(child, type, predicate);
    if (result) return result;
  }
  return undefined;
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const addButton = tree => find(tree, 'Button', props => props.variant === 'contained');

test('waits for save, blocks duplicate clicks, retains selection on failure, and retries', async () => {
  let finish;
  const calls = [];
  const h = harness((...args) => { calls.push(args); return new Promise(resolve => { finish = resolve; }); });
  h.render();
  await settle();
  find(h.render(), 'ListItemButton').onClick();
  const click = addButton(h.render()).onClick;
  const pending = click();
  await click();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['project', 'Project', 'D:/project', 'codex']);
  assert.equal(h.closed(), 0);
  assert.equal(addButton(h.render()).disabled, true);
  find(h.render(), 'Dialog').onClose();
  assert.equal(h.closed(), 0);
  finish({ ok: false, errorData: { message: 'Could not save this group' } });
  await pending;
  assert.equal(h.closed(), 0);
  assert.equal(find(h.render(), 'Alert').children[0], 'Could not save this group');
  assert.equal(find(h.render(), 'ToggleButtonGroup').value, 'codex');
  assert.equal(addButton(h.render()).disabled, false);
  const retry = addButton(h.render()).onClick();
  finish({ ok: true });
  await retry;
  assert.equal(h.closed(), 1);
});

test('thrown save errors keep the dialog open and allow retry', async () => {
  const h = harness(async () => { throw new Error('The selected group is unavailable'); });
  h.render();
  await settle();
  find(h.render(), 'ListItemButton').onClick();
  await addButton(h.render()).onClick();
  assert.equal(h.closed(), 0);
  assert.equal(find(h.render(), 'Alert').children[0], 'The selected group is unavailable');
  assert.equal(addButton(h.render()).disabled, false);
});

test('project-loading failures are visible and cannot submit a stale selection', async () => {
  const h = harness(() => assert.fail('must not submit'), { ok: false, online: false });
  h.render();
  await settle();
  assert.match(find(h.render(), 'Alert').children[0], /Cannot reach the server/);
  assert.equal(addButton(h.render()).disabled, true);
});

test('validation errors retain field details', () => {
  assert.equal(getRequestError({ errorData: { detailedErrors: [
    { errorPath: 'items[3].provider', message: 'must be a valid provider' },
  ] } }, 'Failed'), 'items[3].provider: must be a valid provider');
});
