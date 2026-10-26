// §37.26 [ASSUMED] Local file protocol: atomic publication, one immutable answer per observation.
import { writeFileSync, renameSync, linkSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function publish(file, text, { exclusive = false } = {}) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, text, { mode: 0o600, flag: 'wx' });
    if (exclusive) linkSync(temp, file); else renameSync(temp, file);
  } finally {
    try { unlinkSync(temp); } catch { /* publication errors take precedence over best-effort temp cleanup */ }
  }
}
export const writeJSON = (file, value, options) => publish(file, `${JSON.stringify(value, null, 2)}\n`, options);
export const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));
export const seatDir = (dir, mode, seat) => mode === 'solo' ? dir : path.join(dir, `seat-${seat}`);

export function actionReply(value, context) {
  const done = value && !Array.isArray(value) && Object.keys(value).length === 1 && value.done === true;
  if (done && context.kind !== 'prep') throw new Error('{"done":true} is only for prep; choose a draft/offer action');
  const intents = done ? [{ t: 'g.ready', ready: true }] : value;
  if (!Array.isArray(intents) || !intents.length || intents.length > context.remaining) {
    throw new Error(`Expected a nonempty array of at most ${context.remaining} intents/shortcuts, or {"done":true}`);
  }
  // Ready is a validated human intent. A rejected Ready asks again; it never delegates an unfinished prep.
  return { intents, done: false };
}
