import { beforeEach, describe, expect, it, vi } from 'vitest';

let buildMenuItems: typeof import('../entrypoints/background').buildMenuItems;
let getDataSourceMenuItemId: typeof import('../entrypoints/background').getDataSourceMenuItemId;
let handleContextMenuAction: typeof import('../entrypoints/background').handleContextMenuAction;
let ROOT_MENU_ID: typeof import('../entrypoints/background').ROOT_MENU_ID;
let SETTINGS_MENU_ID: typeof import('../entrypoints/background').SETTINGS_MENU_ID;

beforeEach(async () => {
  vi.resetModules();
  Object.defineProperty(globalThis, 'defineBackground', {
    configurable: true,
    value: (factory: unknown) => factory,
  });

  const background = await import('../entrypoints/background');
  buildMenuItems = background.buildMenuItems;
  getDataSourceMenuItemId = background.getDataSourceMenuItemId;
  handleContextMenuAction = background.handleContextMenuAction;
  ROOT_MENU_ID = background.ROOT_MENU_ID;
  SETTINGS_MENU_ID = background.SETTINGS_MENU_ID;
});
describe('buildMenuItems', () => {
  it('creates a selection submenu with one child per datasource', () => {
    expect(
      buildMenuItems({
        notionToken: 'secret',
        dataSources: [
          { id: 'db-1', name: 'Inbox' },
          { id: 'db-2', name: 'Quotes' },
        ],
      }),
    ).toEqual([
      {
        id: ROOT_MENU_ID,
        title: 'Save to Notion',
        contexts: ['selection'],
      },
      {
        id: getDataSourceMenuItemId('db-1'),
        parentId: ROOT_MENU_ID,
        title: 'Inbox',
        contexts: ['selection'],
      },
      {
        id: getDataSourceMenuItemId('db-2'),
        parentId: ROOT_MENU_ID,
        title: 'Quotes',
        contexts: ['selection'],
      },
    ]);
  });

  it('shows a settings entry when Notion is not configured', () => {
    expect(
      buildMenuItems({
        notionToken: '',
        dataSources: [],
      }),
    ).toEqual([
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
    ]);
  });
});

describe('handleContextMenuAction', () => {
  it('opens options when the settings item is clicked', async () => {
    const openOptions = vi.fn(async () => undefined);
    const saveSelection = vi.fn();

    await handleContextMenuAction(
      { menuItemId: SETTINGS_MENU_ID, selectionText: 'quoted text' },
      { openOptions, saveSelection },
    );

    expect(openOptions).toHaveBeenCalledTimes(1);
    expect(saveSelection).not.toHaveBeenCalled();
  });

  it('saves the selected text to the datasource encoded in the menu id', async () => {
    const openOptions = vi.fn(async () => undefined);
    const saveSelection = vi.fn(async () => ({ ok: true, message: 'Saved' }));

    await handleContextMenuAction(
      { menuItemId: getDataSourceMenuItemId('db-1'), selectionText: 'quoted text' },
      { openOptions, saveSelection },
    );

    expect(saveSelection).toHaveBeenCalledWith({
      sourceId: 'db-1',
      selectionText: 'quoted text',
    });
    expect(openOptions).not.toHaveBeenCalled();
  });
});
