import DatabaseHelpers from '#modules/db/DatabaseHelpers';
import WsHandler from '#modules/wsHandler/WsHandler';
import InstanceManager from '#modules/instanceManager/InstanceManager';
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

      // Store plan reference on the in-memory instance and broadcast
      if (instance_id) {
        InstanceManager.addPlanReference(instance_id, {
          id: result.insertedId.toString(),
          title: title || '',
          content: content || '',
          seen: false,
        });

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
    const { _id, instance_id } = ctx.request.body;
    try {
      await ctx.libS.plans.update({ _id, seen: true });

      if (instance_id) {
        const instance = InstanceManager.get(instance_id);
        if (instance) {
          const planRef = instance.plans.find(p => p.id === _id);
          if (planRef) planRef.seen = true;
        }
      }

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
