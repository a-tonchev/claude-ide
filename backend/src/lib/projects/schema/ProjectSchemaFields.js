const ProjectSchemaFields = {
  name: {
    bsonType: 'string',
    minLength: 1,
  },
  path: {
    bsonType: 'string',
    minLength: 1,
  },
};

export default ProjectSchemaFields;
