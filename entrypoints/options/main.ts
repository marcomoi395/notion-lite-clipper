import './style.css';

import { normalizeNotionId } from '../../lib/notion';
import { sanitizeConfig, saveStoredConfig } from '../../lib/storage';
import type { ValidationResult } from '../../lib/types';

interface DataSourceRow {
  key: number;
  name: string;
  id: string;
  validationState: 'idle' | 'checking' | 'valid' | 'invalid';
  validationMessage: string;
}

interface OptionsState {
  notionToken: string;
  dataSources: DataSourceRow[];
  saveMessage: string;
  saveState: 'idle' | 'success' | 'error';
}

let nextRowKey = 1;
const validationTimers = new Map<number, number>();

const state: OptionsState = {
  notionToken: '',
  dataSources: [createEmptyRow()],
  saveMessage: '',
  saveState: 'idle',
};

function createEmptyRow(): DataSourceRow {
  return {
    key: nextRowKey++,
    name: '',
    id: '',
    validationState: 'idle',
    validationMessage: '',
  };
}

function getRowError(row: DataSourceRow): string {
  const name = row.name.trim();
  const id = row.id.trim();

  if (!name && !id) {
    return '';
  }

  if (!name) {
    return 'Enter a display name.';
  }

  if (!id) {
    return 'Enter a Database ID.';
  }

  if (!normalizeNotionId(id)) {
    return 'Database ID must be 32 hexadecimal characters.';
  }

  return '';
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function setSaveStatus(message: string, saveState: OptionsState['saveState']): void {
  state.saveMessage = message;
  state.saveState = saveState;
}

function setRowValidation(row: DataSourceRow, stateValue: DataSourceRow['validationState'], message: string): void {
  row.validationState = stateValue;
  row.validationMessage = message;
}

function updateRowMessageInDom(rowKey: number): void {
  const row = state.dataSources.find((entry) => entry.key === rowKey);
  const messageElement = document.querySelector<HTMLParagraphElement>(`.data-source-row[data-key="${rowKey}"] .validation`);
  if (!row || !messageElement) {
    return;
  }

  const message = row.validationMessage || getRowError(row);
  messageElement.textContent = message;
  messageElement.classList.toggle('is-valid', row.validationState === 'valid');
  messageElement.classList.toggle('is-invalid', row.validationState === 'invalid');
}

function updateSaveStatusInDom(): void {
  const element = document.querySelector<HTMLParagraphElement>('.save-status');
  if (!element) {
    return;
  }

  element.textContent = state.saveMessage;
  element.classList.toggle('is-valid', state.saveState === 'success');
  element.classList.toggle('is-invalid', state.saveState === 'error');
}

async function validateRowRemotely(rowKey: number): Promise<void> {
  const row = state.dataSources.find((entry) => entry.key === rowKey);
  if (!row) {
    return;
  }

  const localError = getRowError(row);
  if (localError) {
    setRowValidation(row, 'invalid', localError);
    updateRowMessageInDom(rowKey);
    return;
  }

  if (!state.notionToken.trim()) {
    setRowValidation(row, 'idle', 'Format looks valid. Add a token to verify access.');
    updateRowMessageInDom(rowKey);
    return;
  }

  const currentId = row.id.trim();
  const currentToken = state.notionToken.trim();
  setRowValidation(row, 'checking', 'Checking access…');
  updateRowMessageInDom(rowKey);

  const response = (await browser.runtime.sendMessage({
    type: 'validate-datasource',
    sourceId: currentId,
    token: currentToken,
  })) as ValidationResult;

  const latestRow = state.dataSources.find((entry) => entry.key === rowKey);
  if (!latestRow || latestRow.id.trim() !== currentId) {
    return;
  }

  setRowValidation(latestRow, response.ok ? 'valid' : 'invalid', response.message);
  updateRowMessageInDom(rowKey);
}

function scheduleRowValidation(rowKey: number): void {
  const currentTimer = validationTimers.get(rowKey);
  if (currentTimer) {
    window.clearTimeout(currentTimer);
  }

  const timer = window.setTimeout(() => {
    void validateRowRemotely(rowKey);
  }, 350);

  validationTimers.set(rowKey, timer);
}

function buildRowsMarkup(): string {
  return state.dataSources
    .map((row) => {
      const message = row.validationMessage || getRowError(row);
      const validationClass = row.validationState === 'valid' ? 'is-valid' : row.validationState === 'invalid' ? 'is-invalid' : '';

      return `
        <div class="data-source-row" data-key="${row.key}">
          <div class="field-group">
            <label for="name-${row.key}">Display name</label>
            <input id="name-${row.key}" data-field="name" data-key="${row.key}" type="text" value="${escapeHtml(row.name)}" placeholder="Inbox" />
          </div>
          <div class="field-group">
            <label for="id-${row.key}">Database ID</label>
            <input id="id-${row.key}" data-field="id" data-key="${row.key}" type="text" value="${escapeHtml(row.id)}" placeholder="32-character Notion ID" />
          </div>
          <button class="remove-button" data-action="remove" data-key="${row.key}" type="button">Remove</button>
          <p class="validation ${validationClass}">${escapeHtml(message)}</p>
        </div>
      `;
    })
    .join('');
}

function attachEventHandlers(app: HTMLDivElement): void {
  app.querySelector<HTMLInputElement>('#notion-token')?.addEventListener('input', (event) => {
    const target = event.currentTarget as HTMLInputElement;
    state.notionToken = target.value;
    setSaveStatus('', 'idle');
    updateSaveStatusInDom();

    for (const row of state.dataSources) {
      if (row.id.trim()) {
        scheduleRowValidation(row.key);
      }
    }
  });

  app.querySelector<HTMLButtonElement>('#add-row')?.addEventListener('click', () => {
    state.dataSources.push(createEmptyRow());
    render();
  });

  app.querySelector<HTMLButtonElement>('#save-settings')?.addEventListener('click', () => {
    void saveSettings();
  });

  for (const input of app.querySelectorAll<HTMLInputElement>('input[data-field]')) {
    input.addEventListener('input', (event) => {
      const target = event.currentTarget as HTMLInputElement;
      const rowKey = Number(target.dataset.key);
      const field = target.dataset.field as 'name' | 'id';
      const row = state.dataSources.find((entry) => entry.key === rowKey);
      if (!row) {
        return;
      }

      row[field] = target.value;
      setRowValidation(row, 'idle', '');
      setSaveStatus('', 'idle');
      updateSaveStatusInDom();
      updateRowMessageInDom(rowKey);
      scheduleRowValidation(rowKey);
    });
  }

  for (const button of app.querySelectorAll<HTMLButtonElement>('button[data-action="remove"]')) {
    button.addEventListener('click', () => {
      const rowKey = Number(button.dataset.key);
      state.dataSources = state.dataSources.filter((entry) => entry.key !== rowKey);
      if (state.dataSources.length === 0) {
        state.dataSources.push(createEmptyRow());
      }
      render();
    });
  }
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    return;
  }

  app.innerHTML = `
    <main class="page-shell">
      <section class="hero card">
        <div>
          <p class="eyebrow">Notion Lite Clipper</p>
          <h1>Configure Notion capture</h1>
          <p class="description">
            Save highlighted snippets of up to 10 words into your chosen Notion databases.
          </p>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <h2>Notion token</h2>
            <p>Paste your internal integration token. API calls stay in the background service worker.</p>
          </div>
        </div>
        <label class="field-group" for="notion-token">
          <span>Internal integration token</span>
          <input id="notion-token" type="password" value="${escapeHtml(state.notionToken)}" placeholder="secret_..." />
        </label>
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <h2>Data sources</h2>
            <p>Each row needs a display name and the target Database ID from Notion.</p>
          </div>
          <button id="add-row" type="button">Add database</button>
        </div>
        <div class="data-source-list">${buildRowsMarkup()}</div>
      </section>

      <section class="actions">
        <button id="save-settings" type="button">Save settings</button>
        <p class="save-status ${state.saveState === 'success' ? 'is-valid' : state.saveState === 'error' ? 'is-invalid' : ''}">
          ${escapeHtml(state.saveMessage)}
        </p>
      </section>
    </main>
  `;

  attachEventHandlers(app);
}

