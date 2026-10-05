import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import { AiProviders, InstanceTypes } from '../enums/InstanceEnums';

const { date } = CommonSchemaFields;
const nullableString = { bsonType: ['string', 'null'] };

// One document per AI instance, running or remembered. _id is the instance id (a
// UUID string), reused on resume so the instance's messages and plans stay linked.
const InstanceSchema = {
  bsonType: 'object',
  required: ['_id', 'type', 'provider', 'cwd', 'status', 'createdAt', 'updatedAt'],
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    type: { enum: Object.values(InstanceTypes) },
    provider: { enum: Object.values(AiProviders) },
    sessionId: nullableString,
    projectId: nullableString,
    projectName: nullableString,
    title: nullableString,
    cwd: { bsonType: 'string' },
    groupId: nullableString,
    savedItemId: nullableString,
    flagIds: { bsonType: 'array', items: { bsonType: 'string' } },
    status: { bsonType: 'string' },
    pendingInput: { bsonType: ['object', 'null'] },
    resumeError: nullableString,
    startedAt: date,
    lastActiveAt: date,
    createdAt: date,
    updatedAt: date,
  },
};

export default InstanceSchema;
