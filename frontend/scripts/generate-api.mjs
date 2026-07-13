import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, '../backend/docs/openapi.json');
const target = resolve(projectRoot, 'src/api/generated/schema.d.ts');

try {
  await access(source);
} catch {
  throw new Error(
    'Snapshot OpenAPI ausente em backend/docs/openapi.json. Gere-o no backend antes de atualizar o cliente.',
  );
}

const ast = await openapiTS(new URL(`file:///${source.replaceAll('\\', '/')}`), {
  alphabetize: true,
  exportType: true,
});
await mkdir(dirname(target), { recursive: true });
await writeFile(target, astToString(ast), 'utf8');
