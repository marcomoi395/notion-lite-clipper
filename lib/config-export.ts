import type { ExtensionConfig, NotionDatabaseConfig } from './types';

function quote(value: string): string {
  return value.includes(' ') || value.includes(':') || value.includes('#') ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function indent(text: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return text
    .split(/\r?\n/)
    .map((line) => (line ? `${prefix}${line}` : line))
    .join('\n');
}

export function exportConfigAsEnv(config: ExtensionConfig): string {
  const lines = [`NOTION_TOKEN=${quote(config.notionToken)}`];

  config.databases.forEach((database, index) => {
    const n = index + 1;
    lines.push(`DATABASE_${n}_ID=${quote(database.id)}`);
    lines.push(`DATABASE_${n}_NAME=${quote(database.name)}`);

    database.dataSources.forEach((dataSource, dataIndex) => {
      const m = dataIndex + 1;
      lines.push(`DATABASE_${n}_DATASOURCE_${m}_ID=${quote(dataSource.id)}`);
      lines.push(`DATABASE_${n}_DATASOURCE_${m}_NAME=${quote(dataSource.name)}`);
    });
  });

  return `${lines.join('\n')}\n`;
}

function serializeDatabase(database: NotionDatabaseConfig): string {
  const lines = [`- id: ${quote(database.id)}`, `  name: ${quote(database.name)}`];
  if (database.dataSources.length > 0) {
    lines.push('  dataSources:');
    for (const dataSource of database.dataSources) {
      lines.push(`    - id: ${quote(dataSource.id)}`);
      lines.push(`      name: ${quote(dataSource.name)}`);
    }
  }

  return lines.join('\n');
}

export function exportConfigAsYaml(config: ExtensionConfig): string {
  const lines = [`notionToken: ${quote(config.notionToken)}`, 'databases:'];
  for (const database of config.databases) {
    lines.push(indent(serializeDatabase(database), 2));
  }

  return `${lines.join('\n')}\n`;
}
