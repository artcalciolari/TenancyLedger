import type { UnitType } from '../../api/contract';

export function unitTypeLabel(type: UnitType): string {
  const labels: Record<UnitType, string> = {
    KITNET: 'Kitnet',
    ROOM: 'Quarto',
    APARTMENT: 'Apartamento',
    HOUSE: 'Casa',
    COMMERCIAL: 'Comercial',
  };
  return labels[type];
}
