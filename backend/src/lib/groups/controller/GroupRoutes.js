import createBasicRoutes from '#modules/routing/createRoutes';

import GroupController from './GroupController';
import GroupValidations from '../services/GroupValidations';

const GroupRoutes = createBasicRoutes({
  prefix: '/groups',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: GroupController.getAll,
    },
    {
      method: 'post',
      path: '/add',
      validation: GroupValidations.validateCreate,
      handler: GroupController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: GroupValidations.validateUpdate,
      handler: GroupController.update,
    },
    {
      method: 'post',
      path: '/delete',
      handler: GroupController.remove,
    },
  ],
});

export default GroupRoutes;
