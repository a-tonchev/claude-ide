import TerminalSchemaFields from '../schema/TerminalSchemaFields';

const { name, shell, command, cwd } = TerminalSchemaFields;

const CreateTerminalSchema = {
  bsonType: 'object',
  required: ['name', 'shell'],
  additionalProperties: false,
  properties: {
    name,
    shell,
    command,
    cwd,
  },
};

const UpdateTerminalSchema = {
  bsonType: 'object',
  additionalProperties: false,
  properties: {
    _id: { bsonType: 'string' },
    name,
    shell,
    command,
    cwd,
  },
};

const TerminalValidations = {
  validateCreate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      CreateTerminalSchema,
    );
  },

  validateUpdate(ctx) {
    return ctx.modS.validations.validateSchema(
      ctx,
      ctx.request.body,
      UpdateTerminalSchema,
    );
  },
};

export default TerminalValidations;
