import TerminalRoutes from './controller/TerminalRoutes';
import TerminalEnums from './enums/TerminalEnums';
import setupCollection from './setupCollection';
import TerminalSchema from './schema/TerminalSchema';
import setupServices from './setupServices';

const Terminals = {
  collectionName: TerminalEnums.COLLECTION_NAME,
  setupCollection,
  schema: TerminalSchema,
  setupServices,
  routes: TerminalRoutes,
};

export default Terminals;
