import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import ProjectSchemaFields from './ProjectSchemaFields';

const { name, path } = ProjectSchemaFields;
const { _id, date } = CommonSchemaFields;

const ProjectSchema = {
  bsonType: 'object',
  required: ['name', 'path', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    name,
    path,
    updatedAt: date,
    createdAt: date,
  },
};

export default ProjectSchema;
