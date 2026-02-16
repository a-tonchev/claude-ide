import GroupSchema from './schema/GroupSchema';
import GroupEnums from './enums/GroupEnums';

const setupCollection = async (mongoDb, createCollection) => {
  await createCollection(mongoDb, GroupEnums.COLLECTION_NAME, GroupSchema);
};

export default setupCollection;
