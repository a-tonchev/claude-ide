import createBasicRoutes from '#modules/routing/createRoutes';

import SettingsController from './SettingsController';
import SettingsValidations from '../services/SettingsValidations';

const SettingsRoutes = createBasicRoutes({
  prefix: '/settings',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: SettingsController.getAll,
    },
    {
      method: 'post',
      path: '/add',
      validation: SettingsValidations.validateCreate,
      handler: SettingsController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: SettingsValidations.validateUpdate,
      handler: SettingsController.update,
    },
    {
      method: 'post',
      path: '/delete',
      handler: SettingsController.remove,
    },
    // MCP tool endpoint
    {
      method: 'post',
      path: '/getCredentials',
      handler: SettingsController.getCredentials,
    },
  ],
});

export default SettingsRoutes;
