import GroupServices from './services/GroupServices';
import GroupEnums from './enums/GroupEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[GroupEnums.COLLECTION_NAME];

  return {
    [GroupEnums.COLLECTION_NAME]: new GroupServices(collection),
  };
};

export default setupServices;
