import PlanRoutes from './controller/PlanRoutes';
import PlanEnums from './enums/PlanEnums';
import setupCollection from './setupCollection';
import PlanSchema from './schema/PlanSchema';
import setupServices from './setupServices';

const Plans = {
  collectionName: PlanEnums.COLLECTION_NAME,
  setupCollection,
  schema: PlanSchema,
  setupServices,
  routes: PlanRoutes,
};

export default Plans;
