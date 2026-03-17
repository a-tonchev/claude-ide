import { ObjectId } from 'mongodb';

const ObserverController = {
  async getAll(ctx) {
    const observers = await ctx.libS.observers.getAll();
    return ctx.modS.responses.createSuccessResponse(ctx, { observers });
  },

  async create(ctx) {
    const {
      name, instructions, path, keepassSettingsId, keepassEntryPath,
    } = ctx.request.body;
    const doc = { name };
    if (instructions !== undefined) doc.instructions = instructions;
    if (path !== undefined) doc.path = path;
    if (keepassSettingsId !== undefined) doc.keepassSettingsId = keepassSettingsId;
    if (keepassEntryPath !== undefined) doc.keepassEntryPath = keepassEntryPath;
    try {
      const result = await ctx.libS.observers.add(doc);
      return ctx.modS.responses.createSuccessResponse(ctx, {
        _id: result.insertedId,
      });
    } catch (err) {
      if (err.code === 11000) {
        return ctx.modS.responses.createErrorResponse(
          ctx,
          ctx.modS.responses.CustomErrors.BAD_REQUEST,
          { message: 'An observer with this name already exists' },
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
      await ctx.libS.observers.update({ _id, ...fields });
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
    await ctx.libS.observers.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  // MCP tool endpoints — called by the MCP server on behalf of observer instances
  async getInstructions(ctx) {
    const { observerId } = ctx.request.body;
    if (!observerId) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'observerId is required' },
      );
    }
    try {
      const observer = await ctx.libS.observers.getById(observerId);
      if (!observer) {
        return ctx.modS.responses.createSuccessResponse(ctx, { name: null, instructions: null });
      }
      return ctx.modS.responses.createSuccessResponse(ctx, {
        name: observer.name,
        instructions: observer.instructions || '',
        keepassSettingsId: observer.keepassSettingsId || null,
        keepassEntryPath: observer.keepassEntryPath || null,
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

  async setInstructions(ctx) {
    const { observerId, instructions } = ctx.request.body;
    if (!observerId) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'observerId is required' },
      );
    }
    if (instructions === undefined) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'instructions is required' },
      );
    }
    try {
      const collection = ctx.db.observers;
      await collection.updateOne(
        { _id: new ObjectId(observerId) },
        { $set: { instructions, updatedAt: new Date() } },
      );
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
};

export default ObserverController;
