import SettingsSchema from './schema/SettingsSchema';
import SettingsEnums from './enums/SettingsEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, SettingsEnums.COLLECTION_NAME, SettingsSchema);
  const collection = mongoDb.collection(SettingsEnums.COLLECTION_NAME);
  await collection.createIndex({ type: 1, name: 1 }, { unique: true });
};

export default setupCollection;
