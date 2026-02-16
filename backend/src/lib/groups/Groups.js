import GroupRoutes from './controller/GroupRoutes';
import GroupEnums from './enums/GroupEnums';
import setupCollection from './setupCollection';
import GroupSchema from './schema/GroupSchema';
import setupServices from './setupServices';

const Groups = {
  collectionName: GroupEnums.COLLECTION_NAME,
  setupCollection,
  schema: GroupSchema,
  setupServices,
  routes: GroupRoutes,
};

export default Groups;
