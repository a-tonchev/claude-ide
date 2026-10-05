import InstanceEnums from './enums/InstanceEnums';
import setupCollection from './setupCollection';
import InstanceSchema from './schema/InstanceSchema';

// Collection setup only. Reads and writes go through modules/instanceStore, and the
// instance routes are registered in startup/routes/routes.js.
const Instances = {
  collectionName: InstanceEnums.COLLECTION_NAME,
  setupCollection,
  schema: InstanceSchema,
};

export default Instances;
