const ObserverSchemaFields = {
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  instructions: {
    bsonType: 'string',
  },
  path: {
    bsonType: 'string',
  },
  keepassSettingsId: {
    bsonType: 'string',
  },
  keepassEntryPath: {
    bsonType: 'string',
  },
};

export default ObserverSchemaFields;
