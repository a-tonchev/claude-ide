import InstanceEnums from './enums/InstanceEnums';
import InstanceSchema from './schema/InstanceSchema';
import InstanceMessageSchema from './schema/InstanceMessageSchema';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, InstanceEnums.COLLECTION_NAME, InstanceSchema);
  await createCollection(mongoDb, InstanceEnums.MESSAGES_COLLECTION_NAME, InstanceMessageSchema);
  await mongoDb.collection(InstanceEnums.MESSAGES_COLLECTION_NAME).createIndex({ instanceId: 1, _id: 1 });
};

export default setupCollection;
