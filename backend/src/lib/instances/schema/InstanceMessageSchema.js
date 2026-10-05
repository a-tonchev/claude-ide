import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import { FeedKinds } from '../enums/InstanceEnums';

const { _id, date, basicString } = CommonSchemaFields;

// One document per feed item (user message, Claude message, milestone). Feeds are
// read in _id order, which is insertion order.
const InstanceMessageSchema = {
  bsonType: 'object',
  required: ['instanceId', 'kind', 'timestamp'],
  additionalProperties: false,
  properties: {
    _id,
    instanceId: basicString,
    kind: { enum: Object.values(FeedKinds) },
    text: basicString,
    type: basicString,
    accomplished: basicString,
    workingOn: basicString,
    // Files attached to a user message; id is the stored file name in the instance's folder
    attachments: {
      bsonType: 'array',
      items: {
        bsonType: 'object',
        required: ['id', 'name'],
        additionalProperties: false,
        properties: {
          id: basicString,
          name: basicString,
          size: { bsonType: ['int', 'long', 'double'] },
          mime: basicString,
        },
      },
    },
    timestamp: date,
  },
};

export default InstanceMessageSchema;
