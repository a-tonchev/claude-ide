import SettingsRoutes from './controller/SettingsRoutes';
import SettingsEnums from './enums/SettingsEnums';
import setupCollection from './setupCollection';
import SettingsSchema from './schema/SettingsSchema';
import setupServices from './setupServices';

const Settings = {
  collectionName: SettingsEnums.COLLECTION_NAME,
  setupCollection,
  schema: SettingsSchema,
  setupServices,
  routes: SettingsRoutes,
};

export default Settings;
