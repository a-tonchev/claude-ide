import createBasicRoutes from '#modules/routing/createRoutes';
import InstanceController from './InstanceController';

// /:id/* routes are called by the MCP server running inside each instance; the others
// by the dashboard.
const InstanceRoutes = createBasicRoutes({
  prefix: '/instances',
  routeData: [
    {
      method: 'post',
      path: '/remembered',
      handler: InstanceController.getRemembered,
    },
    {
      method: 'post',
      path: '/remembered/remove',
      handler: InstanceController.removeRemembered,
    },
    {
      method: 'post',
      path: '/feed',
      handler: InstanceController.getFeed,
    },
    {
      method: 'post',
      path: '/:id/status',
      handler: InstanceController.updateStatus,
    },
    {
      method: 'post',
      path: '/:id/milestones',
      handler: InstanceController.addMilestone,
    },
    {
      method: 'post',
      path: '/:id/messages',
      handler: InstanceController.addMessage,
    },
    {
      method: 'post',
      path: '/:id/user-input',
      handler: InstanceController.setUserInput,
    },
  ],
});

export default InstanceRoutes;
