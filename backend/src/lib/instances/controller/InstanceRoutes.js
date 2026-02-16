import createBasicRoutes from '#modules/routing/createRoutes';
import InstanceController from './InstanceController';

const InstanceRoutes = createBasicRoutes({
  prefix: '/instances',
  routeData: [
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
      method: 'get',
      path: '/:id/milestones',
      handler: InstanceController.getMilestones,
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
    {
      method: 'post',
      path: '/:id/user-response',
      handler: InstanceController.userResponse,
    },
  ],
});

export default InstanceRoutes;
