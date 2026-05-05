# Notion Lite Clipper

A small browser extension built with WXT that saves short text selections to Notion.

## What it does

- Stores a Notion internal integration token
- Imports data sources from one or more Notion databases
- Adds a right-click menu for saving selected text to a chosen Notion data source

## Requirements

- A Notion internal integration token
- At least one Notion database ID shared with that integration

## Development

Install dependencies:

```bash
npm install
```

Start the extension in development mode:

```bash
npm run dev
```

Useful commands:

- `npm run dev` - start WXT dev mode
- `npm run build` - build the extension
- `npm run zip` - create a packaged zip
- `npm run compile` - run TypeScript checks
- `npm run test` - run tests

## How to use

1. Open the extension options page.
2. Paste your Notion internal integration token.
3. Add a Notion database ID and save settings.
4. Select text on any webpage.
5. Right-click the selection and choose a Notion data source from the extension menu.

## Notes

- The extension saves selected text as a new Notion page title.
- If a database contains multiple data sources, they are imported into the context menu automatically.
- The extension uses the Notion API directly from the background service worker.
