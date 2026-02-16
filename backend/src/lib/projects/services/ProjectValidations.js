import ProjectSchemaFields from '../schema/ProjectSchemaFields';

const { name, path } = ProjectSchemaFields;

const CreateProjectSchema = {
  bsonType: 'object',
  required: ['name', 'path'],
  additionalProperties: false,
  properties: {
    name,
    path,
  },
};

const UpdateProjectSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    name,
    path,
  },
};

const ProjectValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreateProjectSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdateProjectSchema,
    );
  },
};

export default ProjectValidations;