async function saveSettings(): Promise<void> {
  const rowErrors = state.dataSources
    .map((row) => ({ row, error: getRowError(row) }))
    .filter((entry) => Boolean(entry.error));

  if (rowErrors.length > 0) {
    for (const entry of rowErrors) {
      setRowValidation(entry.row, 'invalid', entry.error);
    }

    setSaveStatus('Fix validation errors before saving.', 'error');
    render();
    return;
  }

  const config = sanitizeConfig({
    notionToken: state.notionToken,
    dataSources: state.dataSources.map((row) => ({
      name: row.name,
      id: normalizeNotionId(row.id) ?? row.id.trim(),
    })),
  });

  await saveStoredConfig(config);
  state.notionToken = config.notionToken;
  state.dataSources =
    config.dataSources.length > 0
      ? config.dataSources.map((row) => ({
          key: nextRowKey++,
          name: row.name,
          id: row.id,
          validationState: 'idle',
          validationMessage: '',
        }))
      : [createEmptyRow()];
  setSaveStatus('Settings saved.', 'success');
  render();
}

async function loadInitialState(): Promise<void> {
  const config = await browser.storage.sync.get('notion-lite-clipper-config');
  const sanitized = sanitizeConfig(config['notion-lite-clipper-config'] as Parameters<typeof sanitizeConfig>[0]);

  state.notionToken = sanitized.notionToken;
  state.dataSources =
    sanitized.dataSources.length > 0
      ? sanitized.dataSources.map((row) => ({
          key: nextRowKey++,
          name: row.name,
          id: row.id,
          validationState: 'idle',
          validationMessage: '',
        }))
      : [createEmptyRow()];

  render();
}

void loadInitialState();
