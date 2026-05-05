import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Notion Lite Clipper',
    description: 'Quickly save short text selections into Notion databases.',
    permissions: ['storage', 'contextMenus'],
    host_permissions: ['https://api.notion.com/*'],
    action: {
      default_title: 'Notion Lite Clipper',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
});
