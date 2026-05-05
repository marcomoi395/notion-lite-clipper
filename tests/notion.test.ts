import { describe, expect, it, vi } from 'vitest';

import {
  buildCreatePageBody,
  extractNotionError,
  findTitlePropertyName,
  normalizeNotionId,
  resolveTargetDataSource,
} from '../lib/notion';

describe('normalizeNotionId', () => {
  it('normalizes 32-character ids into uuid form', () => {
    expect(normalizeNotionId('d9824bdc84454327be8b5b47500af6ce')).toBe('d9824bdc-8445-4327-be8b-5b47500af6ce');
  });

  it('returns null for invalid ids', () => {
    expect(normalizeNotionId('bad-id')).toBeNull();
  });
});

describe('findTitlePropertyName', () => {
  it('finds the title property key from a data source schema', () => {
    expect(
      findTitlePropertyName({
        Name: { id: 'title', type: 'title', title: {} },
        Notes: { id: 'x', type: 'rich_text', rich_text: {} },
      }),
    ).toBe('Name');
  });
});

describe('buildCreatePageBody', () => {
  it('creates a Notion page payload using the resolved title property', () => {
    expect(
      buildCreatePageBody({
        dataSourceId: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
        titlePropertyName: 'Name',
        selectionText: 'Captured text',
      }),
    ).toEqual({
      parent: { data_source_id: 'd9824bdc-8445-4327-be8b-5b47500af6ce' },
      properties: {
        Name: {
          title: [
            {
              text: { content: 'Captured text' },
            },
          ],
        },
      },
    });
  });
});

describe('extractNotionError', () => {
  it('prefers structured Notion messages', () => {
    expect(extractNotionError(403, { message: 'No access' })).toBe('No access');
  });

  it('falls back to a status-specific message', () => {
    expect(extractNotionError(401, null)).toMatch(/token/i);
  });
});

describe('resolveTargetDataSource', () => {
  it('accepts a data source id directly', async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input.endsWith('/v1/data_sources/d9824bdc-8445-4327-be8b-5b47500af6ce')) {
        return new Response(
          JSON.stringify({
            id: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
            name: 'Inbox',
            properties: {
              Name: { type: 'title', title: {} },
            },
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ message: 'missing' }), { status: 404 });
    });

    await expect(
      resolveTargetDataSource({
        fetcher,
        token: 'secret',
        sourceId: 'd9824bdc84454327be8b5b47500af6ce',
      }),
    ).resolves.toEqual({
      dataSourceId: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
      titlePropertyName: 'Name',
      resolvedName: 'Inbox',
    });
  });

  it('falls back from database id to its only data source', async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input.endsWith('/v1/data_sources/d9824bdc-8445-4327-be8b-5b47500af6ce')) {
        return new Response(JSON.stringify({ message: 'missing' }), { status: 404 });
      }

      if (input.endsWith('/v1/databases/d9824bdc-8445-4327-be8b-5b47500af6ce')) {
        return new Response(
          JSON.stringify({
            title: [{ plain_text: 'Inbox DB' }],
            data_sources: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Default' }],
          }),
          { status: 200 },
        );
      }

      if (input.endsWith('/v1/data_sources/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')) {
        return new Response(
          JSON.stringify({
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Default',
            properties: {
              Name: { type: 'title', title: {} },
            },
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ message: 'missing' }), { status: 404 });
    });

    await expect(
      resolveTargetDataSource({
        fetcher,
        token: 'secret',
        sourceId: 'd9824bdc-8445-4327-be8b-5b47500af6ce',
      }),
    ).resolves.toEqual({
      dataSourceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      titlePropertyName: 'Name',
      resolvedName: 'Default',
    });
  });
});
