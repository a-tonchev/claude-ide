import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const Ajv = require('ajv-draft-04').default;
function load(relative, dependencies = {}) {
  const source = readFileSync(new URL(`../backend/src/${relative}`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\r?$/gm, '')
    .replace(/export default (\w+);/, 'globalThis.result = $1;');
  const context = vm.createContext({ ...dependencies, console });
  vm.runInContext(source, context, { filename: relative });
  return context.result;
}
const CommonSchemaFields = load('modules/validation/CommonSchemaFields.js');
const AjvBsonType = load('modules/validation/ajv/AjvBsonType.js');
const Validations = load('modules/validation/Validations.js', { Ajv, AjvBsonType, cloneDeep: structuredClone });
const PlanSchemaFields = load('lib/plans/schema/PlanSchemaFields.js', { PlanStatuses: { DRAFT: 'draft' } });
const PlanValidations = load('lib/plans/services/PlanValidations.js', { CommonSchemaFields, PlanSchemaFields });

// Exercise the route's actual validation with real Ajv; schema keys must not be
// interpreted as URI references (serialized schemas contain colons and regexes).
test('send_plan payload validates repeatedly without registering JSON as a schema URI', () => {
  const errors = [];
  const ctx = {
    request: { body: {
      project_id: '507f1f77bcf86cd799439011', instance_id: 'agent-1',
      title: 'Implementation', content: '# Plan\n\n1. Fix the issue.', status: 'draft',
    } },
    modS: {
      validations: Validations,
      responses: { CustomErrors: { BAD_REQUEST: 'bad' }, createErrorResponse(...args) { errors.push(args); return false; } },
    },
  };
  assert.equal(PlanValidations.validateCreate(ctx), true);
  assert.equal(PlanValidations.validateCreate(ctx), true);
  assert.equal(errors.length, 0);
  ctx.request.body.project_id = 'invalid';
  assert.equal(PlanValidations.validateCreate(ctx), false);
  assert.equal(errors.length, 1);
  ctx.request.body.project_id = '507f1f77bcf86cd799439011';
  ctx.request.body.content = '';
  assert.equal(PlanValidations.validateCreate(ctx), false);
});

test('saved plan persists instance identity and publishes the dashboard event only after insertion', async () => {
  const events = [];
  const documents = [];
  const controller = load('lib/plans/controller/PlanController.js', {
    DatabaseHelpers: { getObjectId: id => id },
    WsHandler: { publish: (...args) => events.push(args) },
    PlanStatuses: { DRAFT: 'draft' },
  });
  const ctx = {
    request: { body: {
      project_id: '507f1f77bcf86cd799439011', instance_id: 'agent-1',
      title: 'Implementation', content: '# Plan', status: 'draft',
    } },
    libS: { plans: { async add(doc) {
      assert.equal(events.length, 0);
      documents.push(doc);
      return { insertedId: 'plan-1' };
    } } },
    modS: { responses: {
      CustomErrors: { BAD_REQUEST: 'bad' },
      createSuccessResponse: (_, data) => ({ ok: true, data }),
      createErrorResponse: () => ({ ok: false }),
    } },
  };
  const result = await controller.create(ctx);
  assert.equal(result.ok, true);
  assert.equal(result.data._id, 'plan-1');
  assert.equal(documents[0].instance_id, 'agent-1');
  assert.equal(documents[0].content, '# Plan');
  assert.equal(events[0][0], 'instance_agent-1');
  assert.equal(events[0][1].type, 'plan_saved');
  assert.equal(events[0][1].planId, 'plan-1');
  assert.equal(events[0][1].content, '# Plan');
  events.length = 0;
  ctx.libS.plans.add = async () => { throw new Error('Insert failed'); };
  assert.equal((await controller.create(ctx)).ok, false);
  assert.equal(events.length, 0);
});
