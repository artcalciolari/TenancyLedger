function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeBrazilianMobilePhone(value: string): string {
  const digits = digitsOnly(value);
  return digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
}

export function normalizeBrazilianReferencePhone(value: string): string {
  const digits = digitsOnly(value);
  return (digits.length === 12 || digits.length === 13) && digits.startsWith('55')
    ? digits.slice(2)
    : digits;
}
