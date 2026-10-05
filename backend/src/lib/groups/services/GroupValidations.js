import GroupSchemaFields from '../schema/GroupSchemaFields';

const { name, draft, items } = GroupSchemaFields;

const CreateGroupSchema = {
  bsonType: 'object',
  required: ['name', 'items'],
  additionalProperties: false,
  properties: {
    name,
    draft,
    items,
  },
};

const UpdateGroupSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    name,
    draft,
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
