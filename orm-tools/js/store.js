import { ValidationError } from './validators.js';
import { buildDraft } from './templates.js';

/** @typedef {{id: string, createdAt: string, draft: string, input: import('./validators.js').CaseInput}} CaseRecord */

/** Build a session-only, bounded, rate-limited store. No browser storage and no server writes.
 * @param {{limit?: number, maxPerMinute?: number, clock?: () => number, idFactory?: () => string}} options
 * @returns {{add: (input: import('./validators.js').CaseInput) => CaseRecord,
 * list: () => CaseRecord[], get: (id: string) => CaseRecord | undefined,
 * clear: () => void, stats: () => {total: number, urls: number, ready: number}}}
 */
export function createCaseStore({limit = 20, maxPerMinute = 8, clock = () => Date.now(), idFactory = () => crypto.randomUUID()} = {}) {
  /** @type {CaseRecord[]} */
  let records = [];
  /** @type {number[]} */
  let recentWrites = [];

  /** Create and store a new prepared case. Rate limits are user-interface protections, not a server security boundary.
   * @param {import('./validators.js').CaseInput} input
   * @returns {CaseRecord}
   */
  function add(input) {
    const now = clock();
    recentWrites = recentWrites.filter(t => t > now - 60000);
    if (recentWrites.length >= maxPerMinute) {
      throw new ValidationError('Too many drafts in this session. You can create up to ' + maxPerMinute + ' cases per minute.');
    }
    const id = 'ORM-' + new Date(now).toISOString().slice(0, 10).replaceAll('-', '') + '-' + idFactory().slice(0, 8).toUpperCase();
    const record = Object.freeze({id, createdAt: new Date(now).toISOString(), input, draft: buildDraft(input)});
    recentWrites.push(now);
    records = [record, ...records].slice(0, limit);
    return record;
  }

  /** List recent records, newest first. @returns {CaseRecord[]} */
  function list() { return records.slice(); }

  /** Fetch a record by its generated ID. @param {string} id @returns {CaseRecord|undefined} */
  function get(id) { return records.find(record => record.id === id); }

  /** Permanently discard cases from this browser tab. @returns {void} */
  function clear() { records = []; recentWrites = []; }

  /** Return analytics for current in-memory records. @returns {{total:number,urls:number,ready:number}} */
  function stats() {
    return {total: records.length, urls: records.reduce((sum, record) => sum + record.input.urls.length, 0), ready: records.length};
  }
  return {add, list, get, clear, stats};
}