import InstanceManager from '#modules/instanceManager/InstanceManager';
import InstanceStore from '#modules/instanceStore/InstanceStore';
import WsHandler, { publishStatus, recordFeedItem, setStatus } from '#modules/wsHandler/WsHandler';
import { FeedKinds } from '../enums/InstanceEnums';

const FEED_PAGE_SIZE = 50;
const FEED_MAX_PAGE_SIZE = 200;

const notFound = ctx => ctx.modS.responses.createErrorResponse(
  ctx,
  ctx.modS.responses.CustomErrors.NOT_FOUND,
);

const badRequest = (ctx, message) => ctx.modS.responses.createErrorResponse(
  ctx,
  ctx.modS.responses.CustomErrors.BAD_REQUEST,
  { message },
);

const InstanceController = {
  async updateStatus(ctx) {
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    if (!status) return badRequest(ctx, 'status is required');

    const existing = InstanceManager.get(id);
    if (!existing) return notFound(ctx);

    // Don't let Claude override 'waiting' while user input is pending —
    // prevents race between update_status('working') and user_input_needed
    if (existing.status === 'waiting' && existing.pendingInput
        && ['working', 'thinking', 'running'].includes(status)) {
      return ctx.modS.responses.createSuccessResponse(ctx, { status: existing.status });
    }

    InstanceManager.detectCodexSession(id);

    if (status === 'completed') {
      InstanceManager.updateStatus(id, status);
      // Delay the broadcast so any in-flight messages/plans arrive first
      setTimeout(() => publishStatus(id, status), 500);
    } else {
      setStatus(id, status);
    }

    return ctx.modS.responses.createSuccessResponse(ctx, { status });
  },

  async addMilestone(ctx) {
    const { id } = ctx.params;
    const { accomplished, workingOn } = ctx.request.body;

    if (!InstanceManager.get(id)) return notFound(ctx);

    const milestone = await recordFeedItem(id, { kind: FeedKinds.MILESTONE, accomplished, workingOn });
    return ctx.modS.responses.createSuccessResponse(ctx, { milestone });
  },

  async setUserInput(ctx) {
    const { id } = ctx.params;
    const { message, choices } = ctx.request.body;

    if (!message || !choices) return badRequest(ctx, 'message and choices are required');

    const set = InstanceManager.setPendingInput(id, { choices });
    if (!set) return notFound(ctx);

    // The question is part of the feed, so it is still there after a reload or resume.
    await recordFeedItem(id, { kind: FeedKinds.MESSAGE, type: 'question', text: message });

    WsHandler.publish(`instance_${id}`, {
      type: 'user_input_needed',
      instanceId: id,
      message,
      choices,
    });
    publishStatus(id, 'waiting');

    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  async addMessage(ctx) {
    const { id } = ctx.params;
    const { text, type } = ctx.request.body;

    if (!text) return badRequest(ctx, 'text is required');
    if (!InstanceManager.get(id)) return notFound(ctx);

    const message = await recordFeedItem(id, { kind: FeedKinds.MESSAGE, text, type });
    return ctx.modS.responses.createSuccessResponse(ctx, { message });
  },

  // Instances that exist in the database but aren't running: they exited on their
  // own, or were running when the backend stopped.
  async getRemembered(ctx) {
    const records = await InstanceStore.listRecords(InstanceManager.runningIds());
    return ctx.modS.responses.createSuccessResponse(ctx, {
      instances: records.map(r => ({
        id: r._id,
        type: r.type,
        provider: r.provider,
        projectId: r.projectId,
        projectName: r.projectName,
        title: r.title,
        cwd: r.cwd,
        groupId: r.groupId,
        hasSession: !!r.sessionId,
        resumeError: r.resumeError || null,
        messageCount: r.messageCount,
        startedAt: r.startedAt,
        lastActiveAt: r.lastActiveAt,
      })),
    });
  },

  // A page of an instance's feed, newest last. The first page also carries its plans.
  async getFeed(ctx) {
    const { instanceId, beforeId, limit } = ctx.request.body;
    if (!instanceId || typeof instanceId !== 'string') return badRequest(ctx, 'instanceId is required');

    const pageSize = Math.min(Math.max(Math.trunc(Number(limit)) || FEED_PAGE_SIZE, 1), FEED_MAX_PAGE_SIZE);
    const [{ items, total }, plans] = await Promise.all([
      InstanceStore.getFeed(instanceId, { beforeId, limit: pageSize }),
      beforeId ? null : ctx.libS.plans.getByInstanceId(instanceId),
    ]);

    return ctx.modS.responses.createSuccessResponse(ctx, {
      items,
      total,
      plans: plans && plans.reverse().map(p => ({
        id: p._id.toString(),
        title: p.title || '',
        content: p.content || '',
        seen: !!p.seen,
      })),
    });
  },

  // Removing a remembered instance is a manual stop: record and messages are deleted,
  // plans are kept.
  async removeRemembered(ctx) {
    const { instanceId } = ctx.request.body;
    if (!instanceId || typeof instanceId !== 'string') return badRequest(ctx, 'instanceId is required');
    if (InstanceManager.get(instanceId)) return badRequest(ctx, 'This instance is running. Stop it from its card instead.');

    await InstanceStore.deleteRecord(instanceId);
    WsHandler.publish('global', { type: 'remembered_changed' });
    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default InstanceController;
