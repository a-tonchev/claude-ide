import TerminalSchema from './schema/TerminalSchema';
import TerminalEnums from './enums/TerminalEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, TerminalEnums.COLLECTION_NAME, TerminalSchema);
  const collection = mongoDb.collection(TerminalEnums.COLLECTION_NAME);
  await collection.createIndex({ name: 1 }, { unique: true });
};

export default setupCollection;
