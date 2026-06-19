import { describe, expect, it } from 'vitest';

import { parseExtensionConfigFile } from '../lib/config-import';

describe('parseExtensionConfigFile', () => {
  it('parses env files', () => {
    expect(
      parseExtensionConfigFile(
        'NOTION_TOKEN=secret\nDATABASE_1_ID=database-1\nDATABASE_1_NAME=Inbox\nDATABASE_1_DATASOURCE_1_ID=source-1\nDATABASE_1_DATASOURCE_1_NAME=Inbox',
        '.env',
      ),
    ).toEqual({
      notionToken: 'secret',
      databases: [
        {
          id: 'database-1',
          name: 'Inbox',
          dataSources: [{ id: 'source-1', name: 'Inbox' }],
        },
      ],
    });
  });

  it('parses yaml files', () => {
    expect(
      parseExtensionConfigFile(
        'notionToken: secret\ndatabases:\n  - id: database-1\n    name: Inbox\n    dataSources:\n      - id: source-1\n        name: Inbox',
        '.yml',
      ),
    ).toEqual({
      notionToken: 'secret',
      databases: [
        {
          id: 'database-1',
          name: 'Inbox',
          dataSources: [{ id: 'source-1', name: 'Inbox' }],
        },
      ],
    });
  });
});
