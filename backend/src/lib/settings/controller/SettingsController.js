import CryptoHelper from '#modules/helpers/CryptoHelper';

const SettingsController = {
  async getAll(ctx) {
    const { type } = ctx.request.body;
    const filter = type ? { type } : {};
    const collection = ctx.db.settings;
    const items = await collection.find(filter).toArray();
    // Mask passwords — never return encrypted password to frontend
    const safe = items.map(({ encryptedPassword, ...rest }) => ({
      ...rest,
      hasPassword: !!encryptedPassword,
    }));
    return ctx.modS.responses.createSuccessResponse(ctx, { settings: safe });
  },

  async create(ctx) {
    const {
      type, name, dbPath, dbName, username, password, instructions,
    } = ctx.request.body;

    const doc = { type, name };
    if (dbPath !== undefined) doc.dbPath = dbPath;
    if (dbName !== undefined) doc.dbName = dbName;
    if (username !== undefined) doc.username = username;
    if (instructions !== undefined) doc.instructions = instructions;
    if (password) {
      doc.encryptedPassword = CryptoHelper.encrypt(password);
    }

    try {
      const result = await ctx.libS.settings.add(doc);
      return ctx.modS.responses.createSuccessResponse(ctx, {
        _id: result.insertedId,
      });
    } catch (err) {
      if (err.code === 11000) {
        return ctx.modS.responses.createErrorResponse(
          ctx,
          ctx.modS.responses.CustomErrors.BAD_REQUEST,
          { message: 'A setting with this name and type already exists' },
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
    const { _id, password, ...fields } = ctx.request.body;

    if (password) {
      fields.encryptedPassword = CryptoHelper.encrypt(password);
    }

    try {
      await ctx.libS.settings.update({ _id, ...fields });
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
    await ctx.libS.settings.removeById(_id);
    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  // MCP endpoint — returns decrypted KeePass credentials for observer use
  async getCredentials(ctx) {
    const { settingsId } = ctx.request.body;
    if (!settingsId) {
      return ctx.modS.responses.createSuccessResponse(ctx, {
        credentials: null,
      });
    }

    try {
      const doc = await ctx.libS.settings.getById(settingsId);
      if (!doc) {
        return ctx.modS.responses.createSuccessResponse(ctx, {
          credentials: null,
        });
      }

      let password = '';
      if (doc.encryptedPassword) {
        try {
          password = CryptoHelper.decrypt(doc.encryptedPassword);
        } catch (e) {
          password = '';
        }
      }

      return ctx.modS.responses.createSuccessResponse(ctx, {
        credentials: {
          type: doc.type,
          name: doc.name,
          dbPath: doc.dbPath || '',
          dbName: doc.dbName || '',
          username: doc.username || '',
          password,
          instructions: doc.instructions || '',
        },
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
};

export default SettingsController;
