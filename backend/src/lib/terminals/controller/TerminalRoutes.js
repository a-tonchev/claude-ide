import createBasicRoutes from '#modules/routing/createRoutes';

import TerminalController from './TerminalController';
import TerminalValidations from '../services/TerminalValidations';

const TerminalRoutes = createBasicRoutes({
  prefix: '/terminals',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: TerminalController.getAll,
    },
    {
      method: 'post',
      path: '/add',
      validation: TerminalValidations.validateCreate,
      handler: TerminalController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: TerminalValidations.validateUpdate,
      handler: TerminalController.update,
    },
    {
      method: 'post',
      path: '/delete',
      handler: TerminalController.remove,
    },
  ],
});

export default TerminalRoutes;
