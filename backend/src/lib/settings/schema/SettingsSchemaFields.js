const SettingsSchemaFields = {
  type: {
    bsonType: 'string',
    minLength: 1,
  },
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  dbPath: {
    bsonType: 'string',
  },
  dbName: {
    bsonType: 'string',
  },
  username: {
    bsonType: 'string',
  },
  encryptedPassword: {
    bsonType: 'string',
  },
  instructions: {
    bsonType: 'string',
  },
  // launchFlag: command-line text appended after `claude`
  args: {
    bsonType: 'string',
  },
};

export default SettingsSchemaFields;
