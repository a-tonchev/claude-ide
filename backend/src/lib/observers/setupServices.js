import ObserverServices from './services/ObserverServices';
import ObserverEnums from './enums/ObserverEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[ObserverEnums.COLLECTION_NAME];

  return {
    [ObserverEnums.COLLECTION_NAME]: new ObserverServices(collection),
  };
};

export default setupServices;
