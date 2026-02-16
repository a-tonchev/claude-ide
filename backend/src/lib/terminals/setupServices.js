import TerminalServices from './services/TerminalServices';
import TerminalEnums from './enums/TerminalEnums';

const setupServices = ctx => {
  const { db } = ctx;
  const collection = db[TerminalEnums.COLLECTION_NAME];

  return {
    [TerminalEnums.COLLECTION_NAME]: new TerminalServices(collection),
  };
};

export default setupServices;
