const TerminalController = {
  async getAll(ctx) {
    const terminals = await ctx.libS.terminals.getAll();
    return ctx.modS.responses.createSuccessResponse(ctx, { terminals });
  },

  async create(ctx) {
    const { name, shell, command, cwd } = ctx.request.body;
    try {
      const result = await ctx.libS.terminals.add({ name, shell, command, cwd });
      return ctx.modS.responses.createSuccessResponse(ctx, {
        _id: result.insertedId,
      });
    } catch (err) {
      if (err.code === 11000) {
        return ctx.modS.responses.createErrorResponse(
          ctx,
          ctx.modS.responses.CustomErrors.BAD_REQUEST,
          { message: 'A terminal config with this name already exists' },
        );
      }
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
      await ctx.libS.terminals.update({ _id, ...fields });
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
    await ctx.libS.terminals.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default TerminalController;
