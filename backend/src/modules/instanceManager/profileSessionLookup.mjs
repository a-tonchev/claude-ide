// Executed as the selected profile user by the root-owned runner. No credentials are returned.
import { findClaudeTranscript, findCodexSession, isUuid } from './sessionFiles.js';

const query = JSON.parse(process.argv[2]);
let result;
if (query.kind === 'claude' && isUuid(query.sessionId)) {
  result = !!findClaudeTranscript(query.sessionId);
} else if (query.kind === 'codex' && isUuid(query.instanceId) && typeof query.cwd === 'string') {
  result = findCodexSession({ ...query, startedAt: new Date(query.startedAt) });
} else {
  throw new Error('Invalid session lookup');
}
process.stdout.write(JSON.stringify(result));
