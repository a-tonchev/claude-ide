const GroupSchemaFields = {
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  // Unsaved groups are stored as drafts from creation so their id never changes
  // and instance records can point to them.
  draft: {
    bsonType: 'bool',
  },
  items: {
    bsonType: 'array',
    items: {
      bsonType: 'object',
      properties: {
        id: { bsonType: 'string' },
        provider: { bsonType: 'string', enum: ['claude', 'codex'] },
        type: { bsonType: 'string', enum: ['claude', 'terminal'] },
        projectId: { bsonType: 'string' },
        name: { bsonType: 'string' },
        path: { bsonType: 'string' },
        shell: { bsonType: 'string' },
        command: { bsonType: 'string' },
        cwd: { bsonType: 'string' },
        // claude items: ids of launchFlag settings docs to apply on start
        flagIds: { bsonType: 'array', items: { bsonType: 'string' } },
      },
    },
  },
};

export default GroupSchemaFields;
