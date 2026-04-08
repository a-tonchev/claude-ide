import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import PlanSchemaFields from '../schema/PlanSchemaFields';

const { title, prompt, content, status, seen } = PlanSchemaFields;

const CreatePlanSchema = {
  bsonType: 'object',
  required: ['project_id', 'content'],
  additionalProperties: false,
  properties: {
    project_id: CommonSchemaFields._idString,
    instance_id: { bsonType: 'string' },
    title,
    prompt,
    content,
    status,
  },
};

const UpdatePlanSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    title,
    prompt,
    content,
    status,
    seen,
  },
};

const PlanValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreatePlanSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdatePlanSchema,
    );
  },
};

export default PlanValidations;
