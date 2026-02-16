import CommonSchemaFields from '#modules/validation/CommonSchemaFields';
import TerminalSchemaFields from './TerminalSchemaFields';

const { name, shell, command, cwd } = TerminalSchemaFields;
const { _id, date } = CommonSchemaFields;

const TerminalSchema = {
  bsonType: 'object',
  required: ['name', 'shell', 'updatedAt', 'createdAt'],
  additionalProperties: false,
  properties: {
    _id,
    name,
    shell,
    command,
    cwd,
    updatedAt: date,
    createdAt: date,
  },
};

export default TerminalSchema;
