import Validations from '#modules/validation/Validations';
import Users from '#lib/users/Users';
import Authentications from '#lib/authentications/Authentications';
import Projects from '#lib/projects/Projects';
import Plans from '#lib/plans/Plans';
import Groups from '#lib/groups/Groups';
import Terminals from '#lib/terminals/Terminals';
import {
  createErrorResponse,
  createSuccessResponse,
  createValidateError,
} from '#modules/responseHandler/responses';
import CustomErrors from '#modules/responseHandler/CustomErrors';
import string from '#modules/helpers/StringHelper';
import date from '#modules/helpers/DateHelper';
import EmailServices from '#modules/email/EmailServices';

const Config = {
  // All collections need to be stored here
  collections: [Users, Authentications, Projects, Plans, Groups, Terminals],

  // All collections services need to be setup here
  setupLibs(ctx) {
    const { users } = Users.setupServices(ctx);
    const { authentications } = Authentications.setupServices(ctx);
    const { projects } = Projects.setupServices(ctx);
    const { plans } = Plans.setupServices(ctx);
    const { groups } = Groups.setupServices(ctx);
    const { terminals } = Terminals.setupServices(ctx);
    return {
      users,
      authentications,
      projects,
      plans,
      groups,
      terminals,
    };
  },

  // All modules services need to be setup here
  setupMods() {
    return {
      validations: Validations,
      responses: {
        createSuccessResponse,
        createErrorResponse,
        createValidateError,
        CustomErrors,
      },
      string,
      date,
      email: EmailServices,
    };
  },
};

export { Config };
export default { Config };
