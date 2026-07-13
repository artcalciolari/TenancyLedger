const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCents(value: number): string {
  return brlFormatter.format(value / 100);
}

export function parseBrlToCents(value: string): number | null {
  const compact = value.trim().replace(/\s|R\$/gi, '');
  const normalized = compact.includes(',')
    ? compact.replaceAll('.', '').replace(',', '.')
    : compact;
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const [integerPart, decimalPart = ''] = normalized.replace(',', '.').split('.');
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function availableToSubmit(
  totalValueCents: number,
  payments: { amountCents: number; status: string }[],
): number {
  const reserved = payments
    .filter(({ status }) => status === 'APPROVED' || status === 'SUBMITTED')
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  return Math.max(0, totalValueCents - reserved);
}
