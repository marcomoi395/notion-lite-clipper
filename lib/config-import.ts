import type { DataSourceConfig, ExtensionConfig, NotionDatabaseConfig } from './types';

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvConfig(text: string): Partial<ExtensionConfig> {
  const entries = new Map<string, string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!match) continue;

    entries.set(match[1].trim(), stripQuotes(match[2]));
  }

  const databases: NotionDatabaseConfig[] = [];
  const indexes = [...entries.keys()]
    .map((key) => key.match(/^DATABASE_(\d+)_ID$/i)?.[1])
    .filter((value): value is string => Boolean(value));

  for (const index of indexes) {
    const id = entries.get(`DATABASE_${index}_ID`) ?? '';
    if (!id.trim()) continue;

    const dataSources: DataSourceConfig[] = [];
    const sourceIndexes = [...entries.keys()]
      .map((key) => key.match(new RegExp(`^DATABASE_${index}_DATASOURCE_(\\d+)_ID$`, 'i'))?.[1])
      .filter((value): value is string => Boolean(value));

    for (const sourceIndex of sourceIndexes) {
      const sourceId = entries.get(`DATABASE_${index}_DATASOURCE_${sourceIndex}_ID`) ?? '';
      if (!sourceId.trim()) continue;
      dataSources.push({
        id: sourceId.trim(),
        name: stripQuotes(entries.get(`DATABASE_${index}_DATASOURCE_${sourceIndex}_NAME`) ?? sourceId),
      });
    }

    databases.push({
      id: id.trim(),
      name: stripQuotes(entries.get(`DATABASE_${index}_NAME`) ?? id),
      dataSources,
    });
  }

  return {
    notionToken: stripQuotes(entries.get('NOTION_TOKEN') ?? ''),
    databases,
  };
}

function parseYamlConfig(text: string): Partial<ExtensionConfig> {
  const databases: NotionDatabaseConfig[] = [];
  let notionToken = '';
  let currentDatabase: NotionDatabaseConfig | null = null;
  let currentDataSource: DataSourceConfig | null = null;
  let inDataSources = false;

  const pushDataSource = (): void => {
    if (currentDatabase && currentDataSource?.id) {
      currentDatabase.dataSources.push({ id: currentDataSource.id, name: currentDataSource.name || currentDataSource.id });
    }
    currentDataSource = null;
  };

  const pushDatabase = (): void => {
    pushDataSource();
    if (currentDatabase?.id) {
      databases.push(currentDatabase);
    }
    currentDatabase = null;
    inDataSources = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    if (indent === 0 && trimmed.startsWith('notionToken:')) {
      notionToken = stripQuotes(trimmed.slice('notionToken:'.length));
      continue;
    }

    if (indent === 0 && trimmed === 'databases:') continue;

    if (indent === 2 && trimmed.startsWith('- id:')) {
      pushDatabase();
      currentDatabase = { id: stripQuotes(trimmed.slice(5)), name: '', dataSources: [] };
      continue;
    }

    if (currentDatabase && indent === 4 && trimmed.startsWith('name:') && !inDataSources) {
      currentDatabase.name = stripQuotes(trimmed.slice(5));
      continue;
    }

    if (currentDatabase && indent === 4 && trimmed === 'dataSources:') {
      inDataSources = true;
      continue;
    }

    if (currentDatabase && inDataSources && indent === 6 && trimmed.startsWith('- id:')) {
      pushDataSource();
      currentDataSource = { id: stripQuotes(trimmed.slice(5)), name: '' };
      continue;
    }

    if (currentDataSource && indent === 8 && trimmed.startsWith('name:')) {
      currentDataSource.name = stripQuotes(trimmed.slice(5));
    }
  }

  pushDatabase();
  return { notionToken, databases };
}

export function parseExtensionConfigFile(text: string, fileName = ''): Partial<ExtensionConfig> {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith('.env')) return parseEnvConfig(text);
  if (normalizedName.endsWith('.yml') || normalizedName.endsWith('.yaml')) return parseYamlConfig(text);

  try {
    return JSON.parse(text) as Partial<ExtensionConfig>;
  } catch {
    return parseEnvConfig(text);
  }
}
