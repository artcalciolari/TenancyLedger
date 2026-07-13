import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, '../backend/docs/openapi.json');
const target = resolve(projectRoot, 'src/api/generated/schema.d.ts');

try {
  await access(source);
} catch {
  console.log('OpenAPI check ignorado: backend/docs/openapi.json ainda não existe.');
  process.exit(0);
}

const tempDirectory = await mkdtemp(resolve(tmpdir(), 'tenancy-ledger-openapi-'));
const generated = resolve(tempDirectory, 'schema.d.ts');
try {
  const ast = await openapiTS(new URL(`file:///${source.replaceAll('\\', '/')}`), {
    alphabetize: true,
    exportType: true,
  });
  await writeFile(generated, astToString(ast), 'utf8');
  const [actual, expected] = await Promise.all([
    readFile(generated, 'utf8'),
    readFile(target, 'utf8'),
  ]);
  if (actual !== expected) {
    throw new Error('Cliente OpenAPI desatualizado. Execute npm run api:generate.');
  }
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
