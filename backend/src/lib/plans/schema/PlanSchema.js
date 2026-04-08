import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import PlanSchemaFields from './PlanSchemaFields';

const {
  project_id, instance_id, title, prompt, content, status, seen,
} = PlanSchemaFields;

const { _id, date } = CommonSchemaFields;

const PlanSchema = {
  bsonType: 'object',
  required: ['project_id', 'content', 'status', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    project_id,
    instance_id,
    title,
    prompt,
    content,
    status,
    seen,
    updatedAt: date,
    createdAt: date,
  },
};

export default PlanSchema;
