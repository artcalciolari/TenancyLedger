import { readFileSync } from 'node:fs';

export interface DatabaseSslFiles {
  caFile?: string;
  certFile?: string;
  keyFile?: string;
}

export interface DatabaseSslOptions {
  rejectUnauthorized: true;
  ca?: string;
  cert?: string;
  key?: string;
}

export function createDatabaseSslOptions(
  enabled: boolean,
  files: DatabaseSslFiles,
): false | DatabaseSslOptions {
  if (!enabled) return false;

  return {
    rejectUnauthorized: true,
    ...(files.caFile ? { ca: readFileSync(files.caFile, 'utf8') } : {}),
    ...(files.certFile ? { cert: readFileSync(files.certFile, 'utf8') } : {}),
    ...(files.keyFile ? { key: readFileSync(files.keyFile, 'utf8') } : {}),
  };
}
