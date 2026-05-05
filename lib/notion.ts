import type { SelectionSaveResult } from './types';

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2025-09-03';

type NotionFetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface FetchOptions {
  fetcher?: NotionFetcher;
  token: string;
}

interface ResolveTargetDataSourceOptions extends FetchOptions {
  sourceId: string;
}

interface NotionPropertySchema {
  type?: string;
  [key: string]: unknown;
}

interface NotionDataSourceResponse {
  id?: string;
  name?: string;
  properties?: Record<string, NotionPropertySchema>;
}

interface NotionDatabaseResponse {
  data_sources?: Array<{ id?: string; name?: string }>;
}

interface CreatePageOptions extends FetchOptions {
  sourceId: string;
  selectionText: string;
}

export function normalizeNotionId(input: string): string | null {
  const compact = input.trim().replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return null;
  }

  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function findTitlePropertyName(properties: Record<string, NotionPropertySchema> | undefined): string | null {
  if (!properties) {
    return null;
  }

  for (const [key, property] of Object.entries(properties)) {
    if (property?.type === 'title') {
      return key;
    }
  }

  return null;
}

export function buildCreatePageBody(input: {
  dataSourceId: string;
  titlePropertyName: string;
  selectionText: string;
}): Record<string, unknown> {
  return {
    parent: { data_source_id: input.dataSourceId },
    properties: {
      [input.titlePropertyName]: {
        title: [
          {
            text: {
              content: input.selectionText,
            },
          },
        ],
      },
    },
  };
}

export function extractNotionError(status: number, payload: unknown): string {
  const message = typeof payload === 'object' && payload && 'message' in payload ? payload.message : null;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  switch (status) {
    case 401:
      return 'Notion token is invalid.';
    case 403:
      return 'The integration cannot access this Notion resource.';
    case 404:
      return 'Database or data source not found.';
    case 429:
      return 'Notion rate limited the request. Try again shortly.';
    default:
      return 'Notion request failed.';
  }
}

async function notionRequest<T>(path: string, { fetcher = fetch, token }: FetchOptions): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetcher(`${NOTION_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });

  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: extractNotionError(response.status, data),
    };
  }

  return { ok: true, data: data as T };
}

async function retrieveDataSource(sourceId: string, options: FetchOptions): Promise<{ dataSourceId: string; titlePropertyName: string; resolvedName?: string }> {
  const response = await notionRequest<NotionDataSourceResponse>(`/data_sources/${sourceId}`, options);

  if (!response.ok) {
    throw new Error(response.error);
  }

  const titlePropertyName = findTitlePropertyName(response.data.properties);
  if (!titlePropertyName) {
    throw new Error('No title property found on this Notion data source.');
  }

  return {
    dataSourceId: response.data.id ?? sourceId,
    titlePropertyName,
    resolvedName: response.data.name,
  };
}

export async function resolveTargetDataSource({ fetcher = fetch, token, sourceId }: ResolveTargetDataSourceOptions): Promise<{ dataSourceId: string; titlePropertyName: string; resolvedName?: string }> {
  const normalizedId = normalizeNotionId(sourceId);
  if (!normalizedId) {
    throw new Error('Database ID must be a valid 32-character Notion ID.');
  }

  const directLookup = await notionRequest<NotionDataSourceResponse>(`/data_sources/${normalizedId}`, {
    fetcher,
    token,
  });

  if (directLookup.ok) {
    const titlePropertyName = findTitlePropertyName(directLookup.data.properties);
    if (!titlePropertyName) {
      throw new Error('No title property found on this Notion data source.');
    }

    return {
      dataSourceId: directLookup.data.id ?? normalizedId,
      titlePropertyName,
      resolvedName: directLookup.data.name,
    };
  }

  if (directLookup.status !== 404) {
    throw new Error(directLookup.error);
  }

  const databaseLookup = await notionRequest<NotionDatabaseResponse>(`/databases/${normalizedId}`, {
    fetcher,
    token,
  });

  if (!databaseLookup.ok) {
    throw new Error(databaseLookup.error);
  }

  const dataSources = databaseLookup.data.data_sources ?? [];
  if (dataSources.length === 0) {
    throw new Error('This Notion database does not expose any data sources to the integration.');
  }

  if (dataSources.length > 1) {
    throw new Error('This database has multiple data sources. Copy a specific data source ID from Notion settings.');
  }

  const dataSourceId = dataSources[0]?.id;
  if (!dataSourceId) {
    throw new Error('The Notion database response did not include a usable data source ID.');
  }

  return retrieveDataSource(dataSourceId, { fetcher, token });
}

export async function createPageInNotion({ fetcher = fetch, token, sourceId, selectionText }: CreatePageOptions): Promise<SelectionSaveResult> {
  try {
    const target = await resolveTargetDataSource({ fetcher, token, sourceId });
    const response = await fetcher(`${NOTION_API_BASE_URL}/pages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(
        buildCreatePageBody({
          dataSourceId: target.dataSourceId,
          titlePropertyName: target.titlePropertyName,
          selectionText,
        }),
      ),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        message: extractNotionError(response.status, data),
      };
    }

    return {
      ok: true,
      message: `Saved to ${target.resolvedName ?? 'Notion'}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to save selection to Notion.',
    };
  }
}
