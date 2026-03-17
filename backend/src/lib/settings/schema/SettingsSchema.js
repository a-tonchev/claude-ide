import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import SettingsSchemaFields from './SettingsSchemaFields';

const {
  type, name, dbPath, dbName, username, encryptedPassword, instructions,
} = SettingsSchemaFields;
const { _id, date } = CommonSchemaFields;

const SettingsSchema = {
  bsonType: 'object',
  required: ['type', 'name', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    type,
    name,
    dbPath,
    dbName,
    username,
    encryptedPassword,
    instructions,
    updatedAt: date,
    createdAt: date,
  },
};

export default SettingsSchema;
