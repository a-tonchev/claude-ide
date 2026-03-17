import SettingsServices from './services/SettingsServices';
import SettingsEnums from './enums/SettingsEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[SettingsEnums.COLLECTION_NAME];

  return {
    [SettingsEnums.COLLECTION_NAME]: new SettingsServices(collection),
  };
};

export default setupServices;
