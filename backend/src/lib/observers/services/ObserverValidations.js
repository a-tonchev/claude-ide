import ObserverSchemaFields from '../schema/ObserverSchemaFields';

const { name, instructions, path } = ObserverSchemaFields;

const CreateObserverSchema = {
  bsonType: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name,
    instructions,
    path,
  },
};

const UpdateObserverSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    name,
    instructions,
    path,
  },
};

const ObserverValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreateObserverSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdateObserverSchema,
    );
  },
};

export default ObserverValidations;
