import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, normalizePublicUrl, parseUrls, validateEmail, validateCase, ValidationError } from '../js/validators.js';
import { buildDraft, WORKFLOWS } from '../js/templates.js';
import { createCaseStore } from '../js/store.js';

/** Make a known-valid copyright request for unit tests.
 * @param {Record<string, unknown>} overrides
 * @returns {Record<string, unknown>}
 */
function fixture(overrides = {}) {
  return {
    kind: 'dmca', title: 'Unauthorized photo use', requester: 'Agency Representative',
    email: 'legal@example.org', company: 'Original Rights Owner', priority: 'Normal',
    category: WORKFLOWS.dmca.categories[0],
    urls: 'https://public.example.org/stolen-photo\nhttps://public.example.org/stolen-photo',
    original: 'https://owner.example.org/photo', details: 'The image was reproduced without permission at these exact locations.',
    evidence: 'Screenshot and original upload date', rights: true, goodfaith: true, truthful: true,
    ...overrides
  };
}

test('cleanText strips control characters and collapses whitespace', () => {
  assert.equal(cleanText(' Hello\u0000 \t  team\n', 200), 'Hello team');
});

test('normalizes and deduplicates URLs while removing fragments', () => {
  assert.deepEqual(parseUrls('https://public.example.org/post#frag\nhttps://public.example.org/post'), ['https://public.example.org/post']);
});

test('rejects non-http, credentials, local/private and IP hosts', () => {
  const values = [
    'javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@site.com/',
    'http://localhost/admin', 'http://192.168.1.1/path', 'http://[::1]/',
    'http://intranet.local/', 'http://site.test/', 'http://site.com:8080/',
    'https://some.host/has space'
  ];
  for (const value of values) assert.throws(() => normalizePublicUrl(value), ValidationError, value);
});

test('enforces 20 URL limit', () => {
  assert.throws(() => parseUrls(Array.from({length:21}, (_,i) => 'https://example.org/' + i).join('\n')), /Maximum 20/);
});

test('rejects email injection and missing domain', () => {
  assert.throws(() => validateEmail('agent@example.org\nBcc:evil@example.org'), ValidationError);
  assert.throws(() => validateEmail('not-an-email'), ValidationError);
});

test('requires honest copyright attestations', () => {
  assert.throws(() => validateCase(fixture({goodfaith:false})), /both ownership/);
  assert.throws(() => validateCase(fixture({rights:false})), /both ownership/);
  assert.throws(() => validateCase(fixture({truthful:false})), /truthful/);
});

test('requires factual detail and exact work URL for copyright notice', () => {
  assert.throws(() => validateCase(fixture({details:'not enough'})), /at least 20/);
  assert.throws(() => validateCase(fixture({original:'invalid'})), /Original work URL/);
});

test('creates accurate DMCA draft without submitting anything', () => {
  const input = validateCase(fixture());
  const draft = buildDraft(input);
  assert.match(draft, /under penalty of perjury/);
  assert.match(draft, /Original work: https:\/\/owner.example.org\/photo/);
  assert.match(draft, /NOT SUBMITTED/);
  assert.equal(input.urls.length, 1);
});

test('business review workflow does not require copyright ownership', () => {
  const input = validateCase(fixture({
    kind:'business', category:WORKFLOWS.business.categories[0], rights:false, goodfaith:false,
    original:'', details:'Evidence of coordinated fake engagement from repeated review accounts.'
  }));
  assert.match(buildDraft(input), /low star rating alone/);
});

test('social and audit generate appropriately scoped briefs', () => {
  for (const kind of ['social','audit']) {
    const input = validateCase(fixture({kind, rights:false, goodfaith:false, original:'', category:WORKFLOWS[kind].categories[0]}));
    assert.match(buildDraft(input), /NOT SUBMITTED/);
  }
});

test('session store is bounded, retrievable, clearable and rate-limited', () => {
  const input = validateCase(fixture());
  let n=0;
  const store = createCaseStore({limit:2,maxPerMinute:2,clock:()=>1761150000000,idFactory:()=>String(++n).padStart(8,'0')});
  const one=store.add(input), two=store.add(input);
  assert.equal(store.stats().total,2);
  assert.equal(store.get(one.id)?.draft.includes('NOT SUBMITTED'),true);
  assert.throws(()=>store.add(input),/Too many drafts/);
  store.clear();
  assert.equal(store.stats().urls,0);
  assert.equal(store.list().length,0);
  assert.equal(store.get(two.id),undefined);
});

test('keeps HTML-like input as inert text in drafts', () => {
  const input=validateCase(fixture({title:'<img src=x onerror=alert(1)> malicious title'}));
  const draft=buildDraft(input);
  assert.match(draft, /<img src=x onerror=alert\(1\)>/);
  // UI always uses textContent, never innerHTML for this untrusted draft.
});
