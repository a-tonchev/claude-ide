const GroupController = {
  async getAll(ctx) {
    const groups = await ctx.libS.groups.getAll();
    return ctx.modS.responses.createSuccessResponse(ctx, { groups });
  },

  async create(ctx) {
    const { name, items } = ctx.request.body;
    try {
      const result = await ctx.libS.groups.add({ name, items: items || [] });
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
    const { _id, name, items } = ctx.request.body;
    try {
      await ctx.libS.groups.update({ _id, name, items });
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
    await ctx.libS.groups.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default GroupController;
