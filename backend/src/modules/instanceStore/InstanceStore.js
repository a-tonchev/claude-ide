import { getSharedDb } from '#modules/db/mongoPool';
import DatabaseHelpers from '#modules/db/DatabaseHelpers';
import InstanceEnums, { FeedKinds } from '#lib/instances/enums/InstanceEnums';
import GroupEnums from '#lib/groups/enums/GroupEnums';
import FileStore from '#modules/files/FileStore';

const FEED_PAGE_SIZE = 50;
const DRAFT_GROUP_GRACE_MS = 60 * 60 * 1000;

function collection(name) {
  const db = getSharedDb();
  if (!db) throw new Error('Database is not connected');
  return db.collection(name);
}

const records = () => collection(InstanceEnums.COLLECTION_NAME);
const messages = () => collection(InstanceEnums.MESSAGES_COLLECTION_NAME);

const toFeedItem = doc => ({
  id: doc._id.toString(),
  kind: doc.kind,
  text: doc.text,
  type: doc.type,
  accomplished: doc.accomplished,
  workingOn: doc.workingOn,
  attachments: doc.attachments,
  timestamp: doc.timestamp,
});

// The schema only accepts strings for these fields, so missing values are left out.
function buildFeedDocument(instanceId, {
  kind, text, type, accomplished, workingOn, attachments,
}) {
  const doc = { instanceId, kind, timestamp: new Date() };
  if (kind === FeedKinds.MILESTONE) {
    doc.accomplished = String(accomplished ?? '');
    if (workingOn !== undefined && workingOn !== null) doc.workingOn = String(workingOn);
  } else {
    doc.text = String(text ?? '');
    if (kind === FeedKinds.MESSAGE) doc.type = String(type || 'info');
    // Files attached to a user message: { id, name, size, mime }, id being the stored name
    if (kind === FeedKinds.USER && Array.isArray(attachments) && attachments.length) {
      doc.attachments = attachments.map(a => ({
        id: String(a.id), name: String(a.name), size: Number(a.size) || 0, mime: String(a.mime || ''),
      }));
    }
  }
  return doc;
}

const InstanceStore = {
  // A record's lastActiveAt is its last start; later activity comes from its feed.
  async createRecord(fields) {
    const now = new Date();
    await records().insertOne({
      ...fields, lastActiveAt: now, createdAt: now, updatedAt: now,
    });
  },

  async updateRecord(id, fields) {
    await records().updateOne({ _id: id }, { $set: { ...fields, updatedAt: new Date() } });
  },

  getRecord(id) {
    return records().findOne({ _id: id });
  },

  // Deletes the record, its messages and its attachments. A saved record is left alone
  // unless `force` (removing it from the Saved list): the check and the delete are one
  // operation, so a save racing a Stop can't lose it. Returns whether it was deleted.
  async deleteRecord(id, { force = false } = {}) {
    const filter = force ? { _id: id } : { _id: id, saved: { $ne: true } };
    const { deletedCount } = await records().deleteOne(filter);
    if (!deletedCount) return false;
    await messages().deleteMany({ instanceId: id });
    await FileStore.deleteInstanceDirs([id]);
    return true;
  },

  // Returns whether a record matched
  async setSaved(id, saved) {
    const { matchedCount } = await records().updateOne(
      { _id: id },
      { $set: { saved: !!saved, updatedAt: new Date() } },
    );
    return matchedCount > 0;
  },

  // Deleting a group removes the remembered instances that belonged to it, messages
  // included. Running ones (excludeIds) are removed by their own manual stop; saved ones stay.
  async deleteRecordsInGroup(groupId, excludeIds = []) {
    const ids = await records().distinct('_id', { groupId, _id: { $nin: excludeIds }, saved: { $ne: true } });
    if (!ids.length) return 0;
    await messages().deleteMany({ instanceId: { $in: ids } });
    const result = await records().deleteMany({ _id: { $in: ids }, saved: { $ne: true } });
    await FileStore.deleteInstanceDirs(ids);
    return result.deletedCount;
  },

  // The records that aren't running, plus every saved one (running or not), with their
  // message count, most recently active first.
  async listRecords(runningIds = []) {
    const docs = await records().find({ $or: [{ _id: { $nin: runningIds } }, { saved: true }] }).toArray();
    if (!docs.length) return [];
    const stats = await messages().aggregate([
      { $match: { instanceId: { $in: docs.map(d => d._id) } } },
      { $group: { _id: '$instanceId', count: { $sum: 1 }, lastAt: { $max: '$timestamp' } } },
    ]).toArray();
    const statsById = new Map(stats.map(s => [s._id, s]));
    return docs
      .map(d => {
        const s = statsById.get(d._id);
        const lastActiveAt = s?.lastAt && s.lastAt > d.lastActiveAt ? s.lastAt : d.lastActiveAt;
        return { ...d, messageCount: s?.count || 0, lastActiveAt };
      })
      .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));
  },

  async addFeedItem(instanceId, item) {
    const doc = buildFeedDocument(instanceId, item);
    const { insertedId } = await messages().insertOne(doc);
    return toFeedItem({ ...doc, _id: insertedId });
  },

  // The `limit` newest items older than beforeId, returned oldest first.
  async getFeed(instanceId, { beforeId, limit = FEED_PAGE_SIZE } = {}) {
    const query = { instanceId };
    const before = beforeId ? DatabaseHelpers.getObjectId(beforeId) : null;
    if (before) query._id = { $lt: before };
    const [docs, total] = await Promise.all([
      messages().find(query).sort({ _id: -1 }).limit(limit).toArray(),
      messages().countDocuments({ instanceId }),
    ]);
    return { items: docs.reverse().map(toFeedItem), total };
  },

  // Draft groups give unsaved tabs a stable id. Called at startup, when nothing runs:
  // an empty draft that no instance record points to (and that isn't brand new) is
  // unreachable. Drafts that still hold cards are kept.
  async deleteUnreferencedDraftGroups() {
    const referenced = (await records().distinct('groupId'))
      .map(id => DatabaseHelpers.getObjectId(id))
      .filter(Boolean);
    const result = await collection(GroupEnums.COLLECTION_NAME).deleteMany({
      draft: true,
      items: { $size: 0 },
      _id: { $nin: referenced },
      updatedAt: { $lt: new Date(Date.now() - DRAFT_GROUP_GRACE_MS) },
    });
    return result.deletedCount;
  },

  // Attachment folders of instances whose record is gone. Called at startup.
  async deleteOrphanFileDirs() {
    return FileStore.deleteOrphanInstanceDirs(await records().distinct('_id'));
  },

  // A feed item can land just after a manual stop deleted its instance. Called at
  // startup to drop those.
  async deleteOrphanMessages() {
    const [owners, recordIds] = await Promise.all([
      messages().distinct('instanceId'),
      records().distinct('_id'),
    ]);
    const known = new Set(recordIds);
    const orphans = owners.filter(id => !known.has(id));
    if (!orphans.length) return 0;
    const result = await messages().deleteMany({ instanceId: { $in: orphans } });
    return result.deletedCount;
  },
};

export default InstanceStore;
