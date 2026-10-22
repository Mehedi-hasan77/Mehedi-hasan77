import { validateCase, ValidationError } from './validators.js';
import { WORKFLOWS, workflowName } from './templates.js';
import { createCaseStore } from './store.js';

/** @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing application element: ' + id);
  return /** @type {T} */ (node);
}

/** Produce a safe, text-only DOM element; never parse case data as HTML.
 * @param {string} tag
 * @param {string} value
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function textNode(tag, value, className = '') {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}

/** User-directed file export, without transmission to a remote server.
 * @param {string} filename
 * @param {string} content
 * @param {string} mime
 * @returns {void}
 */
function downloadFile(filename, content, mime) {
  const objectUrl = URL.createObjectURL(new Blob([content], {type: mime}));
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

/** Initialize all case intake, rendering, and export behavior.
 * @returns {void}
 */
function init() {
  const store = createCaseStore();
  const form = /** @type {HTMLFormElement} */ (byId('case-form'));
  const submitButton = /** @type {HTMLButtonElement} */ (byId('generate-btn'));
  const kinds = Array.from(document.querySelectorAll('[data-kind]'));
  const errorBox = byId('form-error');
  const originalGroup = byId('original-group');
  const rightsGroup = byId('rights-group');
  const originalInput = /** @type {HTMLInputElement} */ (byId('original'));
  const categorySelect = /** @type {HTMLSelectElement} */ (byId('category'));
  const caseList = byId('case-list');
  const draftText = byId('draft-text');
  const draftPanel = byId('draft-panel');
  const draftContent = byId('draft-content');
  const draftEmpty = byId('draft-empty');
  const draftMeta = byId('draft-meta');
  const officialLink = /** @type {HTMLAnchorElement} */ (byId('official-link'));
  const toast = byId('toast');
  let activeKind = /** @type {keyof typeof WORKFLOWS} */ ('dmca');
  let activeId = '';
  let toastTimeout = 0;

  /** Show transient, accessible feedback. @param {string} message @returns {void} */
  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 3000);
  }

  /** Show a non-HTML validation error. @param {string} message @returns {void} */
  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({behavior:'smooth', block:'center'});
  }

  /** Hide existing validation issues. @returns {void} */
  function clearError() { errorBox.hidden = true; errorBox.textContent = ''; }

  /** Select workflow and update only its relevant fields. @param {keyof typeof WORKFLOWS} kind @returns {void} */
  function selectKind(kind) {
    const config = WORKFLOWS[kind];
    if (!config) return;
    activeKind = kind;
    clearError();
    byId('form-heading').textContent = config.heading;
    byId('workflow-hint').textContent = config.hint;
    categorySelect.replaceChildren();
    for (const label of config.categories) {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      categorySelect.append(option);
    }
    const isDmca = kind === 'dmca';
    originalGroup.hidden = !isDmca;
    rightsGroup.hidden = !isDmca;
    originalInput.required = isDmca;
    for (const button of kinds) {
      const selected = button.getAttribute('data-kind') === kind;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  /** Update current-session metrics. @returns {void} */
  function renderMetrics() {
    const stats = store.stats();
    byId('metric-total').textContent = String(stats.total).padStart(2, '0');
    byId('metric-urls').textContent = String(stats.urls).padStart(2, '0');
    byId('metric-ready').textContent = String(stats.ready).padStart(2, '0');
  }

  /** Render the queue without placing untrusted data in innerHTML. @returns {void} */
  function renderQueue() {
    caseList.replaceChildren();
    const cases = store.list();
    if (!cases.length) {
      const empty = textNode('div', '', 'empty-state');
      empty.append(textNode('span', '◈'), textNode('strong', 'No requests yet'), textNode('p', 'Your first prepared case will appear here.'));
      caseList.append(empty);
      return;
    }
    for (const record of cases) {
      const button = /** @type {HTMLButtonElement} */ (document.createElement('button'));
      button.type = 'button';
      button.className = 'case-item' + (record.id === activeId ? ' active' : '');
      button.setAttribute('aria-pressed', String(record.id === activeId));
      const info = document.createElement('span');
      info.append(textNode('strong', record.input.title), textNode('small', record.id + ' · ' + workflowName(record.input.kind) + ' · ' + record.input.urls.length + ' URL(s)'));
      button.append(info, textNode('span', 'READY', 'case-status'));
      button.addEventListener('click', () => selectCase(record.id));
      caseList.append(button);
    }
  }

  /** Preview selected case plus corresponding official instructions. @param {string} id @returns {void} */
  function selectCase(id) {
    const record = store.get(id);
    if (!record) { activeId = ''; clearDraft(); return; }
    activeId = record.id;
    draftEmpty.hidden = true;
    draftContent.hidden = false;
    draftText.textContent = record.draft;
    draftMeta.textContent = record.id + ' · ' + new Date(record.createdAt).toLocaleString() + ' · ' + record.input.priority + ' priority';
    officialLink.href = WORKFLOWS[record.input.kind].officialUrl;
    officialLink.textContent = 'Open official ' + (record.input.kind === 'audit' ? 'product support' : 'reporting instructions') + ' ↗';
    renderQueue();
  }

  /** Empty the draft preview. @returns {void} */
  function clearDraft() {
    draftEmpty.hidden = false;
    draftContent.hidden = true;
    draftText.textContent = '';
    draftMeta.textContent = '';
  }

  /** Safely collect only the fields this application owns. @returns {Record<string, unknown>} */
  function collectFormData() {
    const inputs = new FormData(form);
    return {
      kind: activeKind, title: inputs.get('title'), priority: inputs.get('priority'),
      requester: inputs.get('requester'), email: inputs.get('email'),
      company: inputs.get('company'), category: inputs.get('category'),
      urls: inputs.get('urls'), original: inputs.get('original'),
      details: inputs.get('details'), evidence: inputs.get('evidence'),
      rights: byId('rights').checked, goodfaith: byId('goodfaith').checked,
      truthful: byId('truthful').checked
    };
  }

  /** Generate a validated in-memory case. @param {SubmitEvent} event @returns {void} */
  function onSubmit(event) {
    event.preventDefault();
    if (submitButton.disabled) return;
    clearError();
    submitButton.disabled = true;
    try {
      const validated = validateCase(collectFormData());
      const record = store.add(validated);
      activeId = record.id;
      renderMetrics();
      selectCase(record.id);
      notify('Draft prepared. No report has been submitted.');
      byId('case-log').scrollIntoView({behavior:'smooth', block:'start'});
    } catch (error) {
      showError(error instanceof ValidationError ? error.message : 'Unexpected error. Check your inputs and try again.');
    } finally {
      submitButton.disabled = false;
    }
  }

  /** Access the active case or explain missing selection. @returns {import('./store.js').CaseRecord|null} */
  function currentCase() {
    const record = store.get(activeId);
    if (!record) { notify('Select a case before exporting.'); return null; }
    return record;
  }

  for (const button of kinds) {
    button.addEventListener('click', () => selectKind(/** @type {keyof typeof WORKFLOWS} */ (button.getAttribute('data-kind'))));
  }
  form.addEventListener('submit', onSubmit);
  form.addEventListener('reset', () => { clearError(); notify('Form reset.'); });
  byId('clear-cases').addEventListener('click', () => {
    if (!store.list().length) { notify('The queue is already empty.'); return; }
    if (!window.confirm('Discard all locally prepared cases? Export any drafts you need first.')) return;
    store.clear(); activeId = ''; renderMetrics(); renderQueue(); clearDraft(); notify('Local cases cleared.');
  });
  byId('copy-draft').addEventListener('click', async () => {
    const record = currentCase();
    if (!record) return;
    try { await navigator.clipboard.writeText(record.draft); notify('Draft copied to clipboard.'); }
    catch { notify('Clipboard unavailable. Select the draft text and copy it manually.'); }
  });
  byId('download-txt').addEventListener('click', () => {
    const record = currentCase();
    if (record) { downloadFile(record.id + '.txt', record.draft, 'text/plain;charset=utf-8'); notify('TXT draft exported.'); }
  });
  byId('download-json').addEventListener('click', () => {
    const record = currentCase();
    if (record) {
      downloadFile(record.id + '.json', JSON.stringify(record, null, 2), 'application/json;charset=utf-8');
      notify('JSON exported locally. Protect downloaded personal information.');
    }
  });
  byId('year').textContent = String(new Date().getFullYear());
  selectKind(activeKind);
  renderMetrics();
  renderQueue();
  clearDraft();
  // No localStorage, cookies, telemetry, fetch, or platform account credentials are used.
}

try { init(); }
catch (error) {
  const el = document.getElementById('form-error');
  if (el) { el.hidden = false; el.textContent = 'Unable to initialize this page. Reload once or check browser compatibility.'; }
  console.error('ORM Case Desk initialization failed', error);
}