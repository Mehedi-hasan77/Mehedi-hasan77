/** Descriptions and official, verified platform guidance URLs. */
export const WORKFLOWS = Object.freeze({
  dmca: Object.freeze({
    heading: 'Copyright removal request',
    hint: 'Prepare only if the copyright owner or an authorized representative has a genuine, good-faith basis. A false notice can have legal consequences.',
    categories: ['Unauthorized reproduction', 'Copied photograph or artwork', 'Unlicensed video or audio', 'Copied article or text', 'Other copyright infringement'],
    officialUrl: 'https://support.google.com/legal/troubleshooter/1114905'
  }),
  business: Object.freeze({
    heading: 'Business Profile reporting brief',
    hint: 'Google removes reviews only for policy violations, not because they are negative. Document the exact violation and review URL.',
    categories: ['Spam or fake engagement', 'Off-topic content', 'Conflict of interest', 'Harassment or hate', 'Personal information', 'Other policy violation'],
    officialUrl: 'https://support.google.com/business/answer/4596773'
  }),
  social: Object.freeze({
    heading: 'Social platform reporting brief',
    hint: 'Platform reports depend on the provider and policy. Record facts; use the provider’s own reporting interface for submission.',
    categories: ['Impersonation', 'Unauthorized copyright use', 'Harassment or threats', 'Privacy exposure', 'Fraud or scam', 'Other platform violation'],
    officialUrl: 'https://support.google.com/legal/answer/3110420'
  }),
  audit: Object.freeze({
    heading: 'Advertising / SEO audit brief',
    hint: 'Produce a scoped audit checklist for your agency. No Ads, Analytics, or Search Console account access is requested or used.',
    categories: ['Google Ads campaign', 'SEO / search visibility', 'Conversion tracking', 'Landing page quality', 'Business profile optimization'],
    officialUrl: 'https://support.google.com/google-ads/'
  })
});

/** Human-readable label from workflow configuration.
 * @param {keyof typeof WORKFLOWS} kind
 * @returns {string}
 */
export function workflowName(kind) {
  return WORKFLOWS[kind]?.heading || 'Unknown workflow';
}

/** Format trusted in-memory, validated fields as an exportable draft.
 * @param {import('./validators.js').CaseInput} record
 * @returns {string}
 */
export function buildDraft(record) {
  const lines = record.urls.map((url, index) => String(index + 1) + '. ' + url).join('\n');
  const base = [
    'ORM CASE DESK — PREPARED DRAFT (NOT SUBMITTED)',
    'Case: ' + record.title,
    'Prepared: ' + new Date().toISOString(),
    'Priority: ' + record.priority,
    'Prepared by: ' + record.requester,
    'Organization / rights holder: ' + (record.company || 'Not provided'),
    'Contact: ' + record.email,
    'Classification: ' + record.category,
    '',
    'REPORTED URLs',
    lines,
    '',
    'FACTUAL SUMMARY',
    record.details,
    '',
    'EVIDENCE / REFERENCES',
    record.evidence || 'No evidence references entered.',
    ''
  ];
  if (record.kind === 'dmca') {
    base.push(
      'COPYRIGHT NOTICE — REVIEW BEFORE SENDING',
      'Original work: ' + record.original,
      '',
      'I identify the copyrighted work above and the reported locations as described in this notice.',
      'I state in good faith that the use complained of is not authorized by the copyright owner, its agent, or the law.',
      'I state that the information in this notice is accurate and, under penalty of perjury, that I am the copyright owner or authorized to act on the owner’s behalf.',
      '',
      'Electronic signature (type full legal name after final review): ' + record.requester,
      '',
      'IMPORTANT: Review fair use, legal jurisdiction, the exact work and each URL before you submit. Providers may require additional contact information. This draft is not legal advice.'
    );
  } else if (record.kind === 'business') {
    base.push(
      'BUSINESS PROFILE REVIEW — POLICY BASIS',
      'Reported policy concern: ' + record.category,
      'Specific policy evidence: ' + record.details,
      '',
      'Submission checklist:',
      '[ ] Confirm each link is the correct Google Business Profile review',
      '[ ] Confirm the relevant Google Maps / Business Profile policy is actually violated',
      '[ ] Submit using the signed-in Business Profile review-reporting workflow',
      '[ ] Record the official case or appeal reference if supplied',
      '',
      'Reminder: Criticism or a low star rating alone is not grounds for removal.'
    );
  } else if (record.kind === 'social') {
    base.push(
      'PLATFORM REPORT — MANUAL FILING BRIEF',
      'Concern: ' + record.category,
      'Policy facts: ' + record.details,
      '',
      'Submission checklist:',
      '[ ] Identify the target platform and its applicable reporting policy',
      '[ ] Verify exact post/profile URLs and supporting evidence',
      '[ ] Use that platform’s official in-app or legal reporting method',
      '[ ] Document the case reference and follow-up steps',
      '',
      'Do not send bulk or unsupported reports. No account action has been taken by this tool.'
    );
  } else if (record.kind === 'audit') {
    base.push(
      'ADVERTISING / SEO AUDIT — DELIVERY BRIEF',
      'Scope: ' + record.category,
      'Current findings: ' + record.details,
      '',
      'Recommended review:',
      '[ ] Confirm ownership and authorized account access',
      '[ ] Review campaign objectives or organic search intent',
      '[ ] Inspect indexing, conversions, landing-page performance and consent configuration as relevant',
      '[ ] Prioritize evidence-backed improvements, risks and owners',
      '[ ] Create a measurable remediation plan and schedule a follow-up',
      '',
      'No Google Ads / Analytics / Search Console APIs are connected.'
    );
  }
  return base.concat('', 'Official guidance: ' + WORKFLOWS[record.kind].officialUrl).join('\n');
}