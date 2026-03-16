import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import ObserverSchemaFields from './ObserverSchemaFields';

const { name, instructions, path } = ObserverSchemaFields;
const { _id, date } = CommonSchemaFields;

const ObserverSchema = {
  bsonType: 'object',
  required: ['name', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    name,
    instructions,
    path,
    updatedAt: date,
    createdAt: date,
  },
};

export default ObserverSchema;
