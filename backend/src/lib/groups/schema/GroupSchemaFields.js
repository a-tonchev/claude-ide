const GroupSchemaFields = {
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  items: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      properties: {
        type: { bsonType: 'string', enum: ['claude', 'terminal'] },
        projectId: { bsonType: 'string' },
        name: { bsonType: 'string' },
        path: { bsonType: 'string' },
        shell: { bsonType: 'string' },
        command: { bsonType: 'string' },
        cwd: { bsonType: 'string' },
      },
    },
  },
};

export default GroupSchemaFields;
