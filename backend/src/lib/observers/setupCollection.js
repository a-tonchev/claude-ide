import ObserverSchema from './schema/ObserverSchema';
import ObserverEnums from './enums/ObserverEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, ObserverEnums.COLLECTION_NAME, ObserverSchema);
  const collection = mongoDb.collection(ObserverEnums.COLLECTION_NAME);
  await collection.createIndex({ name: 1 }, { unique: true });
};

export default setupCollection;
