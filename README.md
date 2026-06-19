# Notion Lite Clipper

A small browser extension built with WXT that saves short text selections to Notion.

## What it does

- Stores a Notion internal integration token
- Imports data sources from one or more Notion databases
- Adds a right-click menu for saving selected text to a chosen Notion data source

## Requirements

- A Notion internal integration token
- At least one Notion database ID shared with that integration

## Install the latest release

1. Open the project's **Releases** page on GitHub.
2. Download the latest `notion-lite-clipper-*-chrome.zip` asset.
3. Extract the zip somewhere on your machine.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and choose the extracted folder.

If Firefox packages are published for a release, download `notion-lite-clipper-*-firefox.zip` from the same page and load it as a temporary add-on from Firefox's extension tooling.

## Development

Install dependencies:

```bash
bun install
```

Start the extension in development mode:

```bash
bun run dev
```

Useful commands:

- `bun run dev` - start WXT dev mode
- `bun run build` - build the extension
- `bun run zip` - create the Chrome release zip
- `bun run zip:firefox` - create the Firefox release and sources zips
- `bun run compile` - run TypeScript checks
- `bun run test` - run tests

## Release automation

This repository ships two GitHub Actions workflows:

- `CI` runs on every pull request and on pushes to `main`. It installs dependencies, type-checks, runs tests, and builds the extension.
- `Release` runs on every push to `main` and can also be started manually with `workflow_dispatch`. It uses `googleapis/release-please-action@v4` to automate version bumps, changelog updates, tags, and GitHub releases from Conventional Commits.

When `release-please` creates a new release, the workflow then:

1. checks out the released commit,
2. runs type-checks and tests,
3. builds the Chrome and Firefox packages,
4. uploads the generated zip files to the GitHub release.

`RELEASE_PLEASE_TOKEN` is required for the release workflow. Configure it as a fine-grained PAT that can write repository contents, pull requests, and issues. This repository cannot rely on GitHub's default `GITHUB_TOKEN` for release PR creation because GitHub Actions PR creation is disabled, which causes `release-please` to fail with `GitHub Actions is not permitted to create or approve pull requests`.

Commit messages now drive release behavior:

- `fix:` -> patch release
- `feat:` -> minor release
- `feat!:` or any commit with `BREAKING CHANGE:` -> major release

To publish a release automatically:

1. Merge changes into `main` using Conventional Commit messages.
2. Wait for release-please to open or update the release PR.
3. Merge the release PR.
4. Download the generated zip assets from the GitHub release once the workflow finishes.

To test the release workflow manually:

1. Open the repository's **Actions** tab on GitHub.
2. Select the **Release** workflow.
3. Click **Run workflow**.
4. Inspect the logs to confirm whether release-please created or updated a release PR, or created a release.

## Example config files

You can start from these formats:

- `.env`: `NOTION_TOKEN`, `DATABASE_1_ID`, `DATABASE_1_NAME`, `DATABASE_1_DATASOURCE_1_ID`, `DATABASE_1_DATASOURCE_1_NAME`
- `.yml` / `.yaml`: nested `databases` and `dataSources`

Example files are included in `examples/`:

- `examples/notion-lite-clipper.env.example`
- `examples/notion-lite-clipper.yml.example`

Import them from the Options page, then edit and save.