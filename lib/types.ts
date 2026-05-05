export interface DataSourceConfig {
  id: string;
  name: string;
}

export interface NotionDatabaseConfig {
  id: string;
  name: string;
  dataSources: DataSourceConfig[];
}

export interface ExtensionConfig {
  notionToken: string;
  databases: NotionDatabaseConfig[];
}

export interface PublicConfig {
  hasToken: boolean;
  dataSources: DataSourceConfig[];
  databaseCount: number;
}

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
}

export interface SelectionSaveResult {
  ok: boolean;
  message: string;
  needsSetup?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  message: string;
  resolvedName?: string;
  resolvedDatabaseId?: string;
  resolvedDataSources?: DataSourceConfig[];
}
