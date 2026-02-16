import ServicesBase from '#lib/base/services/ServicesBase';

class ProjectServices extends ServicesBase {
  async getByPath(path, params = this.publicParams) {
    return this.DB.findOne({ path }, params);
  }

  publicParams = {};
}

export default ProjectServices;
