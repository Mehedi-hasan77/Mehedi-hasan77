/**
 * Browser-only validation utilities. No network requests are performed.
 * @typedef {{ title: string, requester: string, email: string, company: string,
 *   priority: 'Low'|'Normal'|'High', category: string, urls: string[], original: string,
 *   details: string, evidence: string, rights: boolean, goodfaith: boolean,
 *   truthful: boolean, kind: 'dmca'|'business'|'social'|'audit' }} CaseInput
 */
export class ValidationError extends Error {
  /** @param {string} message */
  constructor(message) { super(message); this.name = 'ValidationError'; }
}

/** Strip invalid control characters, normalize whitespace and bound user text.
 * @param {unknown} input
 * @param {number} max
 * @param {boolean} multiline
 * @returns {string}
 */
export function cleanText(input, max = 3000, multiline = false) {
  if (typeof input !== 'string') return '';
  const normalized = input.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return (multiline ? normalized.replace(/\r\n?/g, '\n') : normalized.replace(/\s+/g, ' ')).trim().slice(0, max);
}

/** Avoid network-dependent parsing and reject private, local, unsafe or credentialed URLs.
 * The app never fetches user-supplied URLs; this is form hygiene, not SSRF protection.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePublicUrl(value) {
  const input = cleanText(value, 2048);
  if (!input) throw new ValidationError('A URL is required.');
  if (/\s/.test(input)) throw new ValidationError('URLs must not contain spaces.');
  let url;
  try { url = new URL(input); } catch { throw new ValidationError('Enter an absolute http:// or https:// URL.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new ValidationError('Only http:// or https:// URLs are accepted.');
  if (url.username || url.password) throw new ValidationError('URLs containing usernames or passwords are not accepted.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') || host.endsWith('.example')) {
    throw new ValidationError('Use a publicly accessible web address, not a local or reserved host.');
  }
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || /^\d+(\.\d+)*$/.test(host) || /^(?:0x|0[0-9])[0-9a-f.]*$/i.test(host)) {
    throw new ValidationError('IP addresses and numeric hosts are not supported.');
  }
  if (url.port && !['80', '443'].includes(url.port)) throw new ValidationError('Nonstandard URL ports are not supported.');
  if (url.href.length > 2048) throw new ValidationError('URL is too long (maximum 2048 characters).');
  url.hash = '';
  return url.href;
}

/** Validate, de-duplicate and normalize a limited list of URLs.
 * @param {unknown} raw
 * @param {number} maxCount
 * @returns {string[]}
 */
export function parseUrls(raw, maxCount = 20) {
  const lines = String(raw ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 1) throw new ValidationError('Provide at least one exact reported URL.');
  if (lines.length > maxCount) throw new ValidationError('Maximum ' + maxCount + ' URLs per case.');
  const normalized = [];
  for (let index = 0; index < lines.length; index++) {
    try {
      const url = normalizePublicUrl(lines[index]);
      if (!normalized.includes(url)) normalized.push(url);
    } catch (error) {
      throw new ValidationError('URL ' + (index + 1) + ': ' + error.message);
    }
  }
  return normalized;
}

/** Validate one email address without accepting header injection.
 * @param {unknown} raw
 * @returns {string}
 */
export function validateEmail(raw) {
  const email = cleanText(raw, 254);
  if (!email || email.length > 254 || /[\r\n]/.test(email) || !/^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(email)) {
    throw new ValidationError('Provide a valid contact email address.');
  }
  return email;
}

/** Validate and normalize all fields before a draft can be prepared.
 * @param {Record<string, unknown>} raw
 * @returns {CaseInput}
 */
export function validateCase(raw) {
  const allowedKinds = ['dmca', 'business', 'social', 'audit'];
  if (!allowedKinds.includes(raw.kind)) throw new ValidationError('Choose a supported workflow.');
  const kind = /** @type {CaseInput['kind']} */ (raw.kind);
  const title = cleanText(raw.title, 120);
  const requester = cleanText(raw.requester, 100);
  const details = cleanText(raw.details, 3000, true);
  if (title.length < 4) throw new ValidationError('Case title must contain at least 4 characters.');
  if (requester.length < 2) throw new ValidationError('Enter the requester's full name.');
  if (details.length < 20) throw new ValidationError('Explain the facts in at least 20 characters.');
  const category = cleanText(raw.category, 80);
  if (!category) throw new ValidationError('Select an issue category.');
  const priority = ['Low', 'Normal', 'High'].includes(raw.priority) ? /** @type {CaseInput['priority']} */ (raw.priority) : 'Normal';
  if (raw.truthful !== true) throw new ValidationError('Confirm the information is truthful and you will review the draft.');
  const rights = raw.rights === true;
  const goodfaith = raw.goodfaith === true;
  let original = '';
  if (kind === 'dmca') {
    if (!rights || !goodfaith) throw new ValidationError('Copyright notices require both ownership and good-faith attestations.');
    try { original = normalizePublicUrl(raw.original); }
    catch (error) { throw new ValidationError('Original work URL: ' + error.message); }
  }
  return Object.freeze({
    kind, title, requester, email: validateEmail(raw.email),
    company: cleanText(raw.company, 130), priority, category,
    urls: Object.freeze(parseUrls(raw.urls)),
    original, details, evidence: cleanText(raw.evidence, 1600, true),
    rights, goodfaith, truthful: true
  });
}