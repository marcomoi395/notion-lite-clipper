import type { DataSourceConfig, ExtensionConfig, PublicConfig } from './types';

const STORAGE_KEY = 'notion-lite-clipper-config';

function normalizeDataSource(input: Partial<DataSourceConfig> | null | undefined): DataSourceConfig | null {
  const name = input?.name?.trim() ?? '';
  const id = input?.id?.trim() ?? '';

  if (!name && !id) {
    return null;
  }

  return { name, id };
}

export function sanitizeConfig(input: Partial<ExtensionConfig> | null | undefined): ExtensionConfig {
  const notionToken = input?.notionToken?.trim() ?? '';
  const dataSources = (input?.dataSources ?? [])
    .map((entry) => normalizeDataSource(entry))
    .filter((entry): entry is DataSourceConfig => Boolean(entry));

  return { notionToken, dataSources };
}

export async function getStoredConfig(): Promise<ExtensionConfig> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return sanitizeConfig(stored[STORAGE_KEY] as Partial<ExtensionConfig> | null | undefined);
}

export async function saveStoredConfig(config: ExtensionConfig): Promise<void> {
  await browser.storage.sync.set({
    [STORAGE_KEY]: sanitizeConfig(config),
  });
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const config = await getStoredConfig();
  return {
    hasToken: Boolean(config.notionToken),
    dataSources: config.dataSources,
  };
}
