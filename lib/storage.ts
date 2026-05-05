import type { DataSourceConfig, ExtensionConfig, NotionDatabaseConfig, PublicConfig } from './types';

const STORAGE_KEY = 'notion-lite-clipper-config';

function normalizeDataSource(input: Partial<DataSourceConfig> | null | undefined): DataSourceConfig | null {
  const name = input?.name?.trim() ?? '';
  const id = input?.id?.trim() ?? '';

  if (!name || !id) {
    return null;
  }

  return { name, id };
}

function normalizeDatabase(input: Partial<NotionDatabaseConfig> | null | undefined): NotionDatabaseConfig | null {
  const id = input?.id?.trim() ?? '';
  const name = input?.name?.trim() ?? '';
  const dataSources = (input?.dataSources ?? [])
    .map((entry) => normalizeDataSource(entry))
    .filter((entry): entry is DataSourceConfig => Boolean(entry));

  if (!id || dataSources.length === 0) {
    return null;
  }

  return {
    id,
    name: name || id,
    dataSources,
  };
}

export function flattenDataSources(databases: NotionDatabaseConfig[]): DataSourceConfig[] {
  const uniqueById = new Map<string, DataSourceConfig>();

  for (const database of databases) {
    for (const dataSource of database.dataSources) {
      if (!uniqueById.has(dataSource.id)) {
        uniqueById.set(dataSource.id, dataSource);
      }
    }
  }

  return [...uniqueById.values()];
}

export function sanitizeConfig(input: Partial<ExtensionConfig> | null | undefined): ExtensionConfig {
  const notionToken = input?.notionToken?.trim() ?? '';
  const databases = (input?.databases ?? [])
    .map((entry) => normalizeDatabase(entry))
    .filter((entry): entry is NotionDatabaseConfig => Boolean(entry));

  return { notionToken, databases };
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
    dataSources: flattenDataSources(config.databases),
    databaseCount: config.databases.length,
  };
}
