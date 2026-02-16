import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import GroupSchemaFields from './GroupSchemaFields';

const { name, items } = GroupSchemaFields;
const { _id, date } = CommonSchemaFields;

const GroupSchema = {
  bsonType: 'object',
  required: ['name', 'items', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    name,
    items,
    updatedAt: date,
    createdAt: date,
  },
};

export default GroupSchema;
