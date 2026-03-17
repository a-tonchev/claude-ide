import SettingsSchemaFields from '../schema/SettingsSchemaFields';

const {
  type, name, dbPath, dbName, username, instructions,
} = SettingsSchemaFields;

const CreateSettingsSchema = {
  bsonType: 'object',
  required: ['type', 'name'],
  additionalProperties: false,
  properties: {
    type,
    name,
    dbPath,
    dbName,
    username,
    password: { bsonType: 'string' },
    instructions,
  },
};

const UpdateSettingsSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    type,
    name,
    dbPath,
    dbName,
    username,
    password: { bsonType: 'string' },
    instructions,
  },
};

const SettingsValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreateSettingsSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdateSettingsSchema,
    );
  },
};

export default SettingsValidations;
