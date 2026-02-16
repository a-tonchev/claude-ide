import createBasicRoutes from '#modules/routing/createRoutes';

import ProjectController from './ProjectController';
import ProjectValidations from '../services/ProjectValidations';

const ProjectRoutes = createBasicRoutes({
  prefix: '/projects',
  routeData: [
    {
      method: 'post',
      path: '/all',
      handler: ProjectController.getAll,
    },
    {
      method: 'post',
      path: '/get',
      handler: ProjectController.getById,
    },
    {
      method: 'post',
      path: '/add',
      validation: ProjectValidations.validateCreate,
      handler: ProjectController.create,
    },
    {
      method: 'post',
      path: '/update',
      validation: ProjectValidations.validateUpdate,
      handler: ProjectController.update,
    },
    {
      method: 'post',
      path: '/delete',
      handler: ProjectController.remove,
    },
  ],
});

export default ProjectRoutes;
