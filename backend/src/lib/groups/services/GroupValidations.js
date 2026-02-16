import GroupSchemaFields from '../schema/GroupSchemaFields';

const { name, items } = GroupSchemaFields;

const CreateGroupSchema = {
  bsonType: 'object',
  required: ['name', 'items'],
  additionalProperties: false,
  properties: {
    name,
    items,
  },
};

const UpdateGroupSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    name,
    items,
  },
};

const GroupValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreateGroupSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdateGroupSchema,
    );
  },
};

export default GroupValidations;
