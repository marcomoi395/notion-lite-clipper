import './style.css';

import { normalizeNotionId } from '../../lib/notion';
import { getStoredConfig, sanitizeConfig, saveStoredConfig } from '../../lib/storage';
import type { DataSourceConfig, ValidationResult } from '../../lib/types';

interface DatabaseRow {
  key: number;
  id: string;
  resolvedName: string;
  resolvedDataSources: DataSourceConfig[];
  validationState: 'idle' | 'checking' | 'valid' | 'invalid';
  validationMessage: string;
}

interface OptionsState {
  notionToken: string;
  databases: DatabaseRow[];
  saveMessage: string;
  saveState: 'idle' | 'success' | 'error';
}

let nextRowKey = 1;
const validationTimers = new Map<number, number>();

const state: OptionsState = {
  notionToken: '',
  databases: [createEmptyRow()],
  saveMessage: '',
  saveState: 'idle',
};

function createEmptyRow(): DatabaseRow {
  return {
    key: nextRowKey++,
    id: '',
    resolvedName: '',
    resolvedDataSources: [],
    validationState: 'idle',
    validationMessage: '',
  };
}

function getRowError(row: DatabaseRow): string {
  const id = row.id.trim();

  if (!id) {
    return '';
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

function setRowValidation(row: DatabaseRow, stateValue: DatabaseRow['validationState'], message: string): void {
  row.validationState = stateValue;
  row.validationMessage = message;
}

function updateRowMessageInDom(rowKey: number): void {
  const row = state.databases.find((entry) => entry.key === rowKey);
  const messageElement = document.querySelector<HTMLParagraphElement>(`.database-row[data-key="${rowKey}"] .validation`);
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

async function validateRowRemotely(rowKey: number): Promise<boolean> {
  const row = state.databases.find((entry) => entry.key === rowKey);
  if (!row) {
    return false;
  }

  const localError = getRowError(row);
  if (localError) {
    row.resolvedName = '';
    row.resolvedDataSources = [];
    setRowValidation(row, 'invalid', localError);
    updateRowMessageInDom(rowKey);
    return false;
  }

  if (!row.id.trim()) {
    row.resolvedName = '';
    row.resolvedDataSources = [];
    setRowValidation(row, 'idle', '');
    updateRowMessageInDom(rowKey);
    return false;
  }

  if (!state.notionToken.trim()) {
    row.resolvedName = '';
    row.resolvedDataSources = [];
    setRowValidation(row, 'invalid', 'Add a token to import data sources from this database.');
    updateRowMessageInDom(rowKey);
    return false;
  }

  const currentId = row.id.trim();
  const currentToken = state.notionToken.trim();
  setRowValidation(row, 'checking', 'Retrieving data sources…');
  updateRowMessageInDom(rowKey);

  const response = (await browser.runtime.sendMessage({
    type: 'validate-database',
    databaseId: currentId,
    token: currentToken,
  })) as ValidationResult;

  const latestRow = state.databases.find((entry) => entry.key === rowKey);
  if (!latestRow || latestRow.id.trim() !== currentId) {
    return false;
  }

  latestRow.resolvedName = response.resolvedName ?? '';
  latestRow.resolvedDataSources = response.resolvedDataSources ?? [];
  setRowValidation(latestRow, response.ok ? 'valid' : 'invalid', response.message);
  updateRowMessageInDom(rowKey);
  return response.ok;
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
  return state.databases
    .map((row) => {
      const message = row.validationMessage || getRowError(row);
      const validationClass = row.validationState === 'valid' ? 'is-valid' : row.validationState === 'invalid' ? 'is-invalid' : '';

      return `
        <div class="database-row" data-key="${row.key}">
          <div class="field-group">
            <label for="id-${row.key}">Database ID</label>
            <input id="id-${row.key}" data-field="id" data-key="${row.key}" type="text" value="${escapeHtml(row.id)}" placeholder="32-character Notion database ID" />
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

    for (const row of state.databases) {
      if (row.id.trim()) {
        scheduleRowValidation(row.key);
      }
    }
  });

  app.querySelector<HTMLButtonElement>('#add-row')?.addEventListener('click', () => {
    state.databases.push(createEmptyRow());
    render();
  });

  app.querySelector<HTMLButtonElement>('#save-settings')?.addEventListener('click', () => {
    void saveSettings();
  });

  for (const input of app.querySelectorAll<HTMLInputElement>('input[data-field]')) {
    input.addEventListener('input', (event) => {
      const target = event.currentTarget as HTMLInputElement;
      const rowKey = Number(target.dataset.key);
      const row = state.databases.find((entry) => entry.key === rowKey);
      if (!row) {
        return;
      }

      row.id = target.value;
      row.resolvedName = '';
      row.resolvedDataSources = [];
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
      state.databases = state.databases.filter((entry) => entry.key !== rowKey);
      if (state.databases.length === 0) {
        state.databases.push(createEmptyRow());
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
            Paste each Notion database ID once. The extension will retrieve every data source under that database automatically.
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
            <h2>Databases</h2>
            <p>Each database ID is resolved through Notion&apos;s retrieve database API, then its data sources are imported for the context menu.</p>
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
  const filledRows = state.databases.filter((row) => row.id.trim());
  const rowErrors = filledRows
    .map((row) => ({ row, error: getRowError(row) }))
    .filter((entry) => Boolean(entry.error));

  if (!state.notionToken.trim()) {
    setSaveStatus('Enter a Notion token before saving.', 'error');
    render();
    return;
  }

  if (rowErrors.length > 0) {
    for (const entry of rowErrors) {
      setRowValidation(entry.row, 'invalid', entry.error);
    }

    setSaveStatus('Fix validation errors before saving.', 'error');
    render();
    return;
  }

  let hasValidationFailure = false;
  for (const row of filledRows) {
    const isValid = await validateRowRemotely(row.key);
    if (!isValid) {
      hasValidationFailure = true;
    }
  }

  if (hasValidationFailure) {
    setSaveStatus('Fix database validation errors before saving.', 'error');
    render();
    return;
  }

  const config = sanitizeConfig({
    notionToken: state.notionToken,
    databases: filledRows.map((row) => ({
      id: normalizeNotionId(row.id) ?? row.id.trim(),
      name: row.resolvedName || row.id.trim(),
      dataSources: row.resolvedDataSources,
    })),
  });

  await saveStoredConfig(config);

  state.notionToken = config.notionToken;
  state.databases =
    config.databases.length > 0
      ? config.databases.map((row) => ({
          key: nextRowKey++,
          id: row.id,
          resolvedName: row.name,
          resolvedDataSources: row.dataSources,
          validationState: 'valid',
          validationMessage: `Imported ${row.dataSources.length} data source${row.dataSources.length === 1 ? '' : 's'} from ${row.name}.`,
        }))
      : [createEmptyRow()];

  const importedCount = config.databases.reduce((total, row) => total + row.dataSources.length, 0);
  setSaveStatus(`Settings saved. Imported ${importedCount} data source${importedCount === 1 ? '' : 's'} from ${config.databases.length} database${config.databases.length === 1 ? '' : 's'}.`, 'success');
  render();
}

async function loadInitialState(): Promise<void> {
  const config = await getStoredConfig();

  state.notionToken = config.notionToken;
  state.databases =
    config.databases.length > 0
      ? config.databases.map((row) => ({
          key: nextRowKey++,
          id: row.id,
          resolvedName: row.name,
          resolvedDataSources: row.dataSources,
          validationState: 'valid',
          validationMessage: `Imported ${row.dataSources.length} data source${row.dataSources.length === 1 ? '' : 's'} from ${row.name}.`,
        }))
      : [createEmptyRow()];

  render();
}

void loadInitialState();
