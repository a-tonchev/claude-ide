import PlanSchema from './schema/PlanSchema';
import PlanEnums from './enums/PlanEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, PlanEnums.COLLECTION_NAME, PlanSchema);
  const collection = mongoDb.collection(PlanEnums.COLLECTION_NAME);
  await collection.createIndex({ project_id: 1 });
  await collection.createIndex({ instance_id: 1 });
};

export default setupCollection;
