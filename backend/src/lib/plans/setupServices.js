import PlanServices from './services/PlanServices';
import PlanEnums from './enums/PlanEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[PlanEnums.COLLECTION_NAME];

  return {
    [PlanEnums.COLLECTION_NAME]: new PlanServices(collection),
  };
};

export default setupServices;
