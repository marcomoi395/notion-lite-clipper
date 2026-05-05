import { createPageInNotion, normalizeNotionId, resolveTargetDataSource } from '../lib/notion';
import { getPublicConfig, getStoredConfig } from '../lib/storage';
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
  if (config.notionToken && config.dataSources.length > 0) {
    return [
      {
        id: ROOT_MENU_ID,
        title: 'Save to Notion',
        contexts: ['selection'],
      },
      ...config.dataSources.map(
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

async function applyContextMenus(config: ExtensionConfig): Promise<void> {
  await browser.contextMenus.removeAll();

  for (const item of buildMenuItems(config)) {
    await browser.contextMenus.create(item);
  }
}

async function refreshContextMenus(): Promise<void> {
  const config = await getStoredConfig();
  await applyContextMenus(config);
}

async function handleSaveSelection(message: { sourceId?: string; selectionText?: string }): Promise<SelectionSaveResult> {
  const config = await getStoredConfig();

  if (!config.notionToken || config.dataSources.length === 0) {
    return {
      ok: false,
      needsSetup: true,
      message: 'Open extension options and add a Notion token plus at least one database.',
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

  const configuredSource = config.dataSources.find((entry) => entry.id === sourceId);
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

async function handleValidateDataSource(message: { sourceId?: string; token?: string }): Promise<ValidationResult> {
  const sourceId = message.sourceId?.trim() ?? '';
  const token = message.token?.trim() || (await getStoredConfig()).notionToken;

  if (!token) {
    return {
      ok: false,
      message: 'Enter a Notion token first to verify this ID.',
    };
  }

  if (!normalizeNotionId(sourceId)) {
    return {
      ok: false,
      message: 'Database ID must be a valid 32-character Notion ID.',
    };
  }

  try {
    const result = await resolveTargetDataSource({
      token,
      sourceId,
    });

    return {
      ok: true,
      resolvedName: result.resolvedName,
      message: result.resolvedName
        ? `Verified access to ${result.resolvedName}.`
        : 'Verified access to this Notion destination.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to verify this Notion destination.',
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

    const typedMessage = message as { type: string; sourceId?: string; selectionText?: string; token?: string };

    switch (typedMessage.type) {
      case 'get-public-config':
        return getPublicConfig();
      case 'save-selection':
        return handleSaveSelection(typedMessage);
      case 'validate-datasource':
        return handleValidateDataSource(typedMessage);
      default:
        return undefined;
    }
  });
});
