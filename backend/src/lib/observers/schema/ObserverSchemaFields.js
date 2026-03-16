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
};

export default ObserverSchemaFields;
