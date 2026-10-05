import InstanceManager from '#modules/instanceManager/InstanceManager';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import WsHandler from '#modules/wsHandler/WsHandler';

const GroupController = {
  async getAll(ctx) {
    const groups = await ctx.libS.groups.getAll();
    return ctx.modS.responses.createSuccessResponse(ctx, { groups });
  },

  async create(ctx) {
    const { name, items, draft } = ctx.request.body;
    try {
      const result = await ctx.libS.groups.add({ name, items: items || [], draft: !!draft });
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
    const {
      _id, name, items, draft,
    } = ctx.request.body;
    let result;
    try {
      result = await ctx.libS.groups.update({
        _id, name, items, ...(typeof draft === 'boolean' && { draft }),
      });
    } catch (err) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        {},
        err,
      );
    }
    // The group may have been deleted meanwhile (e.g. an empty draft closed in another window)
    if (!result?.matchedCount) {
      return ctx.modS.responses.createErrorResponse(ctx, ctx.modS.responses.CustomErrors.NOT_FOUND);
    }
    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  // Deleting a group is a manual stop for everything in it: the dashboard stops the
  // running instances, and the remembered ones that belonged to the group go too.
  async remove(ctx) {
    const { _id } = ctx.request.body;
    await ctx.libS.groups.removeById(_id);
    if (typeof _id === 'string') {
      const removed = await InstanceStore.deleteRecordsInGroup(_id, InstanceManager.runningIds());
      if (removed) WsHandler.publish('global', { type: 'remembered_changed' });
    }
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default GroupController;
