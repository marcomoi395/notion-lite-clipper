import { createPageInNotion, normalizeNotionId, resolveDatabaseDataSources } from '../lib/notion';
import { flattenDataSources, getPublicConfig, getStoredConfig } from '../lib/storage';
import type { ExtensionConfig, SelectionSaveResult, ValidationResult } from '../lib/types';

export const ROOT_MENU_ID = 'save-to-notion';
export const SETTINGS_MENU_ID = 'save-to-notion:settings';
const DATASOURCE_MENU_PREFIX = 'save-to-notion:datasource:';

interface ContextMenuInfoLike {
  menuItemId?: number | string;
  selectionText?: string;
}

interface ContextMenuActionHandlers {
  openOptions: () => Promise<void>;
  saveSelection: (message: { sourceId?: string; selectionText?: string }) => Promise<SelectionSaveResult>;
}

interface MenuItemDefinition {
  contexts: ['selection'];
  id: string;
  parentId?: string;
  title: string;
}

export function getDataSourceMenuItemId(sourceId: string): string {
  return `${DATASOURCE_MENU_PREFIX}${sourceId}`;
}

function getDataSourceIdFromMenuItemId(menuItemId: string): string {
  return menuItemId.startsWith(DATASOURCE_MENU_PREFIX)
    ? menuItemId.slice(DATASOURCE_MENU_PREFIX.length)
    : '';
}

export function buildMenuItems(config: ExtensionConfig): MenuItemDefinition[] {
  const dataSources = flattenDataSources(config.databases);

  if (config.notionToken && dataSources.length > 0) {
    return [
      {
        id: ROOT_MENU_ID,
        title: 'Save to Notion',
        contexts: ['selection'],
      },
      ...dataSources.map(
        (dataSource): MenuItemDefinition => ({
          id: getDataSourceMenuItemId(dataSource.id),
          parentId: ROOT_MENU_ID,
          title: dataSource.name,
          contexts: ['selection'],
        }),
      ),
    ];
  }

  return [
    {
      id: ROOT_MENU_ID,
      title: 'Notion Lite Clipper',
      contexts: ['selection'],
    },
    {
      id: SETTINGS_MENU_ID,
      parentId: ROOT_MENU_ID,
      title: 'Open settings',
      contexts: ['selection'],
    },
  ];
}

async function openOptionsPage(): Promise<void> {
  await browser.runtime.openOptionsPage();
}

let isRefreshingMenus = false;

async function applyContextMenus(config: ExtensionConfig): Promise<void> {
  await browser.contextMenus.removeAll();

  for (const item of buildMenuItems(config)) {
    await browser.contextMenus.create(item);
  }
}

async function refreshContextMenus(): Promise<void> {
  if (isRefreshingMenus) {
    return; // Skip if already refreshing
  }

  isRefreshingMenus = true;
  try {
    const config = await getStoredConfig();
    await applyContextMenus(config);
  } finally {
    isRefreshingMenus = false;
  }
}

async function handleSaveSelection(message: { sourceId?: string; selectionText?: string }): Promise<SelectionSaveResult> {
  const config = await getStoredConfig();
  const dataSources = flattenDataSources(config.databases);

  if (!config.notionToken || dataSources.length === 0) {
    return {
      ok: false,
      needsSetup: true,
      message: 'Open extension options, add a Notion token, then import at least one database.',
    };
  }

  const sourceId = message.sourceId?.trim() ?? '';
  const selectionText = message.selectionText?.trim() ?? '';

  if (!sourceId || !selectionText) {
    return {
      ok: false,
      message: 'Missing selection text or destination database.',
    };
  }

  const configuredSource = dataSources.find((entry) => entry.id === sourceId);
  if (!configuredSource) {
    return {
      ok: false,
      message: 'The selected database is no longer configured.',
    };
  }

  return createPageInNotion({
    token: config.notionToken,
    sourceId: configuredSource.id,
    selectionText,
  });
}

export async function handleContextMenuAction(
  info: ContextMenuInfoLike,
  handlers: ContextMenuActionHandlers,
): Promise<void> {
  const menuItemId = String(info.menuItemId ?? '');

  if (menuItemId === SETTINGS_MENU_ID) {
    await handlers.openOptions();
    return;
  }

  const sourceId = getDataSourceIdFromMenuItemId(menuItemId);
  const selectionText = info.selectionText?.trim() ?? '';

  if (!sourceId || !selectionText) {
    return;
  }

  await handlers.saveSelection({
    sourceId,
    selectionText,
  });
}

async function handleValidateDatabase(message: { databaseId?: string; token?: string }): Promise<ValidationResult> {
  const databaseId = message.databaseId?.trim() ?? '';
  const token = message.token?.trim() || (await getStoredConfig()).notionToken;

  if (!token) {
    return {
      ok: false,
      message: 'Enter a Notion token first to verify this database.',
    };
  }

  if (!normalizeNotionId(databaseId)) {
    return {
      ok: false,
      message: 'Database ID must be a valid 32-character Notion ID.',
    };
  }

  try {
    const result = await resolveDatabaseDataSources({
      token,
      databaseId,
    });
    const names = result.dataSources.map((entry) => entry.name).join(', ');

    return {
      ok: true,
      resolvedName: result.resolvedName,
      resolvedDatabaseId: result.databaseId,
      resolvedDataSources: result.dataSources,
      message: result.resolvedName
        ? `Found ${result.dataSources.length} data source${result.dataSources.length === 1 ? '' : 's'} in ${result.resolvedName}: ${names}.`
        : `Found ${result.dataSources.length} data source${result.dataSources.length === 1 ? '' : 's'}: ${names}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to verify this Notion database.',
    };
  }
}

export default defineBackground(() => {
  void refreshContextMenus();

  browser.runtime.onInstalled.addListener(() => {
    void refreshContextMenus();
  });

  browser.runtime.onStartup.addListener(() => {
    void refreshContextMenus();
  });

  browser.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === 'sync') {
      void refreshContextMenus();
    }
  });

  browser.contextMenus.onClicked.addListener((info) => {
    void handleContextMenuAction(info, {
      openOptions: openOptionsPage,
      saveSelection: handleSaveSelection,
    });
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return undefined;
    }

    const typedMessage = message as { type: string; sourceId?: string; selectionText?: string; token?: string; databaseId?: string };

    switch (typedMessage.type) {
      case 'get-public-config':
        return getPublicConfig();
      case 'save-selection':
        return handleSaveSelection(typedMessage);
      case 'validate-database':
        return handleValidateDatabase(typedMessage);
      default:
        return undefined;
    }
  });
});
