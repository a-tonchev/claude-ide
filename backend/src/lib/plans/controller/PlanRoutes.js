import createBasicRoutes from '#modules/routing/createRoutes';

import PlanController from './PlanController';
import PlanValidations from '../services/PlanValidations';

const PlanRoutes = createBasicRoutes({
  prefix: '/plans',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: PlanController.getAll,
    },
    {
      method: 'post',
      path: '/get',
      handler: PlanController.getById,
    },
    {
      method: 'post',
      path: '/add',
      validation: PlanValidations.validateCreate,
      handler: PlanController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: PlanValidations.validateUpdate,
      handler: PlanController.update,
    },
    {
      method: 'post',
      path: '/markSeen',
      handler: PlanController.markSeen,
    },
    {
      method: 'post',
      path: '/delete',
      handler: PlanController.remove,
    },
    {
      method: 'post',
      path: '/deleteAll',
      handler: PlanController.removeAll,
    },
  ],
});

export default PlanRoutes;
