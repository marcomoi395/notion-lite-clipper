export interface DataSourceConfig {
  id: string;
  name: string;
}

export interface ExtensionConfig {
  notionToken: string;
  dataSources: DataSourceConfig[];
}

export interface PublicConfig {
  hasToken: boolean;
  dataSources: DataSourceConfig[];
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
}
