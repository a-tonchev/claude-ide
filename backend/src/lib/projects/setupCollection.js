import ProjectSchema from './schema/ProjectSchema';
import ProjectEnums from './enums/ProjectEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, ProjectEnums.COLLECTION_NAME, ProjectSchema);
  const collection = mongoDb.collection(ProjectEnums.COLLECTION_NAME);
  await collection.createIndex({ path: 1 }, { unique: true });
};

export default setupCollection;
