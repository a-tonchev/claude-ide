import ProjectServices from './services/ProjectServices';
import ProjectEnums from './enums/ProjectEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[ProjectEnums.COLLECTION_NAME];

  return {
    [ProjectEnums.COLLECTION_NAME]: new ProjectServices(collection),
  };
};

export default setupServices;
