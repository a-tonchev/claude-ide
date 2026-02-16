import ProjectRoutes from './controller/ProjectRoutes';
import ProjectEnums from './enums/ProjectEnums';
import setupCollection from './setupCollection';
import ProjectSchema from './schema/ProjectSchema';
import setupServices from './setupServices';

const Projects = {
  collectionName: ProjectEnums.COLLECTION_NAME,
  setupCollection,
  schema: ProjectSchema,
  setupServices,
  routes: ProjectRoutes,
};

export default Projects;
