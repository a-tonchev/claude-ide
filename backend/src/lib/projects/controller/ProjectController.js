const ProjectController = {
  async getAll(ctx) {
    const projects = await ctx.libS.projects.getAll();
    return ctx.modS.responses.createSuccessResponse(ctx, { projects });
  },

  async getById(ctx) {
    const { _id } = ctx.request.body;
    const project = await ctx.libS.projects.getById(_id);
    if (!project) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }
    return ctx.modS.responses.createSuccessResponse(ctx, { project });
  },

  async create(ctx) {
    const { name, path } = ctx.request.body;
    try {
      const result = await ctx.libS.projects.add({ name, path });
      return ctx.modS.responses.createSuccessResponse(ctx, {
        _id: result.insertedId,
      });
    } catch (err) {
      if (err.code === 11000) {
        return ctx.modS.responses.createErrorResponse(
          ctx,
          ctx.modS.responses.CustomErrors.BAD_REQUEST,
          { message: 'A project with this path already exists' },
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
      await ctx.libS.projects.update({ _id, ...fields });
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
    await ctx.libS.projects.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default ProjectController;
