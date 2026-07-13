import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const endpoint = process.env.OPENAPI_URL ?? 'http://localhost:3000/docs-json';
const outputPath = resolve(process.cwd(), 'docs/openapi.json');
const checkOnly = process.argv.includes('--check');

function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, sortRecursively(value[key])]),
  );
}

function assertCompleteContract(document) {
  const schemas = document?.components?.schemas;
  const requiredObjectSchemas = [
    'LoginDto',
    'LoginResponseDto',
    'UserResponseDto',
    'TenantResponseDto',
    'PropertyResponseDto',
    'ContractResponseDto',
    'InvoiceResponseDto',
    'PaymentResponseDto',
    'ProblemDetailsDto',
  ];
  for (const name of requiredObjectSchemas) {
    const properties = schemas?.[name]?.properties;
    if (!properties || Object.keys(properties).length === 0) {
      throw new Error(
        `OpenAPI incompleto: components.schemas.${name} não possui propriedades. ` +
          'Confirme que a API em OPENAPI_URL foi reconstruída a partir do código atual.',
      );
    }
  }
  if (!schemas.UserResponseDto.properties.active) {
    throw new Error('OpenAPI incompleto: UserResponseDto.active não está documentado.');
  }
  const paymentOperation = document?.paths?.['/invoices/{id}/payments']?.post;
  const idempotencyHeaders = paymentOperation?.parameters?.filter(
    (parameter) =>
      parameter?.in === 'header' && parameter.name?.toLowerCase() === 'idempotency-key',
  );
  if (idempotencyHeaders?.length !== 1) {
    throw new Error('OpenAPI inválido: o pagamento deve documentar um único Idempotency-Key.');
  }
  if (!paymentOperation?.requestBody?.content?.['multipart/form-data']) {
    throw new Error('OpenAPI incompleto: o multipart de pagamento não está documentado.');
  }
}

const response = await fetch(endpoint, {
  headers: { accept: 'application/json' },
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) {
  throw new Error(`Não foi possível obter o OpenAPI em ${endpoint}: HTTP ${response.status}.`);
}

const rawDocument = await response.json();
assertCompleteContract(rawDocument);
const document = sortRecursively(rawDocument);
const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (checkOnly) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== serialized) {
    console.error(
      'backend/docs/openapi.json está desatualizado. Execute npm run openapi:generate.',
    );
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, 'utf8');
  console.log(`OpenAPI salvo em ${outputPath}.`);
}
