import ServicesBase from '#lib/base/services/ServicesBase';
import DatabaseHelpers from '#modules/db/DatabaseHelpers';

class PlanServices extends ServicesBase {
  async getByProjectId(projectId, params = this.publicParams) {
    const _id = DatabaseHelpers.getObjectId(projectId);
    if (!_id) return [];
    return this.DB.find({ project_id: _id }, params)
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getByInstanceId(instanceId, params = this.publicParams) {
    return this.DB.find({ instance_id: instanceId }, params)
      .sort({ createdAt: -1 })
      .toArray();
  }

  publicParams = {};
}

export default PlanServices;
