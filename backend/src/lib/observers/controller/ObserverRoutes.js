import createBasicRoutes from '#modules/routing/createRoutes';

import ObserverController from './ObserverController';
import ObserverValidations from '../services/ObserverValidations';

const ObserverRoutes = createBasicRoutes({
  prefix: '/observers',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: ObserverController.getAll,
    },
    {
      method: 'post',
      path: '/add',
      validation: ObserverValidations.validateCreate,
      handler: ObserverController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: ObserverValidations.validateUpdate,
      handler: ObserverController.update,
    },
    {
      method: 'post',
      path: '/delete',
      handler: ObserverController.remove,
    },
    // MCP tool endpoints
    {
      method: 'post',
      path: '/getInstructions',
      handler: ObserverController.getInstructions,
    },
    {
      method: 'post',
      path: '/setInstructions',
      handler: ObserverController.setInstructions,
    },
  ],
});

export default ObserverRoutes;
