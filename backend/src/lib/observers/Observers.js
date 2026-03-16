import ObserverRoutes from './controller/ObserverRoutes';
import ObserverEnums from './enums/ObserverEnums';
import setupCollection from './setupCollection';
import ObserverSchema from './schema/ObserverSchema';
import setupServices from './setupServices';

const Observers = {
  collectionName: ObserverEnums.COLLECTION_NAME,
  setupCollection,
  schema: ObserverSchema,
  setupServices,
  routes: ObserverRoutes,
};

export default Observers;
