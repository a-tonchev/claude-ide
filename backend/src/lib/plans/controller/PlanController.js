import DatabaseHelpers from '#modules/db/DatabaseHelpers';
import WsHandler from '#modules/wsHandler/WsHandler';
import { PlanStatuses } from '../enums/PlanEnums';

const PlanController = {
  async getAll(ctx) {
    const { projectId } = ctx.request.body;
    let plans;
    if (projectId) {
      plans = await ctx.libS.plans.getByProjectId(projectId);
    } else {
      plans = await ctx.libS.plans.getAll({}, {
        sort: [{ createdAt: -1 }],
      });
    }
    return ctx.modS.responses.createSuccessResponse(ctx, { plans });
  },

  async getById(ctx) {
    const { _id } = ctx.request.body;
    const plan = await ctx.libS.plans.getById(_id);
    if (!plan) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }
    return ctx.modS.responses.createSuccessResponse(ctx, { plan });
  },

  async create(ctx) {
    const { project_id, instance_id, title, prompt, content, status } = ctx.request.body;
    try {
      const result = await ctx.libS.plans.add({
        project_id: DatabaseHelpers.getObjectId(project_id),
        instance_id: instance_id || '',
        title: title || '',
        prompt: prompt || '',
        content,
        status: status || PlanStatuses.DRAFT,
        seen: false,
      });

      // Cards load an instance's plans from this collection; tell open ones about the new plan
      if (instance_id) {
        WsHandler.publish(`instance_${instance_id}`, {
          type: 'plan_saved',
          instanceId: instance_id,
          planId: result.insertedId.toString(),
          title: title || '',
          content: content || '',
          seen: false,
        });
      }

      return ctx.modS.responses.createSuccessResponse(ctx, {
        _id: result.insertedId,
      });
    } catch (err) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        {},
        err,
      );
    }
  },

  async update(ctx) {
    const { _id, ...fields } = ctx.request.body;
    try {
      await ctx.libS.plans.update({ _id, ...fields });
      return ctx.modS.responses.createSuccessResponse(ctx);
    } catch (err) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        {},
        err,
      );
    }
  },

  async markSeen(ctx) {
    const { _id } = ctx.request.body;
    try {
      await ctx.libS.plans.update({ _id, seen: true });
      return ctx.modS.responses.createSuccessResponse(ctx);
    } catch (err) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        {},
        err,
      );
    }
  },

  async remove(ctx) {
    const { _id } = ctx.request.body;
    await ctx.libS.plans.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  async removeAll(ctx) {
    await ctx.libS.plans.removeByQuery({ query: {}, multiple: true });
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default PlanController;
