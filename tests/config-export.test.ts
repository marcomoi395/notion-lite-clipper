import { describe, expect, it } from 'vitest';

import { exportConfigAsEnv, exportConfigAsYaml } from '../lib/config-export';

describe('exportConfigAsEnv', () => {
  it('serializes a config into env format', () => {
    expect(
      exportConfigAsEnv({
        notionToken: 'secret',
        databases: [
          {
            id: 'database-1',
            name: 'Inbox',
            dataSources: [{ id: 'source-1', name: 'Inbox' }],
          },
        ],
      }),
    ).toContain('NOTION_TOKEN=secret');
  });
});

describe('exportConfigAsYaml', () => {
  it('serializes a config into yaml format', () => {
    expect(
      exportConfigAsYaml({
        notionToken: 'secret',
        databases: [
          {
            id: 'database-1',
            name: 'Inbox',
            dataSources: [{ id: 'source-1', name: 'Inbox' }],
          },
        ],
      }),
    ).toContain('notionToken: secret');
  });
});
