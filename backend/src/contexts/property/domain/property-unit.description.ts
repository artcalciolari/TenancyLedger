import type { PropertyUnit } from './property-unit.entity';

export function describePropertyUnit(property: PropertyUnit): string {
  return `${property.type} ${property.unitNumber} — ${property.neighborhood}`;
}
