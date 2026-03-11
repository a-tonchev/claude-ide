import InstanceManager from '#modules/instanceManager/InstanceManager';
import WsHandler, { broadcastGroupStatus } from '#modules/wsHandler/WsHandler';

const InstanceController = {
  async updateStatus(ctx) {
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    if (!status) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'status is required' },
      );
    }

    // Don't let Claude override 'waiting' while user input is pending —
    // prevents race between update_status('working') and user_input_needed
    const existing = InstanceManager.get(id);
    if (existing && existing.status === 'waiting' && existing.pendingInput
        && ['working', 'thinking', 'running'].includes(status)) {
      return ctx.modS.responses.createSuccessResponse(ctx, { status: existing.status });
    }

    const updated = InstanceManager.updateStatus(id, status);
    if (!updated) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }

    // Delay 'completed' broadcast so any in-flight messages/plans arrive first
    if (status === 'completed') {
      setTimeout(() => {
        WsHandler.publish(`instance_${id}`, {
          type: 'status_update',
          instanceId: id,
          status,
        });
        broadcastGroupStatus(id);
      }, 500);
    } else {
      WsHandler.publish(`instance_${id}`, {
        type: 'status_update',
        instanceId: id,
        status,
      });
      broadcastGroupStatus(id);
    }

    return ctx.modS.responses.createSuccessResponse(ctx, { status });
  },

  async addMilestone(ctx) {
    const { id } = ctx.params;
    const { accomplished, workingOn } = ctx.request.body;

    const milestone = InstanceManager.addMilestone(id, { accomplished, workingOn });
    if (!milestone) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }

    WsHandler.publish(`instance_${id}`, {
      type: 'milestone',
      instanceId: id,
      accomplished,
      workingOn,
      timestamp: milestone.timestamp,
    });

    return ctx.modS.responses.createSuccessResponse(ctx, { milestone });
  },

  async getMilestones(ctx) {
    const { id } = ctx.params;
    const milestones = InstanceManager.getMilestones(id);
    return ctx.modS.responses.createSuccessResponse(ctx, { milestones });
  },

  async setUserInput(ctx) {
    const { id } = ctx.params;
    const { message, choices } = ctx.request.body;

    if (!message || !choices) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'message and choices are required' },
      );
    }

    const set = InstanceManager.setPendingInput(id, { choices });
    if (!set) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }

    // Store the question as a chat message immediately (for persistence/reconnects)
    if (message) {
      InstanceManager.addMessage(id, { text: message, type: 'question' });
    }

    WsHandler.publish(`instance_${id}`, {
      type: 'user_input_needed',
      instanceId: id,
      message,
      choices,
    });

    WsHandler.publish(`instance_${id}`, {
      type: 'status_update',
      instanceId: id,
      status: 'waiting',
    });

    broadcastGroupStatus(id);

    return ctx.modS.responses.createSuccessResponse(ctx);
  },

  async addMessage(ctx) {
    const { id } = ctx.params;
    const { text, type } = ctx.request.body;

    if (!text) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'text is required' },
      );
    }

    const message = InstanceManager.addMessage(id, { text, type });
    if (!message) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }

    WsHandler.publish(`instance_${id}`, {
      type: 'claude_message',
      instanceId: id,
      text,
      messageType: type || 'info',
      timestamp: message.timestamp,
    });

    return ctx.modS.responses.createSuccessResponse(ctx, { message });
  },

  async userResponse(ctx) {
    const { id } = ctx.params;
    const { choice } = ctx.request.body;

    if (!choice) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.BAD_REQUEST,
        { message: 'choice is required' },
      );
    }

    const instance = InstanceManager.get(id);
    if (!instance) {
      return ctx.modS.responses.createErrorResponse(
        ctx,
        ctx.modS.responses.CustomErrors.NOT_FOUND,
      );
    }

    InstanceManager.addUserMessage(id, choice);
    InstanceManager.write(id, choice);
    setTimeout(() => InstanceManager.write(id, '\r'), 100);
    InstanceManager.clearPendingInput(id);
    InstanceManager.updateStatus(id, 'working');

    WsHandler.publish(`instance_${id}`, {
      type: 'pending_cleared',
      instanceId: id,
    });

    WsHandler.publish(`instance_${id}`, {
      type: 'status_update',
      instanceId: id,
      status: 'working',
    });

    broadcastGroupStatus(id);

    return ctx.modS.responses.createSuccessResponse(ctx);
  },
};

export default InstanceController;
